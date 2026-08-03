import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import type { Profile, NotificationReport } from '@/lib/types';
import { Send, Users, CheckCircle, XCircle, Loader2 } from 'lucide-react';

export function AdminNotifications() {
  const { profile } = useAuth();
  const { show } = useToast();
  const [users, setUsers] = useState<Profile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [sendToAll, setSendToAll] = useState(true);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [report, setReport] = useState<NotificationReport | null>(null);

  useEffect(() => {
    supabase.from('profiles').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      setUsers((data as Profile[]) ?? []);
    });
  }, []);

  const handleSend = async () => {
    if (!title || !message) { show('يرجى إدخال العنوان والرسالة', 'error'); return; }
    if (!profile) return;
    setSending(true);
    setReport(null);

    try {
      if (sendToAll) {
        // Use the server-side RPC function for broadcasting
        const { data, error } = await supabase.rpc('send_notification_all', {
          p_title: title,
          p_message: message,
          p_sender_id: profile.id,
        });

        if (error) {
          show('فشل إرسال الإشعارات: ' + error.message, 'error');
        } else {
          const result = data as NotificationReport;
          setReport(result);
          if (result.success) {
            show(`تم إرسال الإشعار إلى ${result.successfully_sent} مستخدم بنجاح`, 'success');
            if (result.failed > 0) {
              show(`${result.failed} إشعار فشل في الإرسال`, 'error');
            }
          }
        }
      } else {
        // Send to selected users
        if (selectedUsers.length === 0) {
          show('يرجى اختيار مستخدم واحد على الأقل', 'error');
          setSending(false);
          return;
        }

        const notifications = selectedUsers.map((uid) => ({
          user_id: uid,
          title,
          message,
          type: 'admin',
        }));

        let successCount = 0;
        let failCount = 0;
        const errors: Array<{ user_id: string; error: string }> = [];

        for (const notif of notifications) {
          const { error: insertError } = await supabase.from('notifications').insert(notif);
          if (insertError) {
            failCount++;
            errors.push({ user_id: notif.user_id, error: insertError.message });
          } else {
            successCount++;
          }
        }

        setReport({
          success: true,
          total_users: selectedUsers.length,
          successfully_sent: successCount,
          failed: failCount,
          errors,
        });

        if (failCount === 0) {
          show(`تم إرسال الإشعار إلى ${successCount} مستخدم بنجاح`, 'success');
        } else {
          show(`تم إرسال ${successCount} بنجاح، وفشل ${failCount}`, 'error');
        }
      }

      setTitle('');
      setMessage('');
      setSelectedUsers([]);
    } catch (err) {
      show('حدث خطأ غير متوقع', 'error');
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="font-bold text-ink-900">إرسال إشعار</h2>

      <div className="card p-6">
        <div className="mb-4 flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="radio" checked={sendToAll} onChange={() => setSendToAll(true)} className="accent-primary-600" />
            <Send size={16} /> إرسال للجميع ({users.filter((u) => !u.is_disabled).length} مستخدم نشط)
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="radio" checked={!sendToAll} onChange={() => setSendToAll(false)} className="accent-primary-600" />
            <Users size={16} /> اختيار مستخدمين
          </label>
        </div>

        {!sendToAll && (
          <div className="mb-4 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-ink-100 p-2">
            {users.map((u) => (
              <label key={u.id} className="flex items-center gap-2 rounded-lg p-2 hover:bg-ink-50">
                <input
                  type="checkbox"
                  checked={selectedUsers.includes(u.id)}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedUsers([...selectedUsers, u.id]);
                    else setSelectedUsers(selectedUsers.filter((id) => id !== u.id));
                  }}
                  className="accent-primary-600"
                />
                <span className="text-sm">{u.username ?? 'مستخدم'} ({u.email})</span>
                {u.is_disabled && <span className="badge bg-red-100 text-red-700">متوقف</span>}
              </label>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="label">عنوان الإشعار</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder="عنوان الإشعار" />
          </div>
          <div>
            <label className="label">نص الرسالة</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} className="input min-h-24" placeholder="نص الإشعار" />
          </div>
          <button onClick={handleSend} disabled={sending} className="btn-primary">
            {sending ? <><Loader2 size={16} className="animate-spin" /> جاري الإرسال...</> : <><Send size={16} /> إرسال الإشعار</>}
          </button>
        </div>
      </div>

      {/* Report */}
      {report && (
        <div className="card p-6">
          <h3 className="mb-4 font-bold text-ink-900">تقرير الإرسال</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-ink-50 p-4 text-center">
              <p className="text-2xl font-bold text-ink-900">{report.total_users}</p>
              <p className="text-sm text-ink-500">إجمالي المستخدمين</p>
            </div>
            <div className="rounded-xl bg-primary-50 p-4 text-center">
              <CheckCircle size={24} className="mx-auto text-primary-600" />
              <p className="mt-1 text-2xl font-bold text-primary-700">{report.successfully_sent}</p>
              <p className="text-sm text-primary-600">تم الإرسال بنجاح</p>
            </div>
            <div className="rounded-xl bg-red-50 p-4 text-center">
              <XCircle size={24} className="mx-auto text-red-600" />
              <p className="mt-1 text-2xl font-bold text-red-700">{report.failed}</p>
              <p className="text-sm text-red-600">فشل</p>
            </div>
          </div>
          {report.errors && report.errors.length > 0 && (
            <div className="mt-4">
              <h4 className="mb-2 text-sm font-semibold text-red-700">تفاصيل الأخطاء:</h4>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg bg-red-50 p-3 text-xs">
                {report.errors.map((err, i) => (
                  <div key={i} className="text-red-600">
                    المستخدم: <span dir="ltr">{err.user_id.slice(0, 8)}...</span> - {err.error}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
