import { useState } from 'react';
import { Link } from '@/components/Link';
import { useCart, getCartSubtotal, getCartBookCount } from '@/lib/cart';
import { useSettings } from '@/lib/settings';
import { formatPrice, isFreeShipping } from '@/lib/constants';
import { Minus, Plus, Trash2, ShoppingBag, ArrowLeft } from 'lucide-react';

export function CartPage() {
  const { items, loading, updateQuantity, removeItem } = useCart();
  const { settings } = useSettings();
  const [updating, setUpdating] = useState<string | null>(null);

  const subtotal = getCartSubtotal(items);
  const bookCount = getCartBookCount(items);
  const freeShip = isFreeShipping(subtotal, settings);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="skeleton h-8 w-48" />
        <div className="mt-6 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <ShoppingBag size={64} className="mx-auto text-ink-300" />
        <h2 className="mt-4 text-xl font-bold text-ink-900">سلة التسوق فارغة</h2>
        <p className="mt-2 text-ink-500">لم تقم بإضافة أي كتب إلى السلة بعد</p>
        <Link to="/" className="btn-primary mt-6">
          تصفح الكتب <ArrowLeft size={16} />
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="section-title mb-6">سلة التسوق ({items.length} منتج)</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
        {/* Items */}
        <div className="space-y-4">
          {items.map((item) => {
            if (!item.book) return null;
            const price = item.book.discount_price ?? item.book.price;
            return (
              <div key={item.id} className="card flex gap-4 p-4">
                <Link to={`/book/${item.book.id}`} className="shrink-0">
                  <div className="h-28 w-20 overflow-hidden rounded-lg bg-ink-100">
                    {item.book.cover_url ? (
                      <img src={item.book.cover_url} alt={item.book.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-primary-50">
                        <span className="font-serif text-2xl text-primary-300">ن</span>
                      </div>
                    )}
                  </div>
                </Link>
                <div className="flex flex-1 flex-col">
                  <Link to={`/book/${item.book.id}`}>
                    <h3 className="font-semibold text-ink-900 hover:text-primary-600">{item.book.title}</h3>
                  </Link>
                  {item.book.author && <p className="text-sm text-ink-500">{item.book.author}</p>}
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <div className="flex items-center rounded-lg border border-ink-200">
                      <button
                        onClick={() => { setUpdating(item.id); updateQuantity(item.id, item.quantity - 1); }}
                        className="p-2 text-ink-500 hover:text-primary-600"
                        disabled={item.quantity <= 1}
                      >
                        <Minus size={16} />
                      </button>
                      <span className="min-w-8 text-center text-sm font-semibold">{updating === item.id ? '...' : item.quantity}</span>
                      <button
                        onClick={() => { setUpdating(item.id); updateQuantity(item.id, item.quantity + 1); }}
                        className="p-2 text-ink-500 hover:text-primary-600"
                        disabled={item.quantity >= item.book.stock}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-primary-700">{formatPrice(price * item.quantity)}</span>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                        aria-label="حذف"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="card h-fit p-6 lg:sticky lg:top-32">
          <h2 className="mb-4 font-bold text-ink-900">ملخص الطلب</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-500">عدد الكتب</span>
              <span className="font-semibold">{bookCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-500">المجموع الفرعي</span>
              <span className="font-semibold">{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-500">الشحن</span>
              <span className="font-semibold text-primary-600">يُحسب عند الدفع</span>
            </div>
          </div>
          {freeShip && (
            <div className="mt-3 rounded-lg bg-primary-50 p-3 text-center text-sm font-semibold text-primary-700">
              طلبك مؤهل للشحن المجاني!
            </div>
          )}
          {!freeShip && subtotal > 0 && (
            <div className="mt-3 rounded-lg bg-accent-50 p-3 text-center text-sm text-accent-700">
              أضف بقيمة {formatPrice(parseFloat(settings.free_shipping_threshold || '500') - subtotal)} للحصول على شحن مجاني
            </div>
          )}
          <Link to="/checkout" className="btn-primary mt-6 w-full">
            إتمام الطلب <ArrowLeft size={16} />
          </Link>
          <Link to="/" className="btn-ghost mt-2 w-full">متابعة التسوق</Link>
        </div>
      </div>
    </div>
  );
}
