import { useEffect, useState } from 'react';
import { Link } from '@/components/Link';
import { supabase } from '@/lib/supabase';
import type { Category } from '@/lib/types';
import { BookOpen, Sparkles, FolderOpen, Loader2 } from 'lucide-react';

export function CategoriesPage() {
  const [categories, setCategories] = useState<(Category & { book_count?: number })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Query categories that are active (is_hidden is false)
        const { data: cats, error: catsError } = await supabase
          .from('categories')
          .select('*')
          .eq('is_hidden', false)
          .order('sort_order');

        if (catsError) throw catsError;

        const resolvedCats = (cats as Category[]) ?? [];

        // Fetch book counts for each category
        const counts: Record<string, number> = {};
        await Promise.all(
          resolvedCats.map(async (c) => {
            const { count } = await supabase
              .from('books')
              .select('*', { count: 'exact', head: true })
              .eq('category_id', c.id);
            counts[c.id] = count ?? 0;
          })
        );

        setCategories(
          resolvedCats.map((c) => ({
            ...c,
            book_count: counts[c.id] ?? 0,
          }))
        );
      } catch (err) {
        console.error('Error loading categories:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const formatBookCount = (count: number) => {
    if (count === 0) return 'لا توجد كتب حالياً';
    if (count === 1) return 'كتاب واحد';
    if (count === 2) return 'كتابان';
    if (count >= 3 && count <= 10) return `${count} كتب`;
    return `${count} كتاب`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-100 text-primary-600 shadow-soft">
          <FolderOpen size={32} />
        </div>
        <h1 className="font-serif text-3xl font-bold text-ink-900">أقسام الكتب</h1>
        <p className="mt-2 text-ink-500">تصفح مجموعتنا الغنية من الكتب المصنفة لتسهيل وصولك واختيارك</p>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 size={32} className="animate-spin text-primary-600" />
        </div>
      ) : categories.length === 0 ? (
        <div className="py-12 text-center text-ink-400">
          <p>لا توجد تصنيفات نشطة حالياً</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to={`/category/${cat.slug}`}
              className="group flex flex-col items-center gap-4 rounded-2xl border border-ink-100 bg-white p-6 text-center transition-all hover:-translate-y-1 hover:border-primary-400 hover:shadow-card"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 transition-colors group-hover:bg-primary-600 group-hover:text-white">
                <BookOpen size={28} />
              </div>
              <div>
                <h2 className="font-serif text-xl font-bold text-ink-900 group-hover:text-primary-700 transition-colors">
                  {cat.name_ar}
                </h2>
                {cat.name_en && (
                  <p className="text-xs text-ink-400 font-mono mt-0.5" dir="ltr">
                    {cat.name_en}
                  </p>
                )}
                <span className="mt-3 inline-block rounded-full bg-ink-50 px-3 py-1 text-xs font-semibold text-ink-600 group-hover:bg-primary-50 group-hover:text-primary-700 transition-colors">
                  {formatBookCount(cat.book_count ?? 0)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
