import { useState, useEffect, useCallback } from 'react';
import { Link } from './Link';
import { useHashRoute } from '@/lib/router';
import { useAuth } from '@/lib/auth';
import { useCart } from '@/lib/cart';
import { supabase } from '@/lib/supabase';
import type { Category, Notification } from '@/lib/types';
import { useSettings } from '@/lib/settings';
import {
  Search, ShoppingCart, User, Menu, X, Bell, Heart, LogOut,
  Package, MapPin, Settings, LayoutDashboard, Megaphone, BookOpen, MessageSquare,
} from 'lucide-react';

export function Header() {
  const { route, navigate } = useHashRoute();
  const { profile, signOut } = useAuth();
  const { settings } = useSettings();
  const { count } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    supabase.from('categories').select('*').eq('is_hidden', false).order('sort_order').then(({ data }) => {
      if (data) setCategories(data as Category[]);
    });
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const fetchNotifications = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) setNotifications(data as Notification[]);
  }, [profile]);

  useEffect(() => {
    fetchNotifications();
    if (profile) {
      const channel = supabase
        .channel('notifications')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` }, () => {
          fetchNotifications();
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [fetchNotifications, profile]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setMenuOpen(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setUserMenuOpen(false);
    navigate('/');
  };

  const markAllRead = async () => {
    if (!profile) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', profile.id).eq('is_read', false);
    fetchNotifications();
  };

  return (
    <header className="sticky top-0 z-50 border-b border-ink-100 bg-white/95 backdrop-blur-md">
      {/* Top bar */}
      <div className="bg-primary-800 text-primary-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-1.5 text-xs">
          <p>{settings.announcement_text || 'شحن مجاني للطلبات فوق 500 ج.م'}</p>
          <div className="flex items-center gap-4">
            <Link to="/offers" className="hover:text-white transition-colors">العروض</Link>
            <Link to="/about" className="hover:text-white transition-colors">من نحن</Link>
            <Link to="/contact" className="hover:text-white transition-colors">تواصل معنا</Link>
            <Link to="/affiliate" className="hover:text-white transition-colors">التسويق بالعمولة</Link>
          </div>
        </div>
      </div>

      {/* Main header */}
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <button
          className="lg:hidden text-ink-600"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="القائمة"
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 font-serif text-2xl font-bold text-white shadow-soft">
            ن
          </div>
          <div className="hidden sm:block">
            <h1 className="font-serif text-xl font-bold text-primary-800">{settings.site_name || 'مكتبة نون'}</h1>
            <p className="text-xs text-ink-500">Noon Library</p>
          </div>
        </Link>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="relative flex-1 max-w-xl">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث عن كتاب، مؤلف، أو تصنيف..."
            className="input pr-10"
          />
          <button type="submit" className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-primary-600">
            <Search size={18} />
          </button>
        </form>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {profile && (
            <div className="relative">
              <button
                onClick={() => { setNotifOpen(!notifOpen); setUserMenuOpen(false); }}
                className="relative rounded-lg p-2 text-ink-600 hover:bg-ink-100"
                aria-label="الإشعارات"
              >
                <Bell size={22} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] font-bold text-ink-950">
                    {unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                  <div className="absolute left-0 top-full z-50 mt-2 w-80 animate-scale-in rounded-xl border border-ink-100 bg-white shadow-card">
                    <div className="flex items-center justify-between border-b border-ink-100 p-3">
                      <h3 className="font-semibold text-ink-900">الإشعارات</h3>
                      {unreadCount > 0 && (
                        <button onClick={markAllRead} className="text-xs text-primary-600 hover:underline">
                          تعليم الكل كمقروء
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="p-4 text-center text-sm text-ink-400">لا توجد إشعارات</p>
                      ) : (
                        notifications.map((n) => (
                          <Link
                            key={n.id}
                            to="/notifications"
                            onClick={() => setNotifOpen(false)}
                            className={`block border-b border-ink-50 p-3 hover:bg-ink-50 ${!n.is_read ? 'bg-primary-50/50' : ''}`}
                          >
                            <p className="text-sm font-semibold text-ink-900">{n.title}</p>
                            <p className="mt-0.5 text-xs text-ink-500 line-clamp-2">{n.message}</p>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <Link to="/cart" className="relative rounded-lg p-2 text-ink-600 hover:bg-ink-100">
            <ShoppingCart size={22} />
            {count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-bold text-white">
                {count}
              </span>
            )}
          </Link>

          {profile ? (
            <div className="relative">
              <button
                onClick={() => { setUserMenuOpen(!userMenuOpen); setNotifOpen(false); }}
                className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-ink-100"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
                  {profile.username?.[0]?.toUpperCase() ?? 'U'}
                </div>
              </button>
              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute left-0 top-full z-50 mt-2 w-56 animate-scale-in rounded-xl border border-ink-100 bg-white py-2 shadow-card">
                    <div className="border-b border-ink-100 px-4 py-2">
                      <p className="font-semibold text-ink-900">{profile.username ?? 'المستخدم'}</p>
                      <p className="text-xs text-ink-500">{profile.email}</p>
                    </div>
                    <MenuLink to="/profile" icon={<User size={16} />} onClick={() => setUserMenuOpen(false)}>حسابي</MenuLink>
                    <MenuLink to="/orders" icon={<Package size={16} />} onClick={() => setUserMenuOpen(false)}>طلباتي</MenuLink>
                    <MenuLink to="/wishlist" icon={<Heart size={16} />} onClick={() => setUserMenuOpen(false)}>المفضلة</MenuLink>
                    <MenuLink to="/addresses" icon={<MapPin size={16} />} onClick={() => setUserMenuOpen(false)}>العناوين</MenuLink>
                    <MenuLink to="/affiliate" icon={<Megaphone size={16} />} onClick={() => setUserMenuOpen(false)}>التسويق بالعمولة</MenuLink>
                    <MenuLink to="/tickets" icon={<MessageSquare size={16} />} onClick={() => setUserMenuOpen(false)}>تذاكر الدعم</MenuLink>
                    {profile.role === 'admin' && (
                      <MenuLink to="/admin" icon={<LayoutDashboard size={16} />} onClick={() => setUserMenuOpen(false)}>لوحة التحكم</MenuLink>
                    )}
                    <button
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut size={16} /> تسجيل الخروج
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link to="/login" className="btn-primary text-xs">
              <User size={16} /> دخول
            </Link>
          )}
        </div>
      </div>

      {/* Category nav (desktop) */}
      <nav className="hidden border-t border-ink-100 lg:block">
        <div className="mx-auto flex max-w-7xl items-center gap-1 px-4 py-2">
          <Link to="/" className="rounded-lg px-3 py-1.5 text-sm font-semibold text-ink-700 hover:bg-primary-50 hover:text-primary-700">
            الرئيسية
          </Link>
          <Link to="/books" className="rounded-lg px-3 py-1.5 text-sm font-semibold text-ink-700 hover:bg-primary-50 hover:text-primary-700">
            الكتب
          </Link>
          <Link to="/offers" className="rounded-lg px-3 py-1.5 text-sm font-semibold text-ink-700 hover:bg-primary-50 hover:text-primary-700">
            العروض
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to={`/category/${cat.slug}`}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-ink-700 hover:bg-primary-50 hover:text-primary-700"
            >
              {cat.name_ar}
            </Link>
          ))}
        </div>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-ink-100 bg-white lg:hidden">
          <div className="max-h-[70vh] overflow-y-auto p-4">
            <Link to="/" onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-primary-50">
              الرئيسية
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/category/${cat.slug}`}
                onClick={() => setMenuOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-primary-50"
              >
                {cat.name_ar}
              </Link>
            ))}
            <div className="mt-2 border-t border-ink-100 pt-2">
              <Link to="/affiliate" onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-primary-50">
                <Megaphone size={16} className="inline" /> التسويق بالعمولة
              </Link>
              <Link to="/about" onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-primary-50">
                <BookOpen size={16} className="inline" /> من نحن
              </Link>
              <Link to="/contact" onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-primary-50">
                <Settings size={16} className="inline" /> تواصل معنا
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function MenuLink({ to, icon, children, onClick }: { to: string; icon: React.ReactNode; children: React.ReactNode; onClick?: () => void }) {
  return (
    <Link to={to} onClick={onClick} className="flex items-center gap-2 px-4 py-2 text-sm text-ink-700 hover:bg-ink-50">
      {icon} {children}
    </Link>
  );
}
