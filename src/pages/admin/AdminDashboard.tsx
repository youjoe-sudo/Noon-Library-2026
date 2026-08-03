import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatPrice, formatDate } from '@/lib/constants';
import type { Order, Book, AffiliateProfile } from '@/lib/types';
import { DollarSign, Package, Users, BookOpen, TrendingUp, ShoppingCart, Megaphone } from 'lucide-react';

export function AdminDashboard() {
  const [stats, setStats] = useState({
    totalOrders: 0, pendingOrders: 0, totalRevenue: 0,
    totalBooks: 0, lowStock: 0, totalAffiliates: 0, pendingAffiliates: 0,
  });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [lowStockBooks, setLowStockBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [orders, pending, books, affiliates, pendingAff, lowStock, recent] = await Promise.all([
        supabase.from('orders').select('total, status'),
        supabase.from('orders').select('id').eq('status', 'awaiting_review'),
        supabase.from('books').select('id, stock, stock_threshold'),
        supabase.from('affiliate_profiles').select('id'),
        supabase.from('affiliate_profiles').select('id').eq('status', 'pending'),
        supabase.from('books').select('*').lt('stock', 10).order('stock', { ascending: true }).limit(5),
        supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).limit(5),
      ]);

      const allOrders = orders.data ?? [];
      const totalRevenue = (allOrders as { total: number; status: string }[]).filter((o) => o.status !== 'cancelled').reduce((sum, o) => sum + o.total, 0);

      setStats({
        totalOrders: allOrders.length,
        pendingOrders: pending.data?.length ?? 0,
        totalRevenue,
        totalBooks: books.data?.length ?? 0,
        lowStock: (books.data as { stock: number; stock_threshold: number }[] | undefined)?.filter((b) => b.stock <= b.stock_threshold).length ?? 0,
        totalAffiliates: affiliates.data?.length ?? 0,
        pendingAffiliates: pendingAff.data?.length ?? 0,
      });
      setRecentOrders((recent.data as Order[]) ?? []);
      setLowStockBooks((lowStock.data as Book[]) ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-28 w-full" />)}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<DollarSign size={20} />} label="إجمالي الإيرادات" value={formatPrice(stats.totalRevenue)} color="primary" />
        <StatCard icon={<Package size={20} />} label="إجمالي الطلبات" value={String(stats.totalOrders)} color="blue" />
        <StatCard icon={<ShoppingCart size={20} />} label="طلبات بانتظار المراجعة" value={String(stats.pendingOrders)} color="accent" />
        <StatCard icon={<BookOpen size={20} />} label="عدد الكتب" value={String(stats.totalBooks)} color="emerald" />
        <StatCard icon={<TrendingUp size={20} />} label="مخزون منخفض" value={String(stats.lowStock)} color="red" />
        <StatCard icon={<Users size={20} />} label="المسوقون" value={String(stats.totalAffiliates)} color="purple" />
        <StatCard icon={<Megaphone size={20} />} label="طلبات مسوقين معلقة" value={String(stats.pendingAffiliates)} color="accent" />
      </div>

      {/* Recent orders */}
      <div className="card p-6">
        <h2 className="mb-4 font-bold text-ink-900">أحدث الطلبات</h2>
        {recentOrders.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-400">لا توجد طلبات</p>
        ) : (
          <div className="space-y-2">
            {recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between rounded-lg border border-ink-50 p-3 text-sm">
                <div>
                  <p className="font-semibold text-ink-900">{order.order_number}</p>
                  <p className="text-xs text-ink-500">{formatDate(order.created_at)}</p>
                </div>
                <p className="font-bold text-primary-700">{formatPrice(order.total)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Low stock */}
      {lowStockBooks.length > 0 && (
        <div className="card p-6">
          <h2 className="mb-4 flex items-center gap-2 font-bold text-ink-900">
            <TrendingUp size={20} className="text-red-500" /> تنبيه المخزون المنخفض
          </h2>
          <div className="space-y-2">
            {lowStockBooks.map((book) => (
              <div key={book.id} className="flex items-center justify-between rounded-lg border border-ink-50 p-3 text-sm">
                <span className="font-semibold text-ink-900">{book.title}</span>
                <span className={`badge ${book.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-accent-100 text-accent-700'}`}>
                  {book.stock} نسخة
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    primary: 'bg-primary-50 text-primary-600',
    accent: 'bg-accent-50 text-accent-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <div className="card p-4">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${colors[color]}`}>{icon}</div>
      <p className="text-sm text-ink-500">{label}</p>
      <p className="text-xl font-bold text-ink-900">{value}</p>
    </div>
  );
}
