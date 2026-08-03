import { useEffect, useState } from 'react';
import { Link } from '@/components/Link';
import { BookCard } from '@/components/BookCard';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/lib/cart';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import type { Book, Category } from '@/lib/types';
import { getEffectivePrice, getDiscountPercent, formatPrice } from '@/lib/constants';
import { ShoppingCart, Heart, Minus, Plus, Star, Truck, ShieldCheck, BookOpen, ArrowRight } from 'lucide-react';

export function BookDetailPage({ id }: { id: string }) {
  const { profile } = useAuth();
  const { addToCart } = useCart();
  const { show } = useToast();
  const [book, setBook] = useState<Book | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [related, setRelated] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('books')
        .select('*, category:categories(*)')
        .eq('id', id)
        .maybeSingle();
      if (data) {
        const b = data as Book;
        setBook(b);
        setCategory(b.category ?? null);
        if (b.category_id) {
          const { data: rel } = await supabase
            .from('books')
            .select('*, category:categories(*)')
            .eq('category_id', b.category_id)
            .neq('id', id)
            .limit(5);
          setRelated((rel as Book[]) ?? []);
        }
      }
      if (profile) {
        const { data: wl } = await supabase
          .from('wishlist_items')
          .select('id')
          .eq('user_id', profile.id)
          .eq('book_id', id)
          .maybeSingle();
        setIsWishlisted(!!wl);
      }
      setLoading(false);
    })();
  }, [id, profile]);

  const handleAddToCart = async () => {
    if (!book) return;
    setAdding(true);
    await addToCart(book.id, quantity);
    setAdding(false);
  };

  const toggleWishlist = async () => {
    if (!profile) {
      show('يرجى تسجيل الدخول لإضافة الكتب للمفضلة', 'info');
      return;
    }
    if (isWishlisted) {
      await supabase.from('wishlist_items').delete().eq('user_id', profile.id).eq('book_id', id);
      setIsWishlisted(false);
      show('تمت الإزالة من المفضلة', 'success');
    } else {
      await supabase.from('wishlist_items').insert({ user_id: profile.id, book_id: id });
      setIsWishlisted(true);
      show('تمت الإضافة إلى المفضلة', 'success');
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-8 md:grid-cols-[300px_1fr]">
          <div className="skeleton aspect-[3/4]" />
          <div className="space-y-4">
            <div className="skeleton h-8 w-3/4" />
            <div className="skeleton h-4 w-1/2" />
            <div className="skeleton h-24 w-full" />
            <div className="skeleton h-10 w-1/3" />
          </div>
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <BookOpen size={48} className="mx-auto text-ink-300" />
        <h2 className="mt-4 text-xl font-bold text-ink-900">الكتاب غير موجود</h2>
        <Link to="/" className="btn-primary mt-4">العودة للرئيسية</Link>
      </div>
    );
  }

  const price = getEffectivePrice(book);
  const discount = getDiscountPercent(book);
  const outOfStock = book.stock <= 0;
  const lowStock = book.stock > 0 && book.stock <= book.stock_threshold;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-ink-500">
        <Link to="/" className="hover:text-primary-600">الرئيسية</Link>
        <ArrowRight size={14} />
        {category && (
          <>
            <Link to={`/category/${category.slug}`} className="hover:text-primary-600">{category.name_ar}</Link>
            <ArrowRight size={14} />
          </>
        )}
        <span className="text-ink-900">{book.title}</span>
      </nav>

      <div className="grid gap-8 md:grid-cols-[300px_1fr] lg:grid-cols-[350px_1fr]">
        {/* Cover */}
        <div>
          <div className="card overflow-hidden">
            <div className="relative aspect-[3/4] bg-ink-100">
              {book.cover_url ? (
                <img src={book.cover_url} alt={book.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center bg-primary-50">
                  <span className="font-serif text-6xl text-primary-300">ن</span>
                </div>
              )}
              {discount > 0 && (
                <span className="absolute right-3 top-3 badge bg-accent-500 text-ink-950 shadow">
                  {discount}%-
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Info */}
        <div>
          {category && (
            <Link to={`/category/${category.slug}`} className="badge bg-primary-50 text-primary-700">
              {category.name_ar}
            </Link>
          )}
          <h1 className="mt-3 font-serif text-3xl font-bold text-ink-900">{book.title}</h1>
          {book.author && (
            <p className="mt-2 text-lg text-ink-600">بقلم: {book.author}</p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-4">
            {book.is_bestseller && (
              <span className="badge bg-primary-100 text-primary-700">
                <Star size={12} className="fill-current" /> الأكثر مبيعاً
              </span>
            )}
            {book.is_new_release && (
              <span className="badge bg-accent-100 text-accent-700">إصدار جديد</span>
            )}
            {book.is_high_commission && (
              <span className="badge bg-emerald-100 text-emerald-700">عمولة مرتفعة</span>
            )}
          </div>

          {/* Price */}
          <div className="mt-6 flex items-baseline gap-3">
            <span className="text-3xl font-bold text-primary-700">{formatPrice(price)}</span>
            {discount > 0 && (
              <span className="text-lg text-ink-400 line-through">{formatPrice(book.price)}</span>
            )}
            {discount > 0 && (
              <span className="badge bg-red-100 text-red-700">وفّر {discount}%</span>
            )}
          </div>

          {/* Stock status */}
          <div className="mt-3">
            {outOfStock ? (
              <span className="text-sm font-semibold text-red-600">نفد المخزون</span>
            ) : lowStock ? (
              <span className="text-sm font-semibold text-accent-600">باقي {book.stock} نسخة فقط - اطلب الآن!</span>
            ) : (
              <span className="text-sm font-semibold text-primary-600">متوفر في المخزون</span>
            )}
          </div>

          {/* Quantity & Add to cart */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-xl border border-ink-200 bg-white">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="p-3 text-ink-500 hover:text-primary-600"
                disabled={outOfStock}
              >
                <Minus size={18} />
              </button>
              <span className="min-w-12 text-center font-semibold text-ink-900">{quantity}</span>
              <button
                onClick={() => setQuantity(Math.min(book.stock, quantity + 1))}
                className="p-3 text-ink-500 hover:text-primary-600"
                disabled={outOfStock}
              >
                <Plus size={18} />
              </button>
            </div>
            <button
              onClick={handleAddToCart}
              disabled={outOfStock || adding}
              className="btn-primary flex-1 sm:flex-none"
            >
              <ShoppingCart size={18} /> {adding ? 'جاري الإضافة...' : 'أضف إلى السلة'}
            </button>
            <button
              onClick={toggleWishlist}
              className="rounded-xl border border-ink-200 bg-white p-3 text-ink-500 transition-colors hover:border-red-300 hover:text-red-500"
              aria-label="المفضلة"
            >
              <Heart size={20} className={isWishlisted ? 'fill-red-500 text-red-500' : ''} />
            </button>
          </div>

          {/* Trust badges */}
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-2 rounded-xl bg-ink-50 p-3">
              <Truck size={20} className="text-primary-600" />
              <span className="text-xs text-ink-600">شحن لكل المحافظات</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-ink-50 p-3">
              <ShieldCheck size={20} className="text-primary-600" />
              <span className="text-xs text-ink-600">دفع آمن ومضمون</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-ink-50 p-3">
              <BookOpen size={20} className="text-primary-600" />
              <span className="text-xs text-ink-600">كتب أصلية 100%</span>
            </div>
          </div>

          {/* Description */}
          {book.description && (
            <div className="mt-8">
              <h3 className="mb-3 font-bold text-ink-900">الوصف</h3>
              <p className="leading-relaxed text-ink-600">{book.description}</p>
            </div>
          )}

          {/* Details */}
          <div className="mt-8 rounded-xl border border-ink-100 p-4">
            <h3 className="mb-3 font-bold text-ink-900">تفاصil الكتاب</h3>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              {book.author && <Detail label="المؤلف" value={book.author} />}
              {book.publisher && <Detail label="الناشر" value={book.publisher} />}
              {category && <Detail label="التصنيف" value={category.name_ar} />}
            </dl>
          </div>
        </div>
      </div>

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="section-title mb-6">كتب ذات صلة</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {related.map((b) => <BookCard key={b.id} book={b} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-ink-50 py-1.5">
      <dt className="text-ink-500">{label}</dt>
      <dd className="font-semibold text-ink-800">{value}</dd>
    </div>
  );
}
