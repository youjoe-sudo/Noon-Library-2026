import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useHashRoute } from '@/lib/router';
import { useToast } from '@/lib/toast';
import { Mail, Lock, User, Phone, BookOpen } from 'lucide-react';

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const { signIn, signUp } = useAuth();
  const { navigate } = useHashRoute();
  const { show } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) {
          show(error === 'Invalid login credentials' ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة' : error, 'error');
        } else {
          show('تم تسجيل الدخول بنجاح', 'success');
          navigate('/');
        }
      } else {
        if (password.length < 6) {
          show('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
          setLoading(false);
          return;
        }
        const { error } = await signUp(email, password, username, phone);
        if (error) {
          show(error === 'User already registered' ? 'هذا البريد مسجل بالفعل' : error, 'error');
        } else {
          show('تم إنشاء الحساب بنجاح', 'success');
          navigate('/');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-200px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-600 font-serif text-3xl font-bold text-white shadow-soft">
            ن
          </div>
          <h1 className="font-serif text-2xl font-bold text-ink-900">
            {mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
          </h1>
          <p className="mt-2 text-sm text-ink-500">
            {mode === 'login' ? 'أهلاً بعودتك إلى مكتبة نون' : 'انضم إلى مكتبة نون وابدأ رحلتك المعرفية'}
          </p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="label">الاسم</label>
                  <div className="relative">
                    <User size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      placeholder="اسمك الكريم"
                      className="input pr-10"
                    />
                  </div>
                </div>
                <div>
                  <label className="label">رقم الهاتف</label>
                  <div className="relative">
                    <Phone size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="01xxxxxxxxx"
                      className="input pr-10"
                    />
                  </div>
                </div>
              </>
            )}
            <div>
              <label className="label">البريد الإلكتروني</label>
              <div className="relative">
                <Mail size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="email@example.com"
                  className="input pr-10"
                  dir="ltr"
                />
              </div>
            </div>
            <div>
              <label className="label">كلمة المرور</label>
              <div className="relative">
                <Lock size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="input pr-10"
                  dir="ltr"
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'جاري المعالجة...' : mode === 'login' ? 'دخول' : 'إنشاء الحساب'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-ink-500">
            {mode === 'login' ? (
              <>ليس لديك حساب؟ <button onClick={() => navigate('/signup')} className="link-hover font-semibold">إنشاء حساب</button></>
            ) : (
              <>لديك حساب بالفعل؟ <button onClick={() => navigate('/login')} className="link-hover font-semibold">تسجيل الدخول</button></>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-ink-400">
          <BookOpen size={14} />
          <span>أول حساب يتم إنشاؤه يصبح حساب المشرف تلقائياً</span>
        </div>
      </div>
    </div>
  );
}
