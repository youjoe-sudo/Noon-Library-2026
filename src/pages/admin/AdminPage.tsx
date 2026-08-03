import { useEffect, useState } from 'react';
import { Link } from '@/components/Link';
import { useAuth } from '@/lib/auth';
import { useHashRoute } from '@/lib/router';
import { AdminDashboard } from './AdminDashboard';
import { AdminBooks } from './AdminBooks';
import { AdminOrders } from './AdminOrders';
import { AdminAffiliates } from './AdminAffiliates';
import { AdminSettings } from './AdminSettings';
import { AdminNotifications } from './AdminNotifications';
import { AdminTickets } from './AdminTickets';
import { AdminSqlRls } from './AdminSqlRls';
import { AdminCategories } from './AdminCategories';
import { AdminDiscountCodes } from './AdminDiscountCodes';
import { AdminDatabase } from './AdminDatabase';
import { LayoutDashboard, BookOpen, Package, Megaphone, Settings, Bell, MessageSquare, Tags, Shield, Ticket, Database as DbIcon } from 'lucide-react';

export function AdminPage() {
  const { profile } = useAuth();
  const { route, navigate } = useHashRoute();
  const [tab, setTab] = useState('dashboard');

  useEffect(() => {
    const parts = route.split('/').filter(Boolean);
    if (parts[1]) setTab(parts[1]);
    else setTab('dashboard');
  }, [route]);

  if (!profile || profile.role !== 'admin') {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <h2 className="text-xl font-bold text-ink-900">غير مصرح لك بالوصول</h2>
        <p className="mt-2 text-ink-500">هذه الصفحة مخصصة للمشرفين فقط</p>
        <Link to="/" className="btn-primary mt-4">العودة للرئيسية</Link>
      </div>
    );
  }

  const tabs = [
    { id: 'dashboard', label: 'لوحة المعلومات', icon: <LayoutDashboard size={18} /> },
    { id: 'books', label: 'الكتب', icon: <BookOpen size={18} /> },
    { id: 'categories', label: 'التصنيفات', icon: <Tags size={18} /> },
    { id: 'orders', label: 'الطلبات', icon: <Package size={18} /> },
    { id: 'affiliates', label: 'المسوقون', icon: <Megaphone size={18} /> },
    { id: 'discount-codes', label: 'أكواد الخصم', icon: <Ticket size={18} /> },
    { id: 'tickets', label: 'التذاكر', icon: <MessageSquare size={18} /> },
    { id: 'notifications', label: 'الإشعارات', icon: <Bell size={18} /> },
    { id: 'settings', label: 'الإعدادات', icon: <Settings size={18} /> },
    { id: 'sql-rls', label: 'SQL RLS', icon: <Shield size={18} /> },
    { id: 'database', label: 'قاعدة البيانات', icon: <DbIcon size={18} /> },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="section-title mb-6">لوحة التحكم</h1>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* Sidebar */}
        <aside className="card h-fit p-2 lg:sticky lg:top-32">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); navigate(`/admin/${t.id}`); }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                tab === t.id ? 'bg-primary-600 text-white' : 'text-ink-700 hover:bg-primary-50'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </aside>

        {/* Content */}
        <div>
          {tab === 'dashboard' && <AdminDashboard />}
          {tab === 'books' && <AdminBooks />}
          {tab === 'categories' && <AdminCategories />}
          {tab === 'orders' && <AdminOrders />}
          {tab === 'affiliates' && <AdminAffiliates />}
          {tab === 'discount-codes' && <AdminDiscountCodes />}
          {tab === 'tickets' && <AdminTickets />}
          {tab === 'notifications' && <AdminNotifications />}
          {tab === 'settings' && <AdminSettings />}
          {tab === 'sql-rls' && <AdminSqlRls />}
          {tab === 'database' && <AdminDatabase />}
        </div>
      </div>
    </div>
  );
}
