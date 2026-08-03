import { useState } from 'react';
import { Link } from '@/components/Link';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { supabase } from '@/lib/supabase';
import { User, Mail, Phone, Camera, Package, Heart, MapPin, Bell, Megaphone, LayoutDashboard } from 'lucide-react';

export function ProfilePage() {
  const { profile, refreshProfile, signOut } = useAuth();
  const { show } = useToast();
  const [username, setUsername] = useState(profile?.username ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [saving, setSaving] = useState(false);

  if (!profile) return null;

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ username, phone }).eq('id', profile.id);
    if (error) { show('فشل التحديث', 'error'); }
    else { show('تم تحديث البيانات', 'success'); await refreshProfile(); }
    setSaving(false);
  };

  const menuItems = [
    { to: '/orders', icon: <Package size={18} />, label: 'طلباتي' },
    { to: '/wishlist', icon: <Heart size={18} />, label: 'المفضلة' },
    { to: '/addresses', icon: <MapPin size={18} />, label: 'العناوين' },
    { to: '/notifications', icon: <Bell size={18} />, label: 'الإشعارات' },
    { to: '/affiliate', icon: <Megaphone size={18} />, label: 'التسويق بالعمولة' },
  ];

  if (profile.role === 'admin') {
    menuItems.push({ to: '/admin', icon: <LayoutDashboard size={18} />, label: 'لوحة التحكم' });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="section-title mb-6">حسابي</h1>

      <div className="grid gap-6 md:grid-cols-[300px_1fr]">
        {/* Sidebar */}
        <div className="space-y-4">
          <div className="card p-6 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary-100 text-3xl font-bold text-primary-700">
              {profile.username?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <h2 className="mt-3 font-bold text-ink-900">{profile.username ?? 'المستخدم'}</h2>
            <p className="text-sm text-ink-500">{profile.email}</p>
            {profile.role === 'admin' && (
              <span className="badge mt-2 bg-primary-100 text-primary-700">مشرف</span>
            )}
          </div>

          <div className="card p-2">
            {menuItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-ink-700 hover:bg-primary-50 hover:text-primary-700"
              >
                <span className="text-primary-600">{item.icon}</span>
                {item.label}
              </Link>
            ))}
            <button
              onClick={() => signOut()}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              <span><User size={18} /></span>
              تسجيل الخروج
            </button>
          </div>
        </div>

        {/* Main */}
        <div className="card p-6">
          <h2 className="mb-6 font-bold text-ink-900">البيانات الشخصية</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">الاسم</label>
              <div className="relative">
                <User size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input value={username} onChange={(e) => setUsername(e.target.value)} className="input pr-10" />
              </div>
            </div>
            <div>
              <label className="label">البريد الإلكتروني</label>
              <div className="relative">
                <Mail size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input value={profile.email ?? ''} disabled className="input pr-10 opacity-60" dir="ltr" />
              </div>
            </div>
            <div>
              <label className="label">رقم الهاتف</label>
              <div className="relative">
                <Phone size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input pr-10" dir="ltr" />
              </div>
            </div>
            <div>
              <label className="label">الصورة الرمزية</label>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-xl font-bold text-primary-700">
                  {username?.[0]?.toUpperCase() ?? 'U'}
                </div>
                <button className="btn-outline text-sm">
                  <Camera size={16} /> تغيير الصورة
                </button>
              </div>
            </div>
          </div>
          <button onClick={handleSave} disabled={saving} className="btn-primary mt-6">
            {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </button>
        </div>
      </div>
    </div>
  );
}
