import { useEffect, useState, useMemo } from 'react';
import { BookCard, BookCardSkeleton } from '@/components/BookCard';
import { supabase } from '@/lib/supabase';
import type { Book, Category } from '@/lib/types';
import { SlidersHorizontal } from 'lucide-react';

interface Props {
  slug?: string;
  searchQuery?: string;
}

type SortKey = 'newest' | 'price_asc' | 'price_desc' | 'bestseller';

export function BrowsePage({ slug, searchQuery }: Props) {
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>('newest');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [priceRange, setPriceRange] = useState<string>('all');

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
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
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
  }, [books, searchQuery, slug, selectedCategory, priceRange, sort]);

  const title = searchQuery
    ? `نتائج البحث: "${searchQuery}"`
    : category
    ? `تصنيف: ${category.name_ar}`
    : 'كل الكتب';

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="section-title mb-6">{title}</h1>
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
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-ink-400">
          <p>لا توجد كتب في هذا التصنيف حالياً</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((book) => <BookCard key={book.id} book={book} />)}
        </div>
      )}
    </div>
  );
}
