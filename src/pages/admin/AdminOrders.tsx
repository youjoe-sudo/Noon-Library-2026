import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import type { Order, OrderStatus } from '@/lib/types';
import {
  ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, ORDER_STATUS_FLOW,
  formatPrice, formatDateTime,
} from '@/lib/constants';
import { Search, X, ChevronDown, Check, XCircle } from 'lucide-react';

export function AdminOrders() {
  const { profile } = useAuth();
  const { show } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  const fetchOrders = async () => {
    let query = supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false });
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    const { data } = await query;
    setOrders((data as Order[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, [statusFilter]);

  const updateOrderStatus = async (orderId: string, status: OrderStatus, reason?: string) => {
    if (!profile) return;

    const { error } = await supabase.rpc('update_order_status', {
      p_order_id: orderId,
      p_new_status: status,
      p_admin_id: profile.id,
      p_reason: reason ?? null,
    });

    if (error) {
      show('فشل تحديث الحالة', 'error');
      return;
    }

    show(`تم تحديث الحالة إلى: ${ORDER_STATUS_LABELS[status]}`, 'success');
    setSelectedOrder(null);
    setRejectReason('');
    setShowRejectModal(false);
    fetchOrders();
  };

  const handleReject = async () => {
    if (!selectedOrder || !profile) return;
    await updateOrderStatus(selectedOrder.id, 'rejected', rejectReason || undefined);
  };

  const filtered = orders.filter((o) =>
    o.order_number.toLowerCase().includes(search.toLowerCase()) ||
    (o.address_full_name?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  return (
    <div className="space-y-4">
      <h2 className="font-bold text-ink-900">إدارة الطلبات ({orders.length})</h2>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث برقم الطلب أو الاسم..." className="input pr-10" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input w-auto">
          <option value="all">كل الحالات</option>
          {Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-20 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-ink-400">لا توجد طلبات</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((order) => (
            <div key={order.id} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-ink-900">{order.order_number}</p>
                  <p className="text-xs text-ink-500">{formatDateTime(order.created_at)}</p>
                  <p className="text-sm text-ink-600">{order.address_full_name} • {order.governorate}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`badge ${ORDER_STATUS_COLORS[order.status]}`}>{ORDER_STATUS_LABELS[order.status]}</span>
                  <span className="font-bold text-primary-700">{formatPrice(order.total)}</span>
                  <button onClick={() => setSelectedOrder(order)} className="btn-outline text-xs">تفاصيل</button>
                </div>
              </div>
              {order.status === 'rejected' && order.reject_reason && (
                <div className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">
                  سبب الرفض: {order.reject_reason}
                </div>
              )}
              {/* Quick actions */}
              {order.status === 'awaiting_review' && (
                <div className="mt-3 flex gap-2">
                  <button onClick={() => updateOrderStatus(order.id, 'confirmed')} className="btn-primary text-xs">
                    <Check size={14} /> تأكيد
                  </button>
                  <button onClick={() => { setSelectedOrder(order); setShowRejectModal(true); }} className="btn-danger text-xs">
                    <XCircle size={14} /> رفض
                  </button>
                </div>
              )}
              {order.status !== 'awaiting_review' && order.status !== 'cancelled' && order.status !== 'delivered' && order.status !== 'rejected' && (
                <div className="mt-3">
                  <select
                    onChange={(e) => {
                      if (e.target.value === 'rejected') { setSelectedOrder(order); setShowRejectModal(true); }
                      else updateOrderStatus(order.id, e.target.value as OrderStatus);
                    }}
                    value=""
                    className="input w-auto py-2 text-sm"
                  >
                    <option value="" disabled>تغيير الحالة...</option>
                    {ORDER_STATUS_FLOW.filter((s) => s !== order.status && ORDER_STATUS_FLOW.indexOf(s) > ORDER_STATUS_FLOW.indexOf(order.status)).map((s) => (
                      <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>
                    ))}
                    <option value="cancelled">إلغاء الطلب</option>
                    <option value="rejected">رفض الطلب</option>
                  </select>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Order detail modal */}
      {selectedOrder && !showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 p-4" onClick={() => { setSelectedOrder(null); setRejectReason(''); }}>
          <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-card" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold text-ink-900">{selectedOrder.order_number}</h3>
              <button onClick={() => { setSelectedOrder(null); setRejectReason(''); }} className="text-ink-400 hover:text-ink-600"><X size={20} /></button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <Info label="الاسم" value={selectedOrder.address_full_name ?? '-'} />
                <Info label="الهاتف" value={selectedOrder.address_phone ?? '-'} />
                <Info label="المحافظة" value={selectedOrder.governorate ?? '-'} />
                <Info label="العنوان" value={selectedOrder.address_detail ?? '-'} />
                <Info label="طريقة الشحن" value={selectedOrder.shipping_method === 'express' ? 'سريع' : 'بريد'} />
                <Info label="طريقة الدفع" value={selectedOrder.payment_method === 'deposit' ? 'عند الاستلام' : 'تحويل إلكتروني'} />
              </div>

              {selectedOrder.payment_method === 'full' && (
                <div className="rounded-xl bg-accent-50 p-3">
                  <p className="font-semibold text-accent-800">بيانات الدفع</p>
                  <p className="text-accent-700">هاتف المرسل: <span dir="ltr">{selectedOrder.payment_sender_phone}</span></p>
                  <p className="text-accent-700">رقم الإيصال: <span dir="ltr">{selectedOrder.payment_receipt_number}</span></p>
                  {selectedOrder.payment_screenshot_url && <a href={selectedOrder.payment_screenshot_url} target="_blank" rel="noopener noreferrer" className="link-hover">عرض الإيصال</a>}
                </div>
              )}

              <div>
                <p className="mb-2 font-semibold text-ink-900">المنتجات:</p>
                {selectedOrder.order_items?.map((item) => (
                  <div key={item.id} className="flex justify-between border-b border-ink-50 py-2">
                    <span>{item.book_title} × {item.quantity}</span>
                    <span className="font-semibold">{formatPrice(item.subtotal)}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between border-t border-ink-100 pt-3 font-bold">
                <span>الإجمالي</span>
                <span className="text-primary-700">{formatPrice(selectedOrder.total)}</span>
              </div>

              {selectedOrder.status === 'awaiting_review' && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <button onClick={() => updateOrderStatus(selectedOrder.id, 'confirmed')} className="btn-primary flex-1">
                      <Check size={16} /> تأكيد الطلب
                    </button>
                    <button onClick={() => setShowRejectModal(true)} className="btn-danger flex-1">
                      <XCircle size={16} /> رفض
                    </button>
                  </div>
                </div>
              )}

              {selectedOrder.status !== 'awaiting_review' && selectedOrder.status !== 'cancelled' && selectedOrder.status !== 'delivered' && selectedOrder.status !== 'rejected' && (
                <div>
                  <label className="label">تغيير الحالة</label>
                  <select
                    onChange={(e) => {
                      if (e.target.value === 'rejected') { setShowRejectModal(true); }
                      else updateOrderStatus(selectedOrder.id, e.target.value as OrderStatus);
                    }}
                    defaultValue=""
                    className="input"
                  >
                    <option value="" disabled>اختر الحالة...</option>
                    {ORDER_STATUS_FLOW.filter((s) => s !== selectedOrder.status).map((s) => (
                      <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>
                    ))}
                    <option value="cancelled">إلغاء</option>
                    <option value="rejected">رفض</option>
                  </select>
                </div>
              )}

              {selectedOrder.status === 'rejected' && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  <p className="font-semibold">تم رفض هذا الطلب</p>
                  {selectedOrder.reject_reason && <p className="mt-1">السبب: {selectedOrder.reject_reason}</p>}
                  {selectedOrder.rejected_at && <p className="mt-1 text-xs">تاريخ الرفض: {formatDateTime(selectedOrder.rejected_at)}</p>}
                </div>
              )}

              {selectedOrder.status === 'cancelled' && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  <p className="font-semibold">تم إلغاء هذا الطلب</p>
                  {selectedOrder.reject_reason && <p className="mt-1">السبب: {selectedOrder.reject_reason}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rejection reason modal */}
      {selectedOrder && showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 p-4" onClick={() => setShowRejectModal(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold text-red-700">رفض الطلب {selectedOrder.order_number}</h3>
              <button onClick={() => setShowRejectModal(false)} className="text-ink-400 hover:text-ink-600"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">سبب الرفض (اختياري)</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="input min-h-24"
                  placeholder="اكتب سبب رفض الطلب..."
                />
              </div>
              <div className="flex gap-2">
                <button onClick={handleReject} className="btn-danger flex-1">
                  <XCircle size={16} /> تأكيد الرفض
                </button>
                <button onClick={() => setShowRejectModal(false)} className="btn-ghost flex-1">إلغاء</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-ink-500">{label}</p>
      <p className="font-semibold text-ink-900">{value}</p>
    </div>
  );
}
