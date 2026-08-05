import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { useHashRoute } from '@/lib/router';
import type { Offer, OfferStatus } from '@/lib/types';
import { formatPrice, formatDate } from '@/lib/constants';
import { ImageUpload } from '@/components/ImageUpload';
import { AdminOfferBooks } from './AdminOfferBooks';
import { Plus, Pencil, Trash2, X, Search, Tag, Eye, EyeOff, ExternalLink, BarChart3, HelpCircle, Copy } from 'lucide-react';

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
};

function slugify(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function AdminOffers() {
  const { show } = useToast();
  const { route, navigate } = useHashRoute();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [analytics, setAnalytics] = useState<Record<string, { orders: number; revenue: number; books_sold: number; customers: number; top_books: { title: string; count: number }[] }>>({});
  const [showGuide, setShowGuide] = useState(false);
  const [managingOfferId, setManagingOfferId] = useState<string | null>(null);

  const fetchOffers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('offers').select('*').order('created_at', { ascending: false });
    setOffers((data as Offer[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  // Detect deep link to manage books for a specific offer
  useEffect(() => {
    const parts = route.split('/').filter(Boolean);
    if (parts[0] === 'admin' && parts[1] === 'offers' && parts[2] === 'manage' && parts[3]) {
      setManagingOfferId(parts[3]);
    } else {
      setManagingOfferId(null);
    }
  }, [route]);

  const fetchAnalytics = useCallback(async () => {
    if (offers.length === 0) return;
    const ids = offers.map((o) => o.id);
    const { data } = await supabase
      .from('order_items')
      .select('order_id, book_title, quantity, unit_price')
      .not('offer_id', 'is', null)
      .in('offer_id', ids);
    if (!data) return;
    const map: Record<string, { orders: Set<string>; revenue: number; books_sold: number; customers: Set<string>; top: Record<string, number> }> = {};
    for (const item of data as { order_id: string; book_title: string; quantity: number; unit_price: number; offer_id?: string }[]) {
      const oid = (item as { offer_id?: string }).offer_id;
      if (!oid) continue;
      if (!map[oid]) map[oid] = { orders: new Set(), revenue: 0, books_sold: 0, customers: new Set(), top: {} };
      map[oid].orders.add(item.order_id);
      map[oid].revenue += item.unit_price * item.quantity;
      map[oid].books_sold += item.quantity;
      map[oid].top[item.book_title] = (map[oid].top[item.book_title] ?? 0) + item.quantity;
    }
    // fetch customer counts
    const orderIds = Object.values(map).flatMap((m) => Array.from(m.orders));
    let custMap: Record<string, string[]> = {};
    if (orderIds.length > 0) {
      const { data: orders } = await supabase.from('orders').select('id, user_id').in('id', orderIds);
      custMap = {};
      for (const o of (orders ?? []) as { id: string; user_id: string }[]) {
        if (!custMap[o.id]) custMap[o.id] = [];
        custMap[o.id].push(o.user_id);
      }
    }
    const result: Record<string, { orders: number; revenue: number; books_sold: number; customers: number; top_books: { title: string; count: number }[] }> = {};
    for (const [oid, m] of Object.entries(map)) {
      const customers = new Set<string>();
      for (const orderId of m.orders) {
        for (const u of custMap[orderId] ?? []) customers.add(u);
      }
      const topBooks = Object.entries(m.top).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([title, count]) => ({ title, count }));
      result[oid] = { orders: m.orders.size, revenue: m.revenue, books_sold: m.books_sold, customers: customers.size, top_books: topBooks };
    }
    setAnalytics(result);
  }, [offers]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { show('يرجى إدخال اسم العرض', 'error'); return; }
    if (form.price_per_book <= 0) { show('يرجى إدخال سعر صحيح للكتاب', 'error'); return; }
    if (form.min_books < 1) { show('الحد الأدنى يجب أن يكون 1 على الأقل', 'error'); return; }
    const slug = form.slug.trim() || slugify(form.name);
    if (!slug) { show('يرجى إدخال رابط العرض', 'error'); return; }
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
    });
    setEditingId(offer.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا العرض؟ لن يتم حذف الكتب نفسها.')) return;
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

  if (managingOfferId) {
    const offer = offers.find((o) => o.id === managingOfferId);
    return <AdminOfferBooks offerId={managingOfferId} offer={offer} onBack={() => navigate('/admin/offers')} />;
  }

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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="label">اسم العرض *</label>
              <input value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value, slug: editingId ? form.slug : slugify(e.target.value) }); }} className="input" placeholder="كتب بـ 60 ج.م" />
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
          {filtered.map((offer) => {
            const a = analytics[offer.id];
            const isExpired = offer.end_at ? new Date(offer.end_at) < new Date() : false;
            const effectiveStatus = isExpired ? 'expired' : offer.status;
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
                    <p className="text-xs text-ink-500">الحد الأدنى: {offer.min_books} كتب{offer.max_books ? ` • الحد الأقصى: ${offer.max_books}` : ' • بلا حد أقصى'}</p>
                    {offer.start_at && <p className="text-xs text-ink-400">يبدأ: {formatDate(offer.start_at)}</p>}
                    {offer.end_at && <p className="text-xs text-ink-400">ينتهي: {formatDate(offer.end_at)}</p>}
                  </div>
                </div>
                {a && (
                  <div className="grid grid-cols-3 border-t border-ink-100 bg-ink-50/50 text-center text-xs">
                    <div className="border-l border-ink-100 p-2">
                      <p className="font-bold text-ink-900">{a.orders}</p>
                      <p className="text-ink-500">طلبات</p>
                    </div>
                    <div className="border-l border-ink-100 p-2">
                      <p className="font-bold text-ink-900">{a.books_sold}</p>
                      <p className="text-ink-500">كتب مبيعة</p>
                    </div>
                    <div className="p-2">
                      <p className="font-bold text-ink-900">{formatPrice(a.revenue)}</p>
                      <p className="text-ink-500">الإيرادات</p>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 border-t border-ink-100 p-3">
                  <button onClick={() => navigate(`/admin/offers/manage/${offer.id}`)} className="btn-outline text-xs">
                    <BookIcon /> إدارة الكتب
                  </button>
                  <button onClick={() => handleEdit(offer)} className="btn-outline text-xs">
                    <Pencil size={14} /> تعديل
                  </button>
                  <button onClick={() => navigate(`/offers/${offer.slug}`)} className="btn-outline text-xs">
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

function BookIcon() {
  return <span className="text-sm">📚</span>;
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
    'أدخل اسم العرض، مثال: كتب بـ 60 ج.م.',
    'حدد سعر الكتاب، مثال: 60.',
    'حدد الحد الأدنى للكتب، مثال: 5.',
    'اضغط "إنشاء".',
    'افتح "إدارة الكتب".',
    'اختر طريقة الإضافة: اختيار يدوي أو استيراد بالجملة.',
    'للاستيراد بالجملة، ارفع ملف CSV/TXT أو الصق أسماء الكتب.',
    'اضغط "معاينة".',
    'راجع: المطابقة، غير موجود، المكرر، المضاف سابقاً.',
    'اضغط "استيراد المطابق".',
    'راجع كتب العرض.',
    'فعّل العرض.',
    'انسخ الرابط العام واستخدمه على الموقع/السوشيال ميديا.',
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
