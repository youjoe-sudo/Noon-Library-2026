import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/lib/cart';
import { useToast } from '@/lib/toast';
import { useAuth } from '@/lib/auth';
import type { Offer, Book } from '@/lib/types';
import { formatPrice } from '@/lib/constants';
import { Link } from '@/components/Link';
import { Search, Check, ShoppingCart, Loader2, Tag, AlertCircle, ArrowLeft } from 'lucide-react';

interface Props {
  slug: string;
}

export function OfferPage({ slug }: Props) {
  const { profile } = useAuth();
  const { offerSelections, toggleOfferBook, setOfferSelection } = useCart();
  const { show } = useToast();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: offerData } = await supabase.from('offers').select('*').eq('slug', slug).maybeSingle();
      if (!offerData) { setNotFound(true); setLoading(false); return; }
      const o = offerData as Offer;
      setOffer(o);
      const { data: obData } = await supabase
        .from('offer_books')
        .select('book:books(*)')
        .eq('offer_id', o.id)
        .order('display_order', { ascending: true });
      const bs = ((obData as unknown as { book: Book }[]) ?? []).map((r) => r.book).filter(Boolean) as Book[];
      setBooks(bs);
      setLoading(false);
    })();
  }, [slug]);

  const selectedIds = offer ? (offerSelections[offer.id] ?? []) : [];
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedCount = selectedIds.length;
  const subtotal = offer ? selectedCount * offer.price_per_book : 0;
  const minReached = offer ? selectedCount >= offer.min_books : false;
  const maxReached = offer && offer.max_books ? selectedCount >= offer.max_books : false;

  const filtered = books.filter((b) =>
    b.title.toLowerCase().includes(search.toLowerCase()) ||
    (b.author?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  const handleAddToCart = async () => {
    if (!offer) return;
    if (!minReached) { show(`الحد الأدنى ${offer.min_books} كتب`, 'error'); return; }
    if (!profile) { show('يرجى تسجيل الدخول لإضافة العرض إلى السلة', 'info'); return; }

    setAdding(true);
    try {
      const { data: vData, error } = await supabase.rpc('validate_offer_cart', { p_offer_id: offer.id, p_book_ids: selectedIds });
      if (error) throw error;
      const v = vData as { valid: boolean; error?: string };
      if (!v.valid) { show(v.error ?? 'فشل التحقق من العرض', 'error'); return; }
      show(`تمت إضافة عرض "${offer.name}" إلى السلة (${selectedCount} كتاب)`, 'success');
    } catch {
      show('فشل إضافة العرض إلى السلة', 'error');
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="skeleton h-64 w-full" />
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => <div key={i} className="skeleton h-48 w-full" />)}
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
        <Link to="/" className="btn-primary mt-4">تصفح الكتب</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 pb-32 lg:pb-8">
      {/* Offer header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-700 to-primary-900 text-white shadow-card">
        {offer.cover_image && (
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `url(${offer.cover_image})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
        )}
        <div className="relative p-6 sm:p-10">
          <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-primary-100 hover:text-white">
            <ArrowLeft size={16} /> العودة للرئيسية
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
              <p className="text-xl font-bold">{books.length}</p>
            </div>
          </div>
        </div>
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

      {/* Books grid */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {filtered.map((book) => {
          const isSelected = selectedSet.has(book.id);
          const outOfStock = book.stock <= 0;
          const disabled = outOfStock || (!isSelected && maxReached);
          return (
            <button
              key={book.id}
              onClick={() => !disabled && toggleOfferBook(offer.id, book.id)}
              disabled={disabled}
              className={`group relative flex flex-col overflow-hidden rounded-xl border-2 text-right transition-all ${
                isSelected ? 'border-primary-500 bg-primary-50 shadow-soft' : 'border-ink-100 bg-white hover:border-primary-300'
              } ${disabled ? 'opacity-50' : 'cursor-pointer'}`}
            >
              <div className="relative aspect-[3/4] overflow-hidden bg-ink-100">
                {book.cover_url ? (
                  <img src={book.cover_url} alt={book.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center bg-primary-50">
                    <span className="font-serif text-3xl text-primary-300">ن</span>
                  </div>
                )}
                {isSelected && (
                  <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg">
                    <Check size={16} />
                  </div>
                )}
                {outOfStock && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <span className="rounded-lg bg-red-500 px-3 py-1 text-xs font-bold text-white">غير متوفر</span>
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col p-2">
                <p className="line-clamp-2 text-xs font-semibold text-ink-900">{book.title}</p>
                {book.author && <p className="mt-0.5 line-clamp-1 text-xs text-ink-500">{book.author}</p>}
                <p className="mt-1 text-sm font-bold text-primary-700">{formatPrice(offer.price_per_book)}</p>
              </div>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="py-12 text-center text-ink-500">لا توجد كتب مطابقة للبحث.</div>
      )}

      {/* Sticky bottom summary (mobile + desktop) */}
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
            onClick={handleAddToCart}
            disabled={!minReached || adding}
            className="btn-primary"
          >
            {adding ? <Loader2 size={18} className="animate-spin" /> : <ShoppingCart size={18} />}
            إضافة العرض للسلة
          </button>
        </div>
      </div>
    </div>
  );
}
