import { useEffect, useState } from 'react';
import { Link } from '@/components/Link';
import { BookCardWishlist, BookCardSkeleton } from '@/components/BookCard';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { WishlistItem } from '@/lib/types';
import { Heart } from 'lucide-react';

export function WishlistPage() {
  const { profile } = useAuth();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('wishlist_items')
      .select('*, book:books(*)')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setItems((data as WishlistItem[]) ?? []);
        setLoading(false);
      });
  }, [profile]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="skeleton h-8 w-32" />
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => <BookCardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="section-title mb-6">المفضلة ({items.length})</h1>
      {items.length === 0 ? (
        <div className="py-20 text-center">
          <Heart size={64} className="mx-auto text-ink-300" />
          <h2 className="mt-4 text-xl font-bold text-ink-900">قائمة المفضلة فارغة</h2>
          <p className="mt-2 text-ink-500">أضف الكتب التي تحبها لتجدها هنا</p>
          <Link to="/" className="btn-primary mt-4">تصفح الكتب</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map((item) => item.book && <BookCardWishlist key={item.id} book={item.book} />)}
        </div>
      )}
    </div>
  );
}
