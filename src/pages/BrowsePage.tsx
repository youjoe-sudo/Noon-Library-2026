import { useEffect, useState, useMemo } from 'react';
import { BookCard, BookCardSkeleton } from '@/components/BookCard';
import { supabase } from '@/lib/supabase';
import type { Book, Category } from '@/lib/types';
import { SlidersHorizontal, ChevronLeft, Search } from 'lucide-react';
import { useSeo } from '@/lib/seo';
import { useSettings } from '@/lib/settings';
import { Link } from '@/components/Link';

interface Props {
  slug?: string;
  searchQuery?: string;
}

type SortKey = 'newest' | 'price_asc' | 'price_desc' | 'bestseller';

const PAGE_SIZE = 20;

export function BrowsePage({ slug, searchQuery }: Props) {
  const { settings } = useSettings();
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>('newest');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [priceRange, setPriceRange] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [localSearch, setLocalSearch] = useState('');

  const siteName = settings.site_name || 'مكتبة نون';

  const seoTitle = searchQuery
    ? `نتائج البحث: "${searchQuery}" | ${siteName}`
    : category
    ? `${category.name_ar} | ${siteName}`
    : `كل الكتب | ${siteName}`;

  const seoDescription = searchQuery
    ? `نتائج البحث عن "${searchQuery}" في مكتبة نون. تصفح الكتب والروايات المتنوعة.`
    : category
    ? `تصفح كتب تصنيف ${category.name_ar} من ${siteName}. روابط، كتب متنوعة، وأكثر بأسعار مميزة.`
    : `تصفح كل الكتب والروايات المتاحة في ${siteName}. ابحث، صفّ، ورتب كتبك المفضلة بسهولة.`;

  useSeo({
    title: seoTitle,
    description: seoDescription,
    canonicalPath: slug ? `/category/${slug}` : '/books',
    noIndex: !!searchQuery,
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: cats } = await supabase.from('categories').select('*').eq('is_hidden', false).order('sort_order');
      setCategories((cats as Category[]) ?? []);

      let query = supabase.from('books').select('*, category:categories(*)');
      if (slug) {
        query = query.eq('category_id', (await supabase.from('categories').select('id').eq('slug', slug).maybeSingle()).data?.id ?? '');
        const cat = (cats as Category[])?.find((c) => c.slug === slug);
        setCategory(cat ?? null);
      }
      const { data } = await query.order('created_at', { ascending: false });
      setBooks((data as Book[]) ?? []);
      setLoading(false);
    })();
  }, [slug]);

  const filtered = useMemo(() => {
    let result = [...books];
    const q = (searchQuery || localSearch).trim().toLowerCase();
    if (q) {
      result = result.filter((b) =>
        b.title.toLowerCase().includes(q) ||
        (b.author?.toLowerCase().includes(q) ?? false) ||
        (b.publisher?.toLowerCase().includes(q) ?? false)
      );
    }
    if (!slug && selectedCategory !== 'all') {
      result = result.filter((b) => b.category?.slug === selectedCategory);
    }
    if (priceRange !== 'all') {
      const [min, max] = priceRange.split('-').map(Number);
      result = result.filter((b) => {
        const p = b.discount_price ?? b.price;
        return p >= min && (max ? p <= max : true);
      });
    }
    switch (sort) {
      case 'price_asc':
        result.sort((a, b) => (a.discount_price ?? a.price) - (b.discount_price ?? b.price));
        break;
      case 'price_desc':
        result.sort((a, b) => (b.discount_price ?? b.price) - (a.discount_price ?? a.price));
        break;
      case 'bestseller':
        result.sort((a, b) => b.sales_count - a.sales_count);
        break;
      default:
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return result;
  }, [books, searchQuery, localSearch, slug, selectedCategory, priceRange, sort]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [searchQuery, localSearch, slug, selectedCategory, priceRange, sort]);

  const title = searchQuery
    ? `نتائج البحث: "${searchQuery}"`
    : category
    ? category.name_ar
    : 'كل الكتب';

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <nav className="mb-4 flex items-center gap-1 text-sm text-ink-500">
        <Link to="/" className="hover:text-primary-600">الرئيسية</Link>
        <ChevronLeft size={14} />
        {category ? (
          <>
            <Link to="/books" className="hover:text-primary-600">الكتب</Link>
            <ChevronLeft size={14} />
            <span className="font-semibold text-ink-700">{category.name_ar}</span>
          </>
        ) : (
          <span className="font-semibold text-ink-700">{searchQuery ? 'نتائج البحث' : 'كل الكتب'}</span>
        )}
      </nav>
      <h1 className="section-title mb-6">{title}</h1>

      {/* Local search */}
      <div className="relative mb-4">
        <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="ابحث في الكتب..."
          className="input pr-10"
        />
      </div>

      {searchQuery && !loading && filtered.length === 0 && (
        <p className="text-ink-500">لم يتم العثور على كتب مطابقة لبحثك. جرب كلمات أخرى.</p>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-ink-500">
          <SlidersHorizontal size={16} /> تصفية:
        </div>
        {!slug && (
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="input w-auto py-2 text-sm"
          >
            <option value="all">كل التصنيفات</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>{c.name_ar}</option>
            ))}
          </select>
        )}
        <select
          value={priceRange}
          onChange={(e) => setPriceRange(e.target.value)}
          className="input w-auto py-2 text-sm"
        >
          <option value="all">كل الأسعار</option>
          <option value="0-100">أقل من 100 ج.م</option>
          <option value="100-200">100 - 200 ج.م</option>
          <option value="200-500">200 - 500 ج.م</option>
          <option value="500-0">أكثر من 500 ج.م</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="input w-auto py-2 text-sm"
        >
          <option value="newest">الأحدث</option>
          <option value="bestseller">الأكثر مبيعاً</option>
          <option value="price_asc">السعر: من الأقل للأعلى</option>
          <option value="price_desc">السعر: من الأعلى للأقل</option>
        </select>
        <span className="text-sm text-ink-500">{filtered.length} كتاب</span>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => <BookCardSkeleton key={i} />)}
        </div>
      ) : paged.length === 0 ? (
        <div className="py-20 text-center text-ink-400">
          <p>لا توجد كتب مطابقة</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {paged.map((book) => <BookCard key={book.id} book={book} />)}
          </div>
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-outline px-3 py-2 text-sm disabled:opacity-30"
              >
                السابق
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i + 1)}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                    page === i + 1 ? 'bg-primary-600 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-outline px-3 py-2 text-sm disabled:opacity-30"
              >
                التالي
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
