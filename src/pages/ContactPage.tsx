import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { supabase } from '@/lib/supabase';
import { Mail, Phone, MapPin, Send, MessageSquare, Clock } from 'lucide-react';
import { SOCIAL_LINKS } from '@/lib/constants';

export function ContactPage() {
  const { profile } = useAuth();
  const { show } = useToast();
  const [form, setForm] = useState({ subject: '', message: '' });
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject || !form.message) { show('يرجى إكمال البيانات', 'error'); return; }
    if (!profile) { show('يرجى تسجيل الدخول لإنشاء تذكرة', 'error'); return; }

    setSending(true);
    const { data, error } = await supabase.rpc('create_ticket', {
      p_subject: form.subject,
      p_message: form.message,
      p_customer_name: profile.username,
      p_customer_email: profile.email,
    });

    if (error || !(data as { success: boolean }).success) {
      show('فشل إنشاء التذكرة', 'error');
    } else {
      show('تم إنشاء تذكرة الدعم بنجاح. سنرد عليك قريباً', 'success');
      setForm({ subject: '', message: '' });
    }
    setSending(false);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="font-serif text-3xl font-bold text-ink-900">تواصل معنا</h1>
        <p className="mt-2 text-ink-500">أرسل لنا رسالتك وسيتم إنشاء تذكرة دعم لمتابعة المحادثة</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_300px]">
        <form onSubmit={handleSubmit} className="card p-6">
          <h2 className="mb-4 flex items-center gap-2 font-bold text-ink-900">
            <MessageSquare size={20} className="text-primary-600" /> إنشاء تذكرة دعم
          </h2>
          <div className="space-y-4">
            <div>
              <label className="label">الموضوع</label>
              <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="input" placeholder="موضوع الرسالة" />
            </div>
            <div>
              <label className="label">الرسالة</label>
              <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="input min-h-32" placeholder="اكتب رسالتك هنا..." />
            </div>
            <button type="submit" disabled={sending} className="btn-primary w-full">
              <Send size={16} /> {sending ? 'جاري الإرسال...' : 'إرسال وإنشاء تذكرة'}
            </button>
          </div>
        </form>

        <div className="space-y-4">
          <div className="card p-6">
            <h3 className="mb-4 font-bold text-ink-900">معلومات التواصل</h3>
            <div className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                  <Phone size={18} />
                </div>
                <div>
                  <p className="font-semibold text-ink-900">الهاتف / واتساب</p>
                  <p className="text-ink-500" dir="ltr">{SOCIAL_LINKS.whatsapp}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                  <Mail size={18} />
                </div>
                <div>
                  <p className="font-semibold text-ink-900">البريد الإلكتروني</p>
                  <p className="text-ink-500" dir="ltr">{SOCIAL_LINKS.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                  <MapPin size={18} />
                </div>
                <div>
                  <p className="font-semibold text-ink-900">العنوان</p>
                  <p className="text-ink-500">القاهرة، جمهورية مصر العربية</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card bg-primary-50 p-6">
            <h3 className="mb-2 flex items-center gap-2 font-bold text-primary-800">
              <Clock size={18} /> ساعات العمل
            </h3>
            <div className="space-y-1 text-sm text-primary-700">
              <p>السبت - الخميس: 9 ص - 9 م</p>
              <p>الجمعة: 2 م - 9 م</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
