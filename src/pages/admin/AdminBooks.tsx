import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import type { Book, Category } from '@/lib/types';
import { formatPrice } from '@/lib/constants';
import { Plus, Pencil, Trash2, X, Search, Star, Sparkles, TrendingUp, BookOpen } from 'lucide-react';
import { ImageUpload } from '@/components/ImageUpload';

const EMPTY_BOOK: Partial<Book> = {
  title: '', author: '', publisher: '', price: 0, discount_price: null,
  stock: 0, stock_threshold: 5, cover_url: '', description: '', commission_rate: 10,
  is_bestseller: false, is_recommended: false, is_new_release: false, is_high_commission: false,
};

export function AdminBooks() {
  const { show } = useToast();
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Book>>(EMPTY_BOOK);

  const fetchBooks = async () => {
    const { data } = await supabase.from('books').select('*, category:categories(*)').order('created_at', { ascending: false });
    setBooks((data as Book[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    supabase.from('categories').select('*').order('sort_order').then(({ data }) => setCategories((data as Category[]) ?? []));
    fetchBooks();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || form.price == null || form.price === undefined) { show('يرجى إدخال الاسم والسعر', 'error'); return; }
    const payload = {
      ...form,
      discount_price: form.discount_price == null || form.discount_price === 0 ? null : Number(form.discount_price),
      price: Number(form.price),
      commission_rate: Number(form.commission_rate),
      stock: Number(form.stock),
      stock_threshold: Number(form.stock_threshold),
    };
    if (editingId) {
      const { error } = await supabase.from('books').update(payload).eq('id', editingId);
      if (error) { show('فشل التحديث', 'error');
          show(
    error.message || 'فشل تحديث الكتاب',
    'error'
  );
        return; }
      show('تم تحديث الكتاب', 'success');
    } else {
      const { error } = await supabase.from('books').insert(payload);
      if (error) { show('فشل الإضافة', 'error'); return; }
      show('تمت إضافة الكتاب', 'success');
    }
    resetForm();
    fetchBooks();
  };

  const handleEdit = (book: Book) => {
    const { category, ...bookData } = book
    setForm({ ...bookData });
    setEditingId(book.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الكتاب؟')) return;
    const { error } = await supabase.from('books').delete().eq('id', id);
    if (error) { show('فشل الحذف', 'error'); return; }
    show('تم حذف الكتاب', 'success');
    fetchBooks();
  };

  const resetForm = () => {
    setForm(EMPTY_BOOK);
    setEditingId(null);
    setShowForm(false);
  };

  const filtered = books.filter((b) =>
    b.title.toLowerCase().includes(search.toLowerCase()) ||
    (b.author?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-ink-900">إدارة الكتب ({books.length})</h2>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary">
          <Plus size={18} /> إضافة كتاب
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold text-ink-900">{editingId ? 'تعديل كتاب' : 'كتاب جديد'}</h3>
            <button type="button" onClick={resetForm} className="text-ink-400 hover:text-ink-600"><X size={20} /></button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="label">عنوان الكتاب *</label>
              <input value={form.title ?? ''} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">المؤلف</label>
              <input value={form.author ?? ''} onChange={(e) => setForm({ ...form, author: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">الناشر</label>
              <input value={form.publisher ?? ''} onChange={(e) => setForm({ ...form, publisher: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">التصنيف</label>
              <select value={form.category_id ?? ''} onChange={(e) => setForm({ ...form, category_id: e.target.value || null })} className="input">
                <option value="">بدون تصنيف</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
              </select>
            </div>
            <div>
              <label className="label">السعر (ج.م) *</label>
              <input type="number" value={form.price ?? 0} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} className="input" step="0.01" />
            </div>
            <div>
              <label className="label">سعر الخصم (اختياري)</label>
              <input type="number" value={form.discount_price ?? ''} onChange={(e) => setForm({ ...form, discount_price: e.target.value ? parseFloat(e.target.value) : null })} className="input" step="0.01" />
            </div>
            <div>
              <label className="label">المخزون</label>
              <input type="number" value={form.stock ?? 0} onChange={(e) => setForm({ ...form, stock: parseInt(e.target.value) || 0 })} className="input" />
            </div>
            <div>
              <label className="label">حد التنبيه</label>
              <input type="number" value={form.stock_threshold ?? 5} onChange={(e) => setForm({ ...form, stock_threshold: parseInt(e.target.value) || 5 })} className="input" />
            </div>
            <div>
              <label className="label">نسبة العمولة (%)</label>
              <input type="number" value={form.commission_rate ?? 10} onChange={(e) => setForm({ ...form, commission_rate: parseFloat(e.target.value) || 10 })} className="input" step="0.01" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <ImageUpload value={form.cover_url ?? ''} onChange={(url) => setForm({ ...form, cover_url: url })} />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="label">الوصف</label>
              <textarea value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input min-h-24" />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-4">
            {([
              ['is_bestseller', 'الأكثر مبيعاً', <Star size={16} key="s" />],
              ['is_recommended', 'موصى به', <BookOpen size={16} key="r" />],
              ['is_new_release', 'إصدار جديد', <Sparkles size={16} key="n" />],
              ['is_high_commission', 'عمولة مرتفعة', <TrendingUp size={16} key="h" />],
            ] as const).map(([key, label, icon]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form[key] as boolean ?? false} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} className="accent-primary-600" />
                <span className="font-semibold text-ink-700">{icon} {label}</span>
              </label>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" className="btn-primary">{editingId ? 'تحديث' : 'إضافة'}</button>
            <button type="button" onClick={resetForm} className="btn-ghost">إلغاء</button>
          </div>
        </form>
      )}

      <div className="relative">
        <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث عن كتاب..." className="input pr-10" />
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-16 w-full" />)}</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((book) => (
            <div key={book.id} className="card flex items-center gap-4 p-3">
              <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-ink-100">
                {book.cover_url && <img src={book.cover_url} alt={book.title} className="h-full w-full object-cover" />}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-ink-900">{book.title}</p>
                <p className="text-xs text-ink-500">{book.author} • {book.category?.name_ar ?? 'بدون تصنيف'}</p>
                <div className="mt-1 flex items-center gap-2 text-xs">
                  <span className="font-bold text-primary-700">{formatPrice(book.discount_price ?? book.price)}</span>
                  <span className={`badge ${book.stock <= book.stock_threshold ? 'bg-red-100 text-red-700' : 'bg-primary-100 text-primary-700'}`}>
                    مخزون: {book.stock}
                  </span>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => handleEdit(book)} className="rounded-lg p-2 text-ink-500 hover:bg-ink-100"><Pencil size={16} /></button>
                <button onClick={() => handleDelete(book.id)} className="rounded-lg p-2 text-red-500 hover:bg-red-50"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
