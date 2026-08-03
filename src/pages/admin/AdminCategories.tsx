import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import type { Category, Book } from '@/lib/types';
import { Plus, Pencil, Trash2, X, Eye, EyeOff, ArrowUp, ArrowDown, BookOpen, Move } from 'lucide-react';

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
    const payload = {
      name_ar: form.name_ar,
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
      show('يرجى اختيار تصنيف لنقل الكتب إليه', 'error');
      return;
    }
    if (booksInCategory.length > 0 && moveTarget) {
      await supabase.from('books').update({ category_id: moveTarget }).eq('category_id', showDeleteModal.id);
    }
    const { error } = await supabase.from('categories').delete().eq('id', showDeleteModal.id);
    if (error) { show('فشل حذف التصنيف', 'error'); return; }
    show('تم حذف التصنيف', 'success');
    setShowDeleteModal(null);
    fetchCategories();
  };

  const resetForm = () => {
    setForm({ name_ar: '', name_en: '', slug: '', icon: '' });
    setEditingId(null);
    setShowForm(false);
  };

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
            <div key={cat.id} className={`card flex items-center gap-3 p-4 ${cat.is_hidden ? 'opacity-60' : ''}`}>
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
                  {cat.is_hidden && <span className="badge bg-ink-100 text-ink-500">مخفي</span>}
                </div>
                <p className="text-xs text-ink-400">
                  {cat.slug} • {bookCounts[cat.id] ?? 0} كتاب
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => handleToggleHidden(cat)}
                  className="rounded-lg p-2 text-ink-500 hover:bg-ink-100"
                  title={cat.is_hidden ? 'إظهار' : 'إخفاء'}
                >
                  {cat.is_hidden ? <Eye size={16} /> : <EyeOff size={16} />}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card max-w-md p-6">
            <h3 className="mb-2 flex items-center gap-2 font-bold text-ink-900">
              <Trash2 size={20} className="text-red-500" /> حذف التصنيف
            </h3>
            <p className="text-sm text-ink-600">
              هل أنت متأكد من حذف تصنيف "{showDeleteModal.name_ar}"؟
            </p>
            {booksInCategory.length > 0 ? (
              <div className="mt-4 rounded-xl bg-accent-50 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-accent-800">
                  <Move size={16} /> يوجد {booksInCategory.length} كتاب في هذا التصنيف
                </p>
                <p className="mt-1 text-xs text-accent-700">يرجى اختيار تصنيف لنقل الكتب إليه قبل الحذف:</p>
                <select
                  value={moveTarget}
                  onChange={(e) => setMoveTarget(e.target.value)}
                  className="input mt-2"
                >
                  <option value="">اختر تصنيف...</option>
                  {categories.filter((c) => c.id !== showDeleteModal.id).map((c) => (
                    <option key={c.id} value={c.id}>{c.name_ar}</option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="mt-4 text-sm text-ink-500">لا توجد كتب في هذا التصنيف. يمكن حذفه بأمان.</p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleDelete}
                disabled={booksInCategory.length > 0 && !moveTarget}
                className="btn-primary bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                تأكيد الحذف
              </button>
              <button onClick={() => setShowDeleteModal(null)} className="btn-ghost">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
