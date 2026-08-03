import { useEffect, useState } from 'react';
import { Link } from '@/components/Link';
import { supabase } from '@/lib/supabase';
import type { Order } from '@/lib/types';
import {
  ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, formatPrice, formatDateTime,
} from '@/lib/constants';
import { ArrowRight, Check, Clock, Truck, Package, XCircle, MapPin } from 'lucide-react';

export function OrderDetailPage({ id }: { id: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', id)
        .maybeSingle();
      setOrder(data as Order | null);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="skeleton h-64 w-full" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <h2 className="text-xl font-bold text-ink-900">الطلب غير موجود</h2>
        <Link to="/orders" className="btn-primary mt-4">العودة لطلباتي</Link>
      </div>
    );
  }

  const steps = ['awaiting_review', 'confirmed', 'preparing', 'shipped', 'delivered'];
  const isRejected = order.status === 'rejected';
  const isCancelled = order.status === 'cancelled';
  const currentStep = (isRejected || isCancelled) ? -1 : steps.indexOf(order.status);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-ink-500">
        <Link to="/orders" className="hover:text-primary-600">طلباتي</Link>
        <ArrowRight size={14} />
        <span className="text-ink-900">{order.order_number}</span>
      </nav>

      {/* Status header */}
      <div className="card mb-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl font-bold text-ink-900">{order.order_number}</h1>
            <p className="text-sm text-ink-500">{formatDateTime(order.created_at)}</p>
          </div>
          <span className={`badge text-sm ${ORDER_STATUS_COLORS[order.status]}`}>
            {ORDER_STATUS_LABELS[order.status]}
          </span>
        </div>

        {/* Status tracker */}
        {order.status !== 'cancelled' && order.status !== 'rejected' && (
          <div className="mt-6">
            <div className="flex items-center justify-between">
              {steps.map((step, i) => {
                const icons: Record<string, React.ReactNode> = {
                  awaiting_review: <Clock size={18} />,
                  confirmed: <Check size={18} />,
                  preparing: <Package size={18} />,
                  shipped: <Truck size={18} />,
                  delivered: <Check size={18} />,
                };
                const done = i <= currentStep;
                return (
                  <div key={step} className="flex flex-1 flex-col items-center">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      done ? 'bg-primary-600 text-white' : 'bg-ink-100 text-ink-400'
                    }`}>
                      {icons[step]}
                    </div>
                    <span className={`mt-2 text-center text-xs ${done ? 'font-semibold text-primary-700' : 'text-ink-400'}`}>
                      {ORDER_STATUS_LABELS[step as keyof typeof ORDER_STATUS_LABELS]}
                    </span>
                    {i < steps.length - 1 && (
                      <div className={`absolute h-0.5 ${done ? 'bg-primary-600' : 'bg-ink-200'}`} style={{ width: '20%', marginTop: '-29px', marginRight: '60%' }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {(isCancelled || isRejected) && (
          <div className={`mt-4 flex items-center gap-2 rounded-lg p-4 text-sm ${isRejected ? 'bg-red-100 text-red-800' : 'bg-red-50 text-red-700'}`}>
            <XCircle size={20} />
            <div>
              <p className="font-semibold">{isRejected ? 'تم رفض الطلب' : 'تم إلغاء الطلب'}</p>
              {order.reject_reason && <p className="mt-1 text-red-600">السبب: {order.reject_reason}</p>}
              {isRejected && order.rejected_at && <p className="mt-1 text-xs text-red-500">تاريخ الرفض: {formatDateTime(order.rejected_at)}</p>}
            </div>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="card mb-6 p-6">
        <h2 className="mb-4 font-bold text-ink-900">المنتجات</h2>
        <div className="space-y-4">
          {order.order_items?.map((item) => (
            <div key={item.id} className="flex items-center gap-4 border-b border-ink-50 pb-4 last:border-0">
              <div className="h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-ink-100">
                {item.cover_url && <img src={item.cover_url} alt={item.book_title} className="h-full w-full object-cover" />}
              </div>
              <div className="flex-1">
                {item.book_id ? (
                  <Link to={`/book/${item.book_id}`} className="font-semibold text-ink-900 hover:text-primary-600">{item.book_title}</Link>
                ) : (
                  <p className="font-semibold text-ink-900">{item.book_title}</p>
                )}
                {item.book_author && <p className="text-sm text-ink-500">{item.book_author}</p>}
                <p className="text-sm text-ink-500">الكمية: {item.quantity}</p>
              </div>
              <div className="text-left">
                <p className="font-bold text-primary-700">{formatPrice(item.subtotal)}</p>
                <p className="text-xs text-ink-400">{formatPrice(item.unit_price)} للنسخة</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Address */}
      <div className="card mb-6 p-6">
        <h2 className="mb-3 flex items-center gap-2 font-bold text-ink-900">
          <MapPin size={20} className="text-primary-600" /> عنوان التوصيل
        </h2>
        <div className="text-sm text-ink-600">
          <p className="font-semibold text-ink-900">{order.address_full_name}</p>
          <p>{order.address_phone}</p>
          <p>{order.governorate}، {order.address_detail}</p>
        </div>
      </div>

      {/* Payment */}
      {order.payment_method === 'full' && (
        <div className="card mb-6 p-6">
          <h2 className="mb-3 font-bold text-ink-900">بيانات الدفع</h2>
          <div className="space-y-1 text-sm text-ink-600">
            <p>رقم هاتف المرسل: <span dir="ltr">{order.payment_sender_phone}</span></p>
            <p>رقم الإيصال: <span dir="ltr">{order.payment_receipt_number}</span></p>
            {order.payment_screenshot_url && (
              <a href={order.payment_screenshot_url} target="_blank" rel="noopener noreferrer" className="link-hover">عرض صورة الإيصال</a>
            )}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="card p-6">
        <h2 className="mb-4 font-bold text-ink-900">ملخص الفاتورة</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-500">المجموع الفرعي</span>
            <span className="font-semibold">{formatPrice(order.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-500">الشحن</span>
            <span className="font-semibold">{order.shipping_cost === 0 ? 'مجاني' : formatPrice(order.shipping_cost)}</span>
          </div>
          {order.discount_amount > 0 && (
            <div className="flex justify-between text-primary-600">
              <span>الخصم {order.promo_code_text ? `(${order.promo_code_text})` : ''}</span>
              <span className="font-semibold">-{formatPrice(order.discount_amount)}</span>
            </div>
          )}
        </div>
        <div className="mt-4 flex justify-between border-t border-ink-100 pt-4">
          <span className="font-bold text-ink-900">الإجمالي</span>
          <span className="text-xl font-bold text-primary-700">{formatPrice(order.total)}</span>
        </div>
      </div>
    </div>
  );
}
