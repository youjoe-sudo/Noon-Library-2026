import { useEffect, useState } from 'react';
import { Link } from '@/components/Link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Order } from '@/lib/types';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, formatPrice, formatDate } from '@/lib/constants';
import { Package, ArrowLeft } from 'lucide-react';

export function OrdersPage() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setOrders((data as Order[]) ?? []);
        setLoading(false);
      });
  }, [profile]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="skeleton h-8 w-32" />
        <div className="mt-6 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-32 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="section-title mb-6">طلباتي</h1>

      {orders.length === 0 ? (
        <div className="py-20 text-center">
          <Package size={64} className="mx-auto text-ink-300" />
          <h2 className="mt-4 text-xl font-bold text-ink-900">لا توجد طلبات</h2>
          <p className="mt-2 text-ink-500">لم تقم بأي طلبات بعد</p>
          <Link to="/" className="btn-primary mt-4">تصفح الكتب</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Link key={order.id} to={`/order/${order.id}`}>
              <div className="card p-4 transition-shadow hover:shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-ink-900">{order.order_number}</p>
                    <p className="text-sm text-ink-500">{formatDate(order.created_at)}</p>
                  </div>
                  <span className={`badge ${ORDER_STATUS_COLORS[order.status]}`}>
                    {ORDER_STATUS_LABELS[order.status]}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex -space-x-3">
                    {order.order_items?.slice(0, 5).map((item) => (
                      <div key={item.id} className="h-14 w-10 overflow-hidden rounded-md border-2 border-white bg-ink-100">
                        {item.cover_url && <img src={item.cover_url} alt={item.book_title} className="h-full w-full object-cover" />}
                      </div>
                    ))}
                    {order.order_items && order.order_items.length > 5 && (
                      <div className="flex h-14 w-10 items-center justify-center rounded-md border-2 border-white bg-ink-100 text-xs font-bold text-ink-500">
                        +{order.order_items.length - 5}
                      </div>
                    )}
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-ink-500">{order.order_items?.length ?? 0} منتج</p>
                    <p className="font-bold text-primary-700">{formatPrice(order.total)}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1 text-sm text-primary-600">
                  عرض التفاصيل <ArrowLeft size={14} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
