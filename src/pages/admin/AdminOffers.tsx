import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import type { Offer, OfferStatus } from '@/lib/types';
import { formatPrice, formatDate } from '@/lib/constants';
import { ImageUpload } from '@/components/ImageUpload';
import { Plus, Pencil, Trash2, X, Search, Tag, Eye, EyeOff, ExternalLink, HelpCircle, Copy, ArrowUp, ArrowDown, ListChecks } from 'lucide-react';

const EMPTY_FORM = {
  name: '',
  slug: '',
  description: '',
  cover_image: '',
  price_per_book: 0,
  min_books: 1,
  max_books: '' as number | '',
  start_at: '',
  end_at: '',
  status: 'draft' as OfferStatus,
  display_order: 0,
  book_list_text: '',
};

function slugify(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function parseBookList(text: string): string[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const line of lines) {
    if (!seen.has(line)) {
      seen.add(line);
      result.push(line);
    }
  }
  return result;
}

export function AdminOffers() {
  const { show } = useToast();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [showGuide, setShowGuide] = useState(false);

  const fetchOffers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('offers').select('*').order('display_order', { ascending: true });
    setOffers((data as Offer[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { show('يرجى إدخال اسم العرض', 'error'); return; }
    if (form.price_per_book <= 0) { show('يرجى إدخال سعر صحيح للكتاب', 'error'); return; }
    if (form.min_books < 1) { show('الحد الأدنى يجب أن يكون 1 على الأقل', 'error'); return; }
    const slug = form.slug.trim() || slugify(form.name);
    if (!slug) { show('يرجى إدخال رابط العرض', 'error'); return; }

    const bookList = parseBookList(form.book_list_text);

    const payload = {
      name: form.name.trim(),
      slug,
      description: form.description.trim() || null,
      cover_image: form.cover_image || null,
      price_per_book: Number(form.price_per_book),
      min_books: Number(form.min_books),
      max_books: form.max_books === '' ? null : Number(form.max_books),
      start_at: form.start_at ? new Date(form.start_at).toISOString() : null,
      end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
      status: form.status,
      display_order: Number(form.display_order),
      book_list: bookList,
    };
    if (editingId) {
      const { error } = await supabase.from('offers').update(payload).eq('id', editingId);
      if (error) { show(error.message.includes('unique') ? 'الرابط مستخدم من قبل' : 'فشل التحديث', 'error'); return; }
      show('تم تحديث العرض', 'success');
    } else {
      const { error } = await supabase.from('offers').insert(payload);
      if (error) { show(error.message.includes('unique') ? 'الرابط مستخدم من قبل' : 'فشل الإنشاء', 'error'); return; }
      show('تم إنشاء العرض', 'success');
    }
    resetForm();
    fetchOffers();
  };

  const handleEdit = (offer: Offer) => {
    setForm({
      name: offer.name,
      slug: offer.slug,
      description: offer.description ?? '',
      cover_image: offer.cover_image ?? '',
      price_per_book: offer.price_per_book,
      min_books: offer.min_books,
      max_books: offer.max_books ?? '',
      start_at: offer.start_at ? offer.start_at.slice(0, 16) : '',
      end_at: offer.end_at ? offer.end_at.slice(0, 16) : '',
      status: offer.status,
      display_order: offer.display_order,
      book_list_text: (offer.book_list ?? []).join('\n'),
    });
    setEditingId(offer.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا العرض؟')) return;
    const { error } = await supabase.from('offers').delete().eq('id', id);
    if (error) { show('فشل الحذف', 'error'); return; }
    show('تم حذف العرض', 'success');
    fetchOffers();
  };

  const toggleStatus = async (offer: Offer) => {
    const next: OfferStatus = offer.status === 'active' ? 'inactive' : 'active';
    const { error } = await supabase.from('offers').update({ status: next }).eq('id', offer.id);
    if (error) { show('فشل تحديث الحالة', 'error'); return; }
    show(next === 'active' ? 'تم تفعيل العرض' : 'تم إيقاف العرض', 'success');
    fetchOffers();
  };

  const moveOrder = async (offer: Offer, direction: 'up' | 'down') => {
    const sorted = [...offers].sort((a, b) => a.display_order - b.display_order);
    const idx = sorted.findIndex((o) => o.id === offer.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[swapIdx];
    await Promise.all([
      supabase.from('offers').update({ display_order: b.display_order }).eq('id', a.id),
      supabase.from('offers').update({ display_order: a.display_order }).eq('id', b.id),
    ]);
    fetchOffers();
  };

  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setShowForm(false);
  };

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}${window.location.pathname}#/offers/${slug}`;
    navigator.clipboard.writeText(url).then(() => show('تم نسخ الرابط', 'success'));
  };

  const filtered = offers.filter((o) => o.name.toLowerCase().includes(search.toLowerCase()) || o.slug.toLowerCase().includes(search.toLowerCase()));
  const previewBooks = parseBookList(form.book_list_text);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold text-ink-900">إدارة العروض ({offers.length})</h2>
        <div className="flex gap-2">
          <button onClick={() => setShowGuide(true)} className="btn-outline">
            <HelpCircle size={18} /> كيف أنشئ عرضاً؟
          </button>
          <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary">
            <Plus size={18} /> إنشاء عرض جديد
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold text-ink-900">{editingId ? 'تعديل عرض' : 'عرض جديد'}</h3>
            <button type="button" onClick={resetForm} className="text-ink-400 hover:text-ink-600"><X size={20} /></button>
          </div>

          {/* Offer Information */}
          <h4 className="mb-3 text-sm font-bold text-primary-700">معلومات العرض</h4>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="label">اسم العرض *</label>
              <input value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value, slug: editingId ? form.slug : slugify(e.target.value) }); }} className="input" placeholder="عرض الكتب بـ 60 جنيه" />
            </div>
            <div>
              <label className="label">رابط العرض (slug) *</label>
              <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="input" dir="ltr" placeholder="books-for-60" />
            </div>
            <div>
              <label className="label">السعر لكل كتاب (ج.م) *</label>
              <input type="number" value={form.price_per_book} onChange={(e) => setForm({ ...form, price_per_book: parseFloat(e.target.value) || 0 })} className="input" step="0.01" />
            </div>
            <div>
              <label className="label">الحد الأدنى للكتب *</label>
              <input type="number" value={form.min_books} onChange={(e) => setForm({ ...form, min_books: parseInt(e.target.value) || 1 })} className="input" min="1" />
            </div>
            <div>
              <label className="label">الحد الأقصى (اختياري)</label>
              <input type="number" value={form.max_books} onChange={(e) => setForm({ ...form, max_books: e.target.value ? parseInt(e.target.value) : '' })} className="input" min="1" />
            </div>
            <div>
              <label className="label">ترتيب العرض</label>
              <input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })} className="input" />
            </div>
            <div>
              <label className="label">تاريخ البداية (اختياري)</label>
              <input type="datetime-local" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">تاريخ النهاية (اختياري)</label>
              <input type="datetime-local" value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">الحالة</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as OfferStatus })} className="input">
                <option value="draft">مسودة</option>
                <option value="active">نشط</option>
                <option value="inactive">متوقف</option>
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <ImageUpload value={form.cover_image} onChange={(url) => setForm({ ...form, cover_image: url })} label="صورة غلاف العرض" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="label">الوصف</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input min-h-24" placeholder="اختر كتبك المفضلة من قائمة العرض..." />
            </div>
          </div>

          {/* Manual Book List */}
          <h4 className="mb-3 mt-6 text-sm font-bold text-primary-700">قائمة الكتب (يدوياً)</h4>
          <p className="mb-2 text-xs text-ink-500">أدخل اسم كتاب واحد في كل سطر. سيتم حفظ الترتيب كما هو وحذف الأسطر الفارغة والمكررة تلقائياً.</p>
          <textarea
            value={form.book_list_text}
            onChange={(e) => setForm({ ...form, book_list_text: e.target.value })}
            className="input min-h-48 font-mono text-sm"
            placeholder={"أنت أيضا صحابيه\nجلسات نفسيه\nرسائل من عمر\nدليل جدتي\n..."}
          />

          {/* Preview */}
          {previewBooks.length > 0 && (
            <div className="mt-3 rounded-xl border border-ink-100 bg-ink-50/50 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold text-ink-700">
                <ListChecks size={16} /> معاينة القائمة: {previewBooks.length} كتاب
              </div>
              <div className="max-h-48 overflow-y-auto">
                <ol className="space-y-1 text-sm text-ink-600">
                  {previewBooks.map((name, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="font-bold text-primary-600">{i + 1}.</span>
                      <span>{name}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button type="submit" className="btn-primary">{editingId ? 'تحديث' : 'إنشاء'}</button>
            <button type="button" onClick={resetForm} className="btn-ghost">إلغاء</button>
          </div>
        </form>
      )}

      <div className="relative">
        <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث عن عرض..." className="input pr-10" />
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-32 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Tag size={48} className="mx-auto text-ink-300" />
          <p className="mt-4 text-ink-500">لا توجد عروض بعد. ابدأ بإنشاء عرض جديد.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((offer, i) => {
            const isExpired = offer.end_at ? new Date(offer.end_at) < new Date() : false;
            const effectiveStatus = isExpired ? 'expired' : offer.status;
            const bookCount = (offer.book_list ?? []).length;
            return (
              <div key={offer.id} className="card overflow-hidden">
                <div className="flex gap-4 p-4">
                  <div className="h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-ink-100">
                    {offer.cover_image ? (
                      <img src={offer.cover_image} alt={offer.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-primary-50">
                        <Tag size={24} className="text-primary-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-ink-900">{offer.name}</h3>
                      <StatusBadge status={effectiveStatus} />
                    </div>
                    <p className="mt-1 text-sm font-bold text-primary-700">{formatPrice(offer.price_per_book)} / كتاب</p>
                    <p className="text-xs text-ink-500">الحد الأدنى: {offer.min_books} كتب{offer.max_books ? ` • الحد الأقصى: ${offer.max_books}` : ''}</p>
                    <p className="text-xs text-ink-500">{bookCount} كتاب في القائمة • ترتيب: {offer.display_order}</p>
                    {offer.start_at && <p className="text-xs text-ink-400">يبدأ: {formatDate(offer.start_at)}</p>}
                    {offer.end_at && <p className="text-xs text-ink-400">ينتهي: {formatDate(offer.end_at)}</p>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 border-t border-ink-100 p-3">
                  <button onClick={() => moveOrder(offer, 'up')} disabled={i === 0} className="btn-outline text-xs disabled:opacity-30">
                    <ArrowUp size={14} /> أعلى
                  </button>
                  <button onClick={() => moveOrder(offer, 'down')} disabled={i === filtered.length - 1} className="btn-outline text-xs disabled:opacity-30">
                    <ArrowDown size={14} /> أسفل
                  </button>
                  <button onClick={() => handleEdit(offer)} className="btn-outline text-xs">
                    <Pencil size={14} /> تعديل
                  </button>
                  <button onClick={() => window.location.hash = `/offers/${offer.slug}`} className="btn-outline text-xs">
                    <ExternalLink size={14} /> معاينة
                  </button>
                  <button onClick={() => toggleStatus(offer)} className="btn-outline text-xs">
                    {offer.status === 'active' ? <><EyeOff size={14} /> إيقاف</> : <><Eye size={14} /> تفعيل</>}
                  </button>
                  <button onClick={() => copyLink(offer.slug)} className="btn-outline text-xs">
                    <Copy size={14} /> نسخ الرابط
                  </button>
                  <button onClick={() => handleDelete(offer.id)} className="btn-danger text-xs">
                    <Trash2 size={14} /> حذف
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showGuide && <GuideModal onClose={() => setShowGuide(false)} />}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-primary-100 text-primary-700',
    inactive: 'bg-ink-200 text-ink-600',
    draft: 'bg-accent-100 text-accent-700',
    expired: 'bg-red-100 text-red-700',
  };
  const labels: Record<string, string> = {
    active: 'نشط',
    inactive: 'متوقف',
    draft: 'مسودة',
    expired: 'منتهي',
  };
  return <span className={`badge ${map[status] ?? ''}`}>{labels[status] ?? status}</span>;
}

function GuideModal({ onClose }: { onClose: () => void }) {
  const steps = [
    'اضغط "إنشاء عرض جديد".',
    'أدخل اسم العرض، مثال: عرض الكتب بـ 60 جنيه.',
    'حدد سعر الكتاب، مثال: 60.',
    'حدد الحد الأدنى للكتب، مثال: 5.',
    'في حقل "قائمة الكتب"، الصق أسماء الكتب (كتاب واحد في كل سطر).',
    'راجع المعاينة: عدد الكتب والترتيب.',
    'ارفع صورة غلاف العرض.',
    'اكتب وصفاً للعرض.',
    'اضبط الحالة على "نشط".',
    'اضغط "إنشاء".',
    'سيظهر العرض تلقائياً على الصفحة الرئيسية للعملاء.',
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="card max-h-[80vh] w-full max-w-lg overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-bold text-ink-900"><HelpCircle size={20} /> كيف أنشئ عرضاً؟</h3>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600"><X size={20} /></button>
        </div>
        <ol className="space-y-2">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3 text-sm text-ink-700">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">{i + 1}</span>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
