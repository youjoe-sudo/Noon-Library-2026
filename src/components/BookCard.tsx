import { Link } from '@/components/Link';
import type { Book } from '@/lib/types';
import { getEffectivePrice, getDiscountPercent, formatPrice } from '@/lib/constants';
import { ShoppingCart, Heart, Star } from 'lucide-react';
import { useCart } from '@/lib/cart';

export function BookCard({ book }: { book: Book }) {
  const { addToCart } = useCart();
  const price = getEffectivePrice(book);
  const discount = getDiscountPercent(book);
  const outOfStock = book.stock <= 0;

  return (
    <Link to={`/book/${book.id}`} className="group block">
      <div className="card overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
        <div className="relative aspect-[3/4] overflow-hidden bg-ink-100">
          {book.cover_url ? (
            <img
              src={book.cover_url}
              alt={book.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-primary-50">
              <span className="font-serif text-3xl text-primary-300">ن</span>
            </div>
          )}
          {discount > 0 && (
            <span className="absolute right-2 top-2 badge bg-accent-500 text-ink-950 shadow">
              {discount}%-
            </span>
          )}
          {book.is_bestseller && (
            <span className="absolute left-2 top-2 badge bg-primary-600 text-white shadow">
              <Star size={12} className="fill-current" /> الأكثر مبيعاً
            </span>
          )}
          {outOfStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-ink-900/60">
              <span className="rounded-lg bg-white px-3 py-1 text-sm font-bold text-ink-900">نفد المخزون</span>
            </div>
          )}
        </div>
        <div className="p-3">
          <h3 className="line-clamp-2 text-sm font-semibold text-ink-900 group-hover:text-primary-600">
            {book.title}
          </h3>
          {book.author && (
            <p className="mt-0.5 line-clamp-1 text-xs text-ink-500">{book.author}</p>
          )}
          <div className="mt-2 flex items-center justify-between gap-1">
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-bold text-primary-700">{formatPrice(price)}</span>
              {discount > 0 && (
                <span className="text-xs text-ink-400 line-through">{formatPrice(book.price)}</span>
              )}
            </div>
            <button
              onClick={(e) => {
                e.preventDefault();
                addToCart(book.id, 1);
              }}
              disabled={outOfStock}
              className="rounded-lg bg-primary-50 p-1.5 text-primary-600 transition-colors hover:bg-primary-100 disabled:opacity-40"
              aria-label="أضف إلى السلة"
            >
              <ShoppingCart size={16} />
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function BookCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="skeleton aspect-[3/4]" />
      <div className="p-3">
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton mt-2 h-3 w-1/2" />
        <div className="skeleton mt-2 h-5 w-1/3" />
      </div>
    </div>
  );
}

export function BookCardWishlist({ book }: { book: Book }) {
  const price = getEffectivePrice(book);
  const discount = getDiscountPercent(book);
  return (
    <Link to={`/book/${book.id}`} className="group block">
      <div className="card overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
        <div className="relative aspect-[3/4] overflow-hidden bg-ink-100">
          {book.cover_url ? (
            <img src={book.cover_url} alt={book.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          ) : (
            <div className="flex h-full items-center justify-center bg-primary-50">
              <span className="font-serif text-3xl text-primary-300">ن</span>
            </div>
          )}
          {discount > 0 && (
            <span className="absolute right-2 top-2 badge bg-accent-500 text-ink-950 shadow">{discount}%-</span>
          )}
        </div>
        <div className="p-3">
          <h3 className="line-clamp-2 text-sm font-semibold text-ink-900 group-hover:text-primary-600">{book.title}</h3>
          {book.author && <p className="mt-0.5 line-clamp-1 text-xs text-ink-500">{book.author}</p>}
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm font-bold text-primary-700">{formatPrice(price)}</span>
            <Heart size={16} className="fill-red-500 text-red-500" />
          </div>
        </div>
      </div>
    </Link>
  );
}
