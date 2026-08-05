import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import type { Category, Book } from '@/lib/types';
import { Plus, Pencil, Trash2, X, Eye, EyeOff, ArrowUp, ArrowDown, BookOpen, Move, FolderEdit, Settings2, CheckCircle2 } from 'lucide-react';

export function AdminCategories() {
  const { show } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [bookCounts, setBookCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name_ar: '', name_en: '', slug: '', icon: '' });
  const [showDeleteModal, setShowDeleteModal] = useState<Category | null>(null);
  const [moveTarget, setMoveTarget] = useState<string>('');
  const [booksInCategory, setBooksInCategory] = useState<Book[]>([]);

  // States for "Manage Books inside Category"
  const [managingCategory, setManagingCategory] = useState<Category | null>(null);
  const [allBooks, setAllBooks] = useState<Book[]>([]);
  const [manageSearch, setManageSearch] = useState('');
  const [addToCategoryBookId, setAddToCategoryBookId] = useState('');

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('sort_order');
    const cats = (data as Category[]) ?? [];
    setCategories(cats);

    const counts: Record<string, number> = {};
    await Promise.all(
      cats.map(async (c) => {
        const { count } = await supabase.from('books').select('*', { count: 'exact', head: true }).eq('category_id', c.id);
        counts[c.id] = count ?? 0;
      })
    );
    setBookCounts(counts);
    setLoading(false);
  };

  useEffect(() => { fetchCategories(); }, []);

  const generateSlug = (name: string) => name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]/g, '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name_ar) { show('يرجى إدخال اسم التصنيف', 'error'); return; }

    // Check for duplicate category names
    const trimmedName = form.name_ar.trim();
    const isDuplicate = categories.some(
      (c) => c.name_ar.trim() === trimmedName && c.id !== editingId
    );
    if (isDuplicate) {
      show('اسم التصنيف هذا موجود بالفعل. يرجى إدخال اسم فريد.', 'error');
      return;
    }

    const payload = {
      name_ar: trimmedName,
      name_en: form.name_en || null,
      slug: form.slug || generateSlug(form.name_ar),
      icon: form.icon || null,
    };
    if (editingId) {
      const { error } = await supabase.from('categories').update(payload).eq('id', editingId);
      if (error) { show('فشل التحديث', 'error'); return; }
      show('تم تحديث التصنيف', 'success');
    } else {
      const { error } = await supabase.from('categories').insert(payload);
      if (error) { show('فشل الإضافة', 'error'); return; }
      show('تمت إضافة التصنيف', 'success');
    }
    setForm({ name_ar: '', name_en: '', slug: '', icon: '' });
    setEditingId(null);
    setShowForm(false);
    fetchCategories();
  };

  const handleEdit = (cat: Category) => {
    setForm({ name_ar: cat.name_ar, name_en: cat.name_en ?? '', slug: cat.slug, icon: cat.icon ?? '' });
    setEditingId(cat.id);
    setShowForm(true);
  };

  const handleToggleHidden = async (cat: Category) => {
    await supabase.from('categories').update({ is_hidden: !cat.is_hidden }).eq('id', cat.id);
    fetchCategories();
  };

  const handleMove = async (cat: Category, direction: 'up' | 'down') => {
    const idx = categories.findIndex((c) => c.id === cat.id);
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === categories.length - 1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const swapCat = categories[swapIdx];
    await Promise.all([
      supabase.from('categories').update({ sort_order: cat.sort_order }).eq('id', swapCat.id),
      supabase.from('categories').update({ sort_order: swapCat.sort_order }).eq('id', cat.id),
    ]);
    fetchCategories();
  };

  const openDeleteModal = async (cat: Category) => {
    const { data } = await supabase.from('books').select('*').eq('category_id', cat.id);
    setBooksInCategory((data as Book[]) ?? []);
    setMoveTarget('');
    setShowDeleteModal(cat);
  };

  const handleDelete = async () => {
    if (!showDeleteModal) return;
    if (booksInCategory.length > 0 && !moveTarget) {
      // Prompt option to move target, but also can just allow normal delete (which SETS NULL automatically on database level)
      if (!confirm('هل أنت متأكد من حذف التصنيف وإرجاع جميع كتبه بدون تصنيف؟')) return;
    }

    if (booksInCategory.length > 0 && moveTarget) {
      await supabase.from('books').update({ category_id: moveTarget }).eq('category_id', showDeleteModal.id);
    }
    const { error } = await supabase.from('categories').delete().eq('id', showDeleteModal.id);
    if (error) { show('فشل حذف التصنيف', 'error'); return; }
    show('تم حذف التصنيف بنجاح وبقيت جميع الكتب سليمة', 'success');
    setShowDeleteModal(null);
    fetchCategories();
  };

  // Manage books inside category helpers
  const startManagingBooks = async (cat: Category) => {
    setLoading(true);
    const { data: bData } = await supabase.from('books').select('*');
    setAllBooks((bData as Book[]) ?? []);
    setManagingCategory(cat);
    setAddToCategoryBookId('');
    setManageSearch('');
    setLoading(false);
  };

  const handleAddBookToCategory = async (bookId: string) => {
    if (!bookId || !managingCategory) return;
    const { error } = await supabase.from('books').update({ category_id: managingCategory.id }).eq('id', bookId);
    if (error) { show('فشل إضافة الكتاب', 'error'); return; }
    show('تمت إضافة الكتاب للتصنيف', 'success');

    // Refresh local lists
    setAllBooks(prev => prev.map(b => b.id === bookId ? { ...b, category_id: managingCategory.id } : b));
    setAddToCategoryBookId('');
    fetchCategories(); // Refresh counts
  };

  const handleRemoveBookFromCategory = async (bookId: string) => {
    if (!confirm('هل أنت متأكد من إزالة هذا الكتاب من هذا التصنيف؟')) return;
    const { error } = await supabase.from('books').update({ category_id: null }).eq('id', bookId);
    if (error) { show('فشل إزالة الكتاب', 'error'); return; }
    show('تمت إزالة الكتاب من التصنيف', 'success');

    // Refresh local lists
    setAllBooks(prev => prev.map(b => b.id === bookId ? { ...b, category_id: null } : b));
    fetchCategories(); // Refresh counts
  };

  const handleMoveBookToCategory = async (bookId: string, targetCatId: string) => {
    const categoryIdVal = targetCatId === 'uncategorized' || !targetCatId ? null : targetCatId;
    const { error } = await supabase.from('books').update({ category_id: categoryIdVal }).eq('id', bookId);
    if (error) { show('فشل نقل الكتاب', 'error'); return; }
    show('تم نقل الكتاب بنجاح', 'success');

    // Refresh local lists
    setAllBooks(prev => prev.map(b => b.id === bookId ? { ...b, category_id: categoryIdVal } : b));
    fetchCategories(); // Refresh counts
  };

  const resetForm = () => {
    setForm({ name_ar: '', name_en: '', slug: '', icon: '' });
    setEditingId(null);
    setShowForm(false);
  };

  // Filter books inside managing category
  const filteredCategoryBooks = allBooks.filter(
    (b) =>
      b.category_id === managingCategory?.id &&
      (b.title.toLowerCase().includes(manageSearch.toLowerCase()) ||
        (b.author?.toLowerCase().includes(manageSearch.toLowerCase()) ?? false))
  );

  // Available books to add
  const availableBooksToAdd = allBooks.filter((b) => b.category_id !== managingCategory?.id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-ink-900">إدارة التصنيفات ({categories.length})</h2>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary">
          <Plus size={18} /> إضافة تصنيف
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold text-ink-900">{editingId ? 'تعديل تصنيف' : 'تصنيف جديد'}</h3>
            <button type="button" onClick={resetForm} className="text-ink-400 hover:text-ink-600"><X size={20} /></button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">الاسم بالعربية *</label>
              <input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">الاسم بالإنجليزية</label>
              <input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} className="input" dir="ltr" />
            </div>
            <div>
              <label className="label">المعرّف (slug)</label>
              <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="input" dir="ltr" placeholder="auto-generated" />
            </div>
            <div>
              <label className="label">الأيقونة (اسم Lucide)</label>
              <input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} className="input" dir="ltr" placeholder="BookOpen" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" className="btn-primary">{editingId ? 'تحديث' : 'إضافة'}</button>
            <button type="button" onClick={resetForm} className="btn-ghost">إلغاء</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-16 w-full" />)}</div>
      ) : (
        <div className="space-y-2">
          {categories.map((cat, idx) => (
            <div key={cat.id} className={`card flex items-center gap-3 p-4 ${cat.is_hidden ? 'opacity-60 bg-ink-50' : ''}`}>
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => handleMove(cat, 'up')}
                  disabled={idx === 0}
                  className="text-ink-400 hover:text-primary-600 disabled:opacity-30"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  onClick={() => handleMove(cat, 'down')}
                  disabled={idx === categories.length - 1}
                  className="text-ink-400 hover:text-primary-600 disabled:opacity-30"
                >
                  <ArrowDown size={14} />
                </button>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-ink-900">{cat.name_ar}</p>
                  {cat.is_hidden && <span className="badge bg-ink-100 text-ink-500">معطل</span>}
                </div>
                <p className="text-xs text-ink-400">
                  {cat.slug} • {bookCounts[cat.id] ?? 0} كتاب
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {/* Manage Books inside category */}
                <button
                  onClick={() => startManagingBooks(cat)}
                  className="btn-outline py-1 px-2.5 text-xs flex items-center gap-1.5"
                  title="إدارة كتب التصنيف"
                >
                  <BookOpen size={14} /> إدارة الكتب
                </button>

                <button
                  onClick={() => handleToggleHidden(cat)}
                  className="rounded-lg p-2 text-ink-500 hover:bg-ink-100"
                  title={cat.is_hidden ? 'تفعيل' : 'إيقاف تفعيل'}
                >
                  {cat.is_hidden ? <EyeOff size={16} className="text-ink-400" /> : <Eye size={16} className="text-primary-600" />}
                </button>
                <button onClick={() => handleEdit(cat)} className="rounded-lg p-2 text-ink-500 hover:bg-ink-100">
                  <Pencil size={16} />
                </button>
                <button onClick={() => openDeleteModal(cat)} className="rounded-lg p-2 text-red-500 hover:bg-red-50">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowDeleteModal(null)}>
          <div className="card max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 flex items-center gap-2 font-bold text-ink-900">
              <Trash2 size={20} className="text-red-500" /> حذف التصنيف
            </h3>
            <p className="text-sm text-ink-600">
              هل أنت متأكد من حذف تصنيف "{showDeleteModal.name_ar}"؟ لن يتم حذف أي من الكتب الموجودة فيه بل ستبقى سليمة.
            </p>
            {booksInCategory.length > 0 && (
              <div className="mt-4 rounded-xl bg-accent-50 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-accent-800">
                  <Move size={16} /> يوجد {booksInCategory.length} كتاب في هذا التصنيف
                </p>
                <p className="mt-1 text-xs text-accent-700">يمكنك اختيار تصنيف آخر لنقل الكتب إليه، أو تركها فارغة لتصبح كتباً غير مصنفة تلقائياً:</p>
                <select
                  value={moveTarget}
                  onChange={(e) => setMoveTarget(e.target.value)}
                  className="input mt-2"
                >
                  <option value="">ترك الكتب كغير مصنفة (Uncategorized)</option>
                  {categories.filter((c) => c.id !== showDeleteModal.id).map((c) => (
                    <option key={c.id} value={c.id}>{c.name_ar}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleDelete}
                className="btn-primary bg-red-600 hover:bg-red-700"
              >
                تأكيد الحذف
              </button>
              <button onClick={() => setShowDeleteModal(null)} className="btn-ghost">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Manage books in category modal */}
      {managingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setManagingCategory(null)}>
          <div className="card w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between border-b border-ink-100 pb-3">
              <div>
                <h3 className="font-bold text-xl text-ink-900 flex items-center gap-2">
                  <BookOpen className="text-primary-600" /> إدارة كتب تصنيف: <span className="text-primary-700">{managingCategory.name_ar}</span>
                </h3>
                <p className="text-xs text-ink-500 mt-1">أضف كتباً إلى هذا التصنيف، أو أزلها، أو انقلها إلى تصنيف آخر.</p>
              </div>
              <button onClick={() => setManagingCategory(null)} className="text-ink-400 hover:text-ink-600"><X size={24} /></button>
            </div>

            {/* Part 1: Add book to category */}
            <div className="bg-primary-50/50 border border-primary-100 rounded-xl p-4 mb-6">
              <h4 className="font-bold text-sm text-primary-800 mb-2">إضافة كتاب إلى التصنيف</h4>
              <div className="flex gap-2">
                <select
                  value={addToCategoryBookId}
                  onChange={(e) => setAddToCategoryBookId(e.target.value)}
                  className="input flex-1 text-sm"
                >
                  <option value="">اختر كتاباً للإضافة...</option>
                  {availableBooksToAdd.map((b) => {
                    const currentCat = categories.find((c) => c.id === b.category_id);
                    return (
                      <option key={b.id} value={b.id}>
                        {b.title} ({b.author || 'مؤلف غير معروف'}) {currentCat ? `[تصنيف آخر: ${currentCat.name_ar}]` : '[غير مصنف]'}
                      </option>
                    );
                  })}
                </select>
                <button
                  onClick={() => handleAddBookToCategory(addToCategoryBookId)}
                  disabled={!addToCategoryBookId}
                  className="btn-primary py-2 px-4 text-sm whitespace-nowrap disabled:opacity-50"
                >
                  إضافة للتصنيف
                </button>
              </div>
            </div>

            {/* Part 2: Books currently in this category list */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h4 className="font-bold text-sm text-ink-900">
                  الكتب الحالية في التصنيف ({filteredCategoryBooks.length})
                </h4>
                <input
                  type="text"
                  placeholder="ابحث بين كتب التصنيف..."
                  value={manageSearch}
                  onChange={(e) => setManageSearch(e.target.value)}
                  className="input py-1 px-3 text-xs w-48"
                />
              </div>

              {filteredCategoryBooks.length === 0 ? (
                <div className="border border-dashed border-ink-200 rounded-xl py-8 text-center text-ink-400 text-sm">
                  {manageSearch ? 'لا توجد كتب مطابقة لبحثك' : 'لا توجد كتب في هذا التصنيف حالياً'}
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {filteredCategoryBooks.map((book) => (
                    <div key={book.id} className="flex items-center justify-between border border-ink-100 rounded-xl p-3 text-sm bg-white hover:bg-ink-50 transition-colors">
                      <div className="flex-1">
                        <p className="font-semibold text-ink-900">{book.title}</p>
                        <p className="text-xs text-ink-500">{book.author || 'مؤلف غير معروف'}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {/* Move category select */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-ink-400 whitespace-nowrap">نقل إلى:</span>
                          <select
                            onChange={(e) => handleMoveBookToCategory(book.id, e.target.value)}
                            value=""
                            className="input py-1 px-2 text-xs w-36"
                          >
                            <option value="" disabled>اختر تصنيف...</option>
                            {categories.filter((c) => c.id !== managingCategory.id).map((c) => (
                              <option key={c.id} value={c.id}>{c.name_ar}</option>
                            ))}
                            <option value="uncategorized">بلا تصنيف</option>
                          </select>
                        </div>

                        {/* Remove button */}
                        <button
                          onClick={() => handleRemoveBookFromCategory(book.id)}
                          className="btn-danger py-1 px-2.5 text-xs"
                        >
                          إزالة
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 border-t border-ink-100 pt-4 flex justify-end">
              <button
                onClick={() => setManagingCategory(null)}
                className="btn-outline text-sm px-6"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
