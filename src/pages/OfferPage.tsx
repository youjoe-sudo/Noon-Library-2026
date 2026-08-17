import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/lib/settings';
import { useToast } from '@/lib/toast';
import type { Offer } from '@/lib/types';
import { formatPrice } from '@/lib/constants';
import { Link } from '@/components/Link';
import { useSeo } from '@/lib/seo';
import { Search, Check, Tag, AlertCircle, ArrowLeft, MessageCircle, ChevronLeft } from 'lucide-react';

interface Props {
  slug: string;
}

export function OfferPage({ slug }: Props) {
  const { settings } = useSettings();
  const { show } = useToast();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [notFound, setNotFound] = useState(false);

  useSeo({
    title: offer ? `${offer.name} | ${settings.site_name || 'مكتبة نون'}` : 'عرض خاص | مكتبة نون',
    description: offer?.description ?? `عرض خاص على الكتب - ${offer?.name ?? ''}`,
    image: offer?.cover_image ?? undefined,
    type: 'article',
  });

  useEffect(() => {
    (async () => {
      console.log('Original slug prop:', slug);
    console.log('Decoded slug:', decodeURIComponent(slug));
      setLoading(true);
      setNotFound(false);

      // 1. فك تشفير الـ slug لمعالجة الحروف العربية
      let decodedSlug = slug;
      try {
        decodedSlug = decodeURIComponent(slug);
      } catch (e) {
        console.error('Failed to decode slug', e);
      }

      // 2. الاستعلام عن العرض باستخدام الـ decodedSlug والـ slug الأصلي لضمان التوافق
      const { data: offerData, error } = await supabase
        .from('offers')
        .select('*')
        .or(`slug.eq.${decodedSlug},slug.eq.${slug},id.eq.${slug}`)
        .maybeSingle();

      if (error) {
        console.error('Supabase fetch error:', error);
      }

      if (!offerData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setOffer(offerData as Offer);
      setLoading(false);
    })();
  }, [slug]);

  const bookList = offer?.book_list ?? [];

  const filtered = useMemo(() => {
    if (!search.trim()) return bookList.map((name, i) => ({ name, index: i }));
    const q = search.trim().toLowerCase();
    return bookList
      .map((name, i) => ({ name, index: i }))
      .filter((b) => b.name.toLowerCase().includes(q));
  }, [bookList, search]);

  const selectedCount = selectedIndices.size;
  const subtotal = offer ? selectedCount * offer.price_per_book : 0;
  const minReached = offer ? selectedCount >= offer.min_books : false;
  const maxReached = offer && offer.max_books ? selectedCount >= offer.max_books : false;

  const toggleBook = (index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        if (maxReached) {
          show(`الحد الأقصى ${offer?.max_books} كتب`, 'error');
          return prev;
        }
        next.add(index);
      }
      return next;
    });
  };

  const handleWhatsAppOrder = () => {
    if (!offer) return;
    if (!minReached) {
      show(`يرجى اختيار ${offer.min_books} كتب على الأقل قبل الطلب`, 'error');
      return;
    }

    const selectedBooks = Array.from(selectedIndices).sort((a, b) => a - b).map((i) => bookList[i]);

    const message = [
      'مرحبًا، أريد طلب العرض التالي:',
      '',
      'العرض:',
      offer.name,
      '',
      'سعر الكتاب:',
      `${offer.price_per_book} جنيه`,
      '',
      'عدد الكتب:',
      String(selectedCount),
      '',
      'الكتب المختارة:',
      ...selectedBooks.map((name, i) => `${i + 1}. ${name}`),
      '',
      'الإجمالي التقريبي:',
      `${subtotal} جنيه`,
      '',
      'أرغب في إتمام طلب العرض عبر واتساب.',
    ].join('\n');

    const phone = (settings.whatsapp_number || '').replace(/\D/g, '');
    if (!phone) {
      show('رقم واتساب غير مُعد. يرجى التواصل مع الإدارة.', 'error');
      return;
    }
    const url = `https://wa.me/2${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="skeleton h-64 w-full" />
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => <div key={i} className="skeleton h-32 w-full" />)}
        </div>
      </div>
    );
  }

  if (notFound || !offer) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <Tag size={48} className="mx-auto text-ink-300" />
        <h2 className="mt-4 text-xl font-bold text-ink-900">العرض غير موجود</h2>
        <Link to="/" className="btn-primary mt-4">العودة للرئيسية</Link>
      </div>
    );
  }

  const isExpired = offer.end_at ? new Date(offer.end_at) < new Date() : false;
  const isNotActive = offer.status !== 'active';

  if (isExpired || isNotActive) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <AlertCircle size={48} className="mx-auto text-ink-300" />
        <h2 className="mt-4 text-xl font-bold text-ink-900">هذا العرض غير متاح حالياً</h2>
        <p className="mt-2 text-ink-500">انتهت صلاحية العرض أو لم يعد نشطاً.</p>
        <Link to="/offers" className="btn-primary mt-4">تصفح العروض الأخرى</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 pb-32 lg:pb-8">
      {/* Breadcrumbs */}
      <nav className="mb-4 flex items-center gap-1 text-sm text-ink-500">
        <Link to="/" className="hover:text-primary-600">الرئيسية</Link>
        <ChevronLeft size={14} />
        <Link to="/offers" className="hover:text-primary-600">العروض</Link>
        <ChevronLeft size={14} />
        <span className="font-semibold text-ink-700">{offer.name}</span>
      </nav>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-700 to-primary-900 text-white shadow-card">
        {offer.cover_image && (
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `url(${offer.cover_image})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
        )}
        <div className="relative p-6 sm:p-10">
          <Link to="/offers" className="mb-4 inline-flex items-center gap-1 text-sm text-primary-100 hover:text-white">
            <ArrowLeft size={16} /> العروض
          </Link>
          <h1 className="font-serif text-3xl font-bold sm:text-4xl">{offer.name}</h1>
          {offer.description && <p className="mt-3 max-w-2xl text-primary-100">{offer.description}</p>}
          <div className="mt-5 flex flex-wrap gap-4">
            <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur">
              <p className="text-xs text-primary-100">السعر لكل كتاب</p>
              <p className="text-xl font-bold">{formatPrice(offer.price_per_book)}</p>
            </div>
            <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur">
              <p className="text-xs text-primary-100">الحد الأدنى</p>
              <p className="text-xl font-bold">{offer.min_books} كتب</p>
            </div>
            {offer.max_books && (
              <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur">
                <p className="text-xs text-primary-100">الحد الأقصى</p>
                <p className="text-xl font-bold">{offer.max_books} كتب</p>
              </div>
            )}
            <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur">
              <p className="text-xs text-primary-100">الكتب المتاحة</p>
              <p className="text-xl font-bold">{bookList.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Ordering info */}
      <div className="mt-4 rounded-xl border border-accent-200 bg-accent-50 p-4 text-sm text-accent-800">
        <p className="font-semibold">طريقة الطلب: عبر واتساب فقط</p>
        <p className="mt-1 text-accent-700">اختر الكتب التي تريدها من القائمة، ثم اضغط "اطلب عبر واتساب" لإتمام الطلب.</p>
      </div>

      {/* Search */}
      <div className="sticky top-16 z-30 mt-6">
        <div className="relative">
          <Search size={20} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث في كتب العرض..."
            className="input pr-10 shadow-sm"
          />
        </div>
      </div>

      {/* Book selection list */}
      <div className="mt-4">
        <h2 className="mb-3 text-lg font-bold text-ink-900">اختر كتبك</h2>
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-ink-500">لا توجد كتب مطابقة للبحث.</div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(({ name, index }) => {
              const isSelected = selectedIndices.has(index);
              return (
                <button
                  key={index}
                  onClick={() => toggleBook(index)}
                  className={`flex items-center gap-3 rounded-xl border-2 p-3 text-right transition-all ${
                    isSelected ? 'border-primary-500 bg-primary-50 shadow-soft' : 'border-ink-100 bg-white hover:border-primary-300'
                  }`}
                >
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                    isSelected ? 'border-primary-600 bg-primary-600 text-white' : 'border-ink-300'
                  }`}>
                    {isSelected && <Check size={14} />}
                  </div>
                  <span className="flex-1 text-sm font-medium text-ink-900">{name}</span>
                  <span className="text-xs font-bold text-primary-700">{formatPrice(offer.price_per_book)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Sticky summary bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-ink-100 bg-white/95 backdrop-blur-md lg:sticky lg:bottom-0 lg:top-16 lg:mt-6 lg:border lg:rounded-2xl lg:shadow-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold ${minReached ? 'bg-primary-600 text-white' : 'bg-ink-100 text-ink-600'}`}>
              {selectedCount}
            </div>
            <div>
              <p className="text-sm font-bold text-ink-900">
                {selectedCount} كتاب مختار
                {!minReached && offer && <span className="text-red-500"> (الحد الأدنى {offer.min_books})</span>}
              </p>
              <p className="text-lg font-bold text-primary-700">{formatPrice(subtotal)}</p>
            </div>
          </div>
          <button
            onClick={handleWhatsAppOrder}
            disabled={!minReached}
            className="btn-primary"
          >
            <MessageCircle size={18} />
            اطلب عبر واتساب
          </button>
        </div>
      </div>
    </div>
  );
}
