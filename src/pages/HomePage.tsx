import { useEffect, useState } from 'react';
import { Link } from '@/components/Link';
import { BookCard, BookCardSkeleton } from '@/components/BookCard';
import { supabase } from '@/lib/supabase';
import type { Book, Category, Offer } from '@/lib/types';
import { useHashRoute } from '@/lib/router';
import { useSettings } from '@/lib/settings';
import { useSeo, SITE_ORIGIN } from '@/lib/seo';
import { formatPrice } from '@/lib/constants';
import { Search, TrendingUp, Star, Sparkles, Megaphone, ArrowLeft, Truck, ShieldCheck, Headphones, Tag, BookOpen, Flame } from 'lucide-react';

export function HomePage() {
  const { navigate } = useHashRoute();
  const { settings } = useSettings();
  const [categories, setCategories] = useState<Category[]>([]);
  const [bestsellers, setBestsellers] = useState<Book[]>([]);
  const [newReleases, setNewReleases] = useState<Book[]>([]);
  const [recommended, setRecommended] = useState<Book[]>([]);
  const [highCommission, setHighCommission] = useState<Book[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const siteName = settings.site_name || 'مكتبة نون';
  useSeo({
    title: `${siteName} | كتب وروايات وكتب متنوعة`,
    description: `اكتشف الكتب والروايات المتنوعة من ${siteName}، وتصفح أحدث الإصدارات والعروض المميزة واختر كتبك المفضلة بسهولة. شحن لكل محافظات مصر.`,
    canonicalPath: '/',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: siteName,
      url: SITE_ORIGIN,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${SITE_ORIGIN}/#/search?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
  });

  useEffect(() => {
    (async () => {
      const [cats, best, newR, rec, highC, activeOffers] = await Promise.all([
        supabase.from('categories').select('*').eq('is_hidden', false).order('sort_order'),
        supabase.from('books').select('*, category:categories(*)').eq('is_bestseller', true).limit(10),
        supabase.from('books').select('*, category:categories(*)').eq('is_new_release', true).order('created_at', { ascending: false }).limit(10),
        supabase.from('books').select('*, category:categories(*)').eq('is_recommended', true).limit(10),
        supabase.from('books').select('*, category:categories(*)').eq('is_high_commission', true).limit(10),
        supabase.from('offers').select('*').eq('status', 'active').order('display_order', { ascending: true }),
      ]);
      setCategories((cats.data as Category[]) ?? []);
      setBestsellers((best.data as Book[]) ?? []);
      setNewReleases((newR.data as Book[]) ?? []);
      setRecommended((rec.data as Book[]) ?? []);
      setHighCommission((highC.data as Book[]) ?? []);
      const now = new Date();
      const valid = ((activeOffers.data as Offer[]) ?? []).filter((o) => {
        if (o.end_at && new Date(o.end_at) < now) return false;
        if (o.start_at && new Date(o.start_at) > now) return false;
        return true;
      });
      setOffers(valid);
      setLoading(false);
    })();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-800 via-primary-700 to-primary-900">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'url("https://images.pexels.com/photos/19969897/pexels-photo-19969897.jpeg?auto=compress&cs=tinysrgb&h=650&w=940")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }} />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:py-24">
          <div className="max-w-2xl">
            <span className="badge bg-accent-400/20 text-accent-200 backdrop-blur">
              <Sparkles size={14} /> مكتبتك الأولى للكتب العربية
            </span>
            <h1 className="mt-4 font-serif text-4xl font-bold leading-tight text-white sm:text-5xl">
              اكتشف عالم المعرفة<br />في مكتبة نون
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-primary-100">
              آلاف الكتب في الأدب والعلوم والتاريخ والفلسسة. شحن لكل محافظات مصر، وفرصة لكسب العمولة من خلال التسويق.
            </p>
            <form onSubmit={handleSearch} className="mt-8 flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن كتاب..."
                className="flex-1 rounded-xl border-0 bg-white/95 px-5 py-3 text-sm text-ink-900 placeholder:text-ink-400 shadow-lg focus:ring-2 focus:ring-accent-400 focus:outline-none"
              />
              <button type="submit" className="btn-accent">
                <Search size={18} /> بحث
              </button>
            </form>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-ink-50 to-transparent" />
      </section>

      {/* Features bar */}
      <section className="mx-auto -mt-8 max-w-7xl px-4">
        <div className="grid gap-4 rounded-2xl border border-ink-100 bg-white p-6 shadow-card sm:grid-cols-3">
          <Feature icon={<Truck size={24} />} title="شحن لكل مصر" desc="توصيل سريع لجميع المحافظات" />
          <Feature icon={<ShieldCheck size={24} />} title="دفع آمن" desc="دفع عند الاستلام أو إلكتروني" />
          <Feature icon={<Headphones size={24} />} title="دعم متواصل" desc="خدمة عملاء على مدار الأسبوع" />
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="section-title">تصفح حسب التصنيف</h2>
          <Link to="/books" className="btn-outline text-sm">
            <BookOpen size={16} /> عرض كل الكتب
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to={`/category/${cat.slug}`}
              className="group flex flex-col items-center gap-2 rounded-xl border border-ink-100 bg-white p-4 text-center transition-all hover:border-primary-400 hover:shadow-soft"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-600 transition-colors group-hover:bg-primary-600 group-hover:text-white">
                <span className="font-serif text-xl font-bold">{cat.name_ar[0]}</span>
              </div>
              <span className="text-xs font-semibold text-ink-700">{cat.name_ar}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Special Offers */}
      {offers.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="flex items-center gap-2 section-title">
              <span className="text-accent-500"><Flame size={22} /></span>
              عروض خاصة
            </h2>
            <Link to="/offers" className="text-sm font-semibold text-primary-600 hover:text-primary-700">
              عرض الكل <ArrowLeft size={14} className="inline" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {offers.map((offer) => (
              <Link
                key={offer.id}
                to={`/offers/${offer.slug}`}
                className="group relative overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-soft transition-all hover:shadow-card"
              >
                <div className="relative h-40 overflow-hidden bg-gradient-to-br from-primary-700 to-primary-900">
                  {offer.cover_image ? (
                    <img src={offer.cover_image} alt={`عرض ${offer.name}`} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Tag size={40} className="text-white/30" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <span className="absolute right-3 top-3 rounded-full bg-accent-500 px-3 py-1 text-xs font-bold text-white shadow">
                    عرض خاص
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-ink-900 group-hover:text-primary-700">{offer.name}</h3>
                  {offer.description && <p className="mt-1 line-clamp-2 text-sm text-ink-500">{offer.description}</p>}
                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <span className="text-lg font-bold text-primary-700">{formatPrice(offer.price_per_book)}</span>
                      <span className="text-xs text-ink-500"> / كتاب</span>
                    </div>
                    <span className="text-xs text-ink-500">الحد الأدنى: {offer.min_books} كتب</span>
                  </div>
                  <div className="mt-3 flex items-center justify-center rounded-lg bg-primary-50 py-2 text-sm font-semibold text-primary-700 transition-colors group-hover:bg-primary-600 group-hover:text-white">
                    عرض التفاصيل <ArrowLeft size={14} className="ml-1" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Bestsellers */}
      <BookSection title="الأكثر مبيعاً" icon={<TrendingUp size={20} />} books={bestsellers} loading={loading} />

      {/* Affiliate banner */}
      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-accent-500 to-accent-600 p-8 sm:p-12">
          <div className="relative z-10 max-w-lg">
            <span className="badge bg-white/20 text-white">
              <Megaphone size={14} /> فرصة لكسب المال
            </span>
            <h2 className="mt-3 font-serif text-2xl font-bold text-white sm:text-3xl">
              سوق لكتبنا واكسب العمولة
            </h2>
            <p className="mt-3 text-accent-50">
              انضم إلى برنامج التسويق بالعمولة واحصل على كود خصم خاص بك. اربح عمولة على كل طلب يأتي من خلالك.
            </p>
            <Link to="/affiliate" className="btn mt-5 bg-white text-accent-700 hover:bg-accent-50">
              ابدأ التسويق الآن <ArrowLeft size={16} />
            </Link>
          </div>
          <Megaphone size={200} className="absolute -left-8 -bottom-8 text-white/10" />
        </div>
      </section>

      {/* New releases */}
      <BookSection title="أحدث الإصدارات" icon={<Sparkles size={20} />} books={newReleases} loading={loading} />

      {/* Recommended */}
      <BookSection title="مختارات لك" icon={<Star size={20} />} books={recommended} loading={loading} />

      {/* High commission (affiliate focus) */}
      <BookSection title="كتب بمعدل عمولة مرتفع" icon={<TrendingUp size={20} />} books={highCommission} loading={loading} />
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-ink-900">{title}</h3>
      </div>
    </div>
  );
}

function BookSection({ title, icon, books, loading }: { title: string; icon: React.ReactNode; books: Book[]; loading: boolean }) {
  if (!loading && books.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="flex items-center gap-2 section-title">
          <span className="text-primary-600">{icon}</span>
          {title}
        </h2>
      </div>
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => <BookCardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {books.map((book) => <BookCard key={book.id} book={book} />)}
        </div>
      )}
    </section>
  );
}
