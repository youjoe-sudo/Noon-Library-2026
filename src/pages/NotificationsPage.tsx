import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Notification } from '@/lib/types';
import { formatDateTime } from '@/lib/constants';
import { Bell, CheckCheck } from 'lucide-react';

export function NotificationsPage() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    if (!profile) return;
    const { data } = await supabase.from('notifications').select('*').eq('user_id', profile.id).order('created_at', { ascending: false });
    setNotifications((data as Notification[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [profile]);

  const markAllRead = async () => {
    if (!profile) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', profile.id).eq('is_read', false);
    fetch();
  };

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    fetch();
  };

  if (loading) {
    return <div className="mx-auto max-w-3xl px-4 py-12"><div className="skeleton h-8 w-32" /><div className="mt-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-20 w-full" />)}</div></div>;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="section-title">الإشعارات</h1>
        {notifications.some((n) => !n.is_read) && (
          <button onClick={markAllRead} className="btn-ghost text-sm">
            <CheckCheck size={16} /> تعليم الكل كمقروء
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="py-20 text-center">
          <Bell size={64} className="mx-auto text-ink-300" />
          <h2 className="mt-4 text-xl font-bold text-ink-900">لا توجد إشعارات</h2>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.is_read && markRead(n.id)}
              className={`card cursor-pointer p-4 transition-colors ${!n.is_read ? 'border-r-4 border-r-primary-500' : 'opacity-70'}`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${!n.is_read ? 'bg-primary-100 text-primary-600' : 'bg-ink-100 text-ink-400'}`}>
                  <Bell size={16} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-ink-900">{n.title}</p>
                  <p className="mt-0.5 text-sm text-ink-600">{n.message}</p>
                  <p className="mt-1 text-xs text-ink-400">{formatDateTime(n.created_at)}</p>
                </div>
                {!n.is_read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary-500" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
