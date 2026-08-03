import { useState, useEffect, useCallback } from 'react';
import { Link } from '@/components/Link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { useHashRoute } from '@/lib/router';
import type { AffiliateProfile, PromoCode, Commission, AffiliateStats, Withdrawal, AffiliateActivityLog } from '@/lib/types';
import {
  PAYOUT_METHODS, AFFILIATE_STATUS_LABELS, AFFILIATE_STATUS_COLORS,
  formatPrice, formatDate,
} from '@/lib/constants';
import {
  Megaphone, TrendingUp, Wallet, Copy, Check, Plus, Link2,
  Users, DollarSign, ShoppingBag, MousePointerClick, Target,
  ArrowLeft, Activity,
} from 'lucide-react';

export function AffiliatePage() {
  const { profile } = useAuth();
  const { show } = useToast();
  const { navigate } = useHashRoute();
  const [affiliate, setAffiliate] = useState<AffiliateProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  // Registration form
  const [regForm, setRegForm] = useState({
    full_name: '', phone: '', email: '', payout_method: 'vodafone_cash' as 'vodafone_cash' | 'instapay' | 'bank_transfer',
    payout_account: '', channel_desc: '',
  });
  const [registering, setRegistering] = useState(false);

  // Promo codes
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [newPromo, setNewPromo] = useState({ code: '', discount_percent: 10 });

  // Stats and commissions
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [activityLogs, setActivityLogs] = useState<AffiliateActivityLog[]>([]);
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');

  const fetchAll = useCallback(async () => {
    if (!profile) return;
    const { data: aff } = await supabase.from('affiliate_profiles').select('*').eq('user_id', profile.id).maybeSingle();
    setAffiliate(aff as AffiliateProfile | null);
    if (aff) {
      const a = aff as AffiliateProfile;
      const [promos, comms, wds, logs, statsResult] = await Promise.all([
        supabase.from('promo_codes').select('*').eq('affiliate_id', a.id).order('created_at', { ascending: false }),
        supabase.from('commissions').select('*, order:orders(*)').eq('affiliate_id', a.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('withdrawals').select('*').eq('affiliate_id', a.id).order('created_at', { ascending: false }),
        supabase.from('affiliate_activity_logs').select('*').eq('affiliate_id', a.id).order('created_at', { ascending: false }).limit(20),
        supabase.rpc('get_affiliate_stats', { p_affiliate_id: a.id }),
      ]);
      setPromoCodes((promos.data as PromoCode[]) ?? []);
      setCommissions((comms.data as Commission[]) ?? []);
      setWithdrawals((wds.data as Withdrawal[]) ?? []);
      setActivityLogs((logs.data as AffiliateActivityLog[]) ?? []);
      setStats(statsResult.data as AffiliateStats | null);
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!regForm.full_name || !regForm.phone || !regForm.payout_account) {
      show('يرجى إكمال البيانات المطلوبة', 'error');
      return;
    }
    setRegistering(true);
    const { error } = await supabase.from('affiliate_profiles').insert({
      ...regForm,
      user_id: profile.id,
      email: regForm.email || profile.email,
    });
    if (error) {
      show(error.code === '23505' ? 'أنت مسجل بالفعل كمسوق' : 'فشل التسجيل', 'error');
    } else {
      show('تم التسجيل بنجاح! سيتم مراجعة طلبك', 'success');
      fetchAll();
    }
    setRegistering(false);
  };

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!affiliate) return;
    const code = newPromo.code.trim().toUpperCase();
    if (!code) { show('يرجى إدخال كود', 'error'); return; }
    const { error } = await supabase.from('promo_codes').insert({
      affiliate_id: affiliate.id,
      code,
      type: 'promo',
      discount_percent: newPromo.discount_percent,
    });
    if (error) {
      show(error.code === '23505' ? 'هذا الكود مستخدم بالفعل' : 'فشل إنشاء الكود', 'error');
    } else {
      show('تم إنشاء الكود', 'success');
      setNewPromo({ code: '', discount_percent: 10 });
      setShowPromoForm(false);
      fetchAll();
    }
  };

  const handleWithdraw = async () => {
    if (!affiliate || !stats) return;
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) { show('مبلغ غير صحيح', 'error'); return; }
    if (amount > (stats?.withdrawable ?? 0)) { show('الرصيد غير كافٍ', 'error'); return; }
    const { data, error } = await supabase.rpc('request_withdrawal', {
      p_affiliate_id: affiliate.id,
      p_amount: amount,
      p_payout_method: affiliate.payout_method,
      p_payout_account: affiliate.payout_account,
    });
    if (error) { show('فشل طلب السحب', 'error'); return; }
    const result = data as { success: boolean; error?: string };
    if (!result.success) { show(result.error ?? 'فشل طلب السحب', 'error'); return; }
    show('تم إرسال طلب السحب', 'success');
    setWithdrawAmount('');
    setShowWithdrawForm(false);
    fetchAll();
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!profile) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <Megaphone size={64} className="mx-auto text-ink-300" />
        <h2 className="mt-4 text-xl font-bold text-ink-900">سجل دخول للوصول لبرنامج التسويق</h2>
        <Link to="/login" className="btn-primary mt-4">تسجيل الدخول</Link>
      </div>
    );
  }

  if (loading) {
    return <div className="mx-auto max-w-7xl px-4 py-12"><div className="skeleton h-8 w-48" /><div className="mt-6 space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-32 w-full" />)}</div></div>;
  }

  // Not registered yet
  if (!affiliate) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-100 text-accent-600">
            <Megaphone size={32} />
          </div>
          <h1 className="font-serif text-3xl font-bold text-ink-900">التسويق بالعمولة</h1>
          <p className="mt-2 text-ink-500">سوق لكتبنا واكسب العمولة على كل طلب</p>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <InfoCard icon={<Link2 size={20} />} title="أنشئ كود خصم" desc="احصل على كود خصم خاص بك" />
          <InfoCard icon={<Users size={20} />} title="شارك الكود" desc="شاركه مع متابعيك وأصدقائك" />
          <InfoCard icon={<Wallet size={20} />} title="استلم العمولة" desc="احصل على عمولة كل طلب" />
        </div>

        <form onSubmit={handleRegister} className="card p-6">
          <h2 className="mb-4 font-bold text-ink-900">طلب الانضمام</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">الاسم الكامل *</label>
              <input value={regForm.full_name} onChange={(e) => setRegForm({ ...regForm, full_name: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">رقم الهاتف *</label>
              <input value={regForm.phone} onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })} className="input" dir="ltr" />
            </div>
            <div>
              <label className="label">البريد الإلكتروني</label>
              <input value={regForm.email} onChange={(e) => setRegForm({ ...regForm, email: e.target.value })} className="input" dir="ltr" />
            </div>
            <div>
              <label className="label">طريقة استلام العمولة *</label>
              <select value={regForm.payout_method} onChange={(e) => setRegForm({ ...regForm, payout_method: e.target.value as 'vodafone_cash' | 'instapay' | 'bank_transfer' })} className="input">
                {PAYOUT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">رقم الحساب / المحفظة *</label>
              <input value={regForm.payout_account} onChange={(e) => setRegForm({ ...regForm, payout_account: e.target.value })} className="input" dir="ltr" placeholder="رقم المحفظة أو الحساب البنكي" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">وصف القناة / المنصة</label>
              <textarea value={regForm.channel_desc} onChange={(e) => setRegForm({ ...regForm, channel_desc: e.target.value })} className="input min-h-20" placeholder="صف كيف ستسوق للكتب (فيسبوك، يوتيوب، تيك توك، إلخ)" />
            </div>
          </div>
          <button type="submit" disabled={registering} className="btn-primary mt-6 w-full">
            {registering ? 'جاري الإرسال...' : 'تقديم الطلب'}
          </button>
        </form>
      </div>
    );
  }

  // Pending or rejected
  if (affiliate.status === 'pending' || affiliate.status === 'rejected') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl ${AFFILIATE_STATUS_COLORS[affiliate.status]}`}>
          <Megaphone size={32} />
        </div>
        <h1 className="font-serif text-2xl font-bold text-ink-900">حالة طلبك: {AFFILIATE_STATUS_LABELS[affiliate.status]}</h1>
        {affiliate.status === 'pending' ? (
          <p className="mt-2 text-ink-500">طلبك قيد المراجعة. سيتم إشعارك عند الموافقة.</p>
        ) : (
          <div className="mt-4">
            <p className="text-red-600">تم رفض طلبك.</p>
            {affiliate.reject_reason && <p className="mt-2 text-sm text-ink-500">السبب: {affiliate.reject_reason}</p>}
          </div>
        )}
      </div>
    );
  }

  if (affiliate.status === 'disabled') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <h1 className="font-serif text-2xl font-bold text-ink-900">حسابك متوقف</h1>
        <p className="mt-2 text-ink-500">يرجى التواصل مع الإدارة.</p>
      </div>
    );
  }

  // Active affiliate dashboard
  const siteUrl = window.location.origin + window.location.pathname;
  const referralLink = affiliate.referral_code ? `${siteUrl}?ref=${affiliate.referral_code}` : '';

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="section-title">لوحة المسوق</h1>
        <span className={`badge ${AFFILIATE_STATUS_COLORS[affiliate.status]}`}>
          {AFFILIATE_STATUS_LABELS[affiliate.status]}
        </span>
      </div>

      {/* Real stats from database */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<MousePointerClick size={20} />} label="إجمالي النقرات" value={String(stats?.total_clicks ?? 0)} color="blue" />
        <StatCard icon={<Users size={20} />} label="زوار فريدون" value={String(stats?.unique_visitors ?? 0)} color="purple" />
        <StatCard icon={<ShoppingBag size={20} />} label="إجمالي الطلبات" value={String(stats?.total_orders ?? 0)} color="emerald" />
        <StatCard icon={<Target size={20} />} label="معدل التحويل" value={`${stats?.conversion_rate ?? 0}%`} color="accent" />
        <StatCard icon={<DollarSign size={20} />} label="الإيرادات المُولجة" value={formatPrice(stats?.revenue ?? 0)} color="primary" />
        <StatCard icon={<TrendingUp size={20} />} label="إجمالي العمولة" value={formatPrice(stats?.total_commission ?? 0)} color="emerald" />
        <StatCard icon={<Wallet size={20} />} label="عمولة معلقة" value={formatPrice(stats?.pending_commission ?? 0)} color="accent" />
        <StatCard icon={<Wallet size={20} />} label="عمولة معتمدة" value={formatPrice(stats?.approved_commission ?? 0)} color="primary" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
        <div className="space-y-6">
          {/* Referral link */}
          {referralLink && (
            <section className="card p-6">
              <h2 className="mb-4 flex items-center gap-2 font-bold text-ink-900">
                <Link2 size={20} className="text-primary-600" /> رابط الإحالة الدائم
              </h2>
              <div className="flex items-center gap-2 rounded-xl bg-ink-50 p-3">
                <span className="flex-1 truncate text-sm text-ink-600" dir="ltr">{referralLink}</span>
                <button
                  onClick={() => copyToClipboard(referralLink, 'reflink')}
                  className="rounded-lg bg-primary-600 p-2 text-white hover:bg-primary-700"
                >
                  {copied === 'reflink' ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
              <p className="mt-2 text-xs text-ink-400">صالح لمدة 30 يوماً لكل زائر. يُستبدل تلقائياً عند فتح رابط إحالة آخر.</p>
            </section>
          )}

          {/* Promo codes */}
          <section className="card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-bold text-ink-900">أكواد الخصم</h2>
              <button onClick={() => setShowPromoForm(!showPromoForm)} className="btn-outline text-sm">
                <Plus size={16} /> كود جديد
              </button>
            </div>

            {showPromoForm && (
              <form onSubmit={handleCreatePromo} className="mb-4 rounded-xl bg-ink-50 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label">الكود</label>
                    <input value={newPromo.code} onChange={(e) => setNewPromo({ ...newPromo, code: e.target.value })} className="input" dir="ltr" placeholder="NOON10" />
                  </div>
                  <div>
                    <label className="label">نسبة الخصم (%)</label>
                    <input type="number" value={newPromo.discount_percent} onChange={(e) => setNewPromo({ ...newPromo, discount_percent: parseFloat(e.target.value) || 10 })} className="input" min="1" max="50" />
                  </div>
                </div>
                <button type="submit" className="btn-primary mt-3">إنشاء</button>
              </form>
            )}

            {promoCodes.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-400">لم تنشئ أي أكواد بعد</p>
            ) : (
              <div className="space-y-3">
                {promoCodes.map((promo) => (
                  <div key={promo.id} className="rounded-xl border border-ink-100 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-primary-50 px-3 py-1.5 font-mono font-bold text-primary-700" dir="ltr">{promo.code}</div>
                        <span className="badge bg-accent-100 text-accent-700">خصم {promo.discount_percent}%</span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(promo.code, promo.id)}
                        className="rounded-lg p-2 text-ink-500 hover:bg-ink-100"
                      >
                        {copied === promo.id ? <Check size={16} className="text-primary-600" /> : <Copy size={16} />}
                      </button>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-lg bg-ink-50 p-2">
                        <p className="font-bold text-ink-900">{promo.order_count}</p>
                        <p className="text-ink-500">طلبات</p>
                      </div>
                      <div className="rounded-lg bg-ink-50 p-2">
                        <p className="font-bold text-ink-900">{formatPrice(promo.total_sales)}</p>
                        <p className="text-ink-500">مبيعات</p>
                      </div>
                      <div className="rounded-lg bg-ink-50 p-2">
                        <p className="font-bold text-ink-900">{promo.is_active ? 'نشط' : 'متوقف'}</p>
                        <p className="text-ink-500">الحالة</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Commission records */}
          <section className="card p-6">
            <h2 className="mb-4 font-bold text-ink-900">سجل العمولات</h2>
            {commissions.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-400">لا توجد عمولات بعد</p>
            ) : (
              <div className="space-y-2">
                {commissions.map((comm) => (
                  <div key={comm.id} className="flex items-center justify-between rounded-lg border border-ink-50 p-3 text-sm">
                    <div>
                      <p className="font-semibold text-ink-900">{comm.order?.order_number ?? '---'}</p>
                      <p className="text-xs text-ink-500">
                        {comm.commission_source === 'coupon' ? `كوبون: ${comm.coupon_code}` : `إحالة: ${comm.referral_code}`}
                      </p>
                      <p className="text-xs text-ink-400">{formatDate(comm.created_at)}</p>
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-primary-700">{formatPrice(comm.commission_amount)}</p>
                      <span className={`badge text-xs ${
                        comm.status === 'paid' ? 'bg-primary-100 text-primary-700' :
                        comm.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                        comm.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                        'bg-accent-100 text-accent-700'
                      }`}>
                        {comm.status === 'paid' ? 'مدفوع' : comm.status === 'approved' ? 'معتمد' : comm.status === 'cancelled' ? 'ملغي' : 'معلق'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Activity logs */}
          <section className="card p-6">
            <h2 className="mb-4 flex items-center gap-2 font-bold text-ink-900">
              <Activity size={20} className="text-primary-600" /> سجل النشاط
            </h2>
            {activityLogs.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-400">لا يوجد نشاط مسجل</p>
            ) : (
              <div className="space-y-2">
                {activityLogs.map((log) => (
                  <div key={log.id} className="flex items-center gap-3 rounded-lg border border-ink-50 p-2 text-sm">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-500">
                      <Activity size={14} />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-ink-700">{translateAction(log.action)}</p>
                      <p className="text-xs text-ink-400">{formatDate(log.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Withdrawals */}
          <section className="card p-6">
            <h2 className="mb-4 font-bold text-ink-900">سجل السحب</h2>
            {withdrawals.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-400">لا توجد طلبات سحب</p>
            ) : (
              <div className="space-y-2">
                {withdrawals.map((wd) => (
                  <div key={wd.id} className="flex items-center justify-between rounded-lg border border-ink-50 p-3 text-sm">
                    <div>
                      <p className="font-bold text-ink-900">{formatPrice(wd.amount)}</p>
                      <p className="text-xs text-ink-500">{formatDate(wd.created_at)}</p>
                    </div>
                    <span className={`badge text-xs ${wd.status === 'completed' ? 'bg-primary-100 text-primary-700' : wd.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-accent-100 text-accent-700'}`}>
                      {wd.status === 'completed' ? 'تم الصرف' : wd.status === 'rejected' ? 'مرفوض' : 'معلق'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Wallet sidebar */}
        <div className="card h-fit p-6 lg:sticky lg:top-32">
          <h2 className="mb-4 font-bold text-ink-900">المحفظة</h2>
          <div className="space-y-3 text-sm">
            <WalletRow label="الرصيد القابل للسحب" value={formatPrice(stats?.withdrawable ?? 0)} highlight />
            <WalletRow label="عمولة معلقة" value={formatPrice(stats?.pending_commission ?? 0)} />
            <WalletRow label="عمولة معتمدة" value={formatPrice(stats?.approved_commission ?? 0)} />
            <WalletRow label="عمولة مدفوعة" value={formatPrice(stats?.paid_commission ?? 0)} />
            <div className="border-t border-ink-100 pt-3">
              <WalletRow label="إجمالي الأرباح" value={formatPrice(stats?.total_commission ?? 0)} bold />
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-ink-50 p-3 text-xs text-ink-500">
            <p>طريقة الاستلام: {PAYOUT_METHODS.find((m) => m.value === affiliate.payout_method)?.label}</p>
            <p>الحساب: <span dir="ltr">{affiliate.payout_account}</span></p>
          </div>
          {showWithdrawForm ? (
            <div className="mt-4 space-y-3">
              <div>
                <label className="label">المبلغ المراد سحبه</label>
                <input type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} className="input" placeholder="0.00" />
                <p className="mt-1 text-xs text-ink-400">الحد الأقصى: {formatPrice(stats?.withdrawable ?? 0)}</p>
              </div>
              <button onClick={handleWithdraw} className="btn-primary w-full">تأكيد السحب</button>
              <button onClick={() => setShowWithdrawForm(false)} className="btn-ghost w-full">إلغاء</button>
            </div>
          ) : withdrawals.some((w) => w.status === 'pending') ? (
            <div className="mt-4 rounded-lg bg-accent-50 p-4 text-center text-sm font-semibold text-accent-700">
              لديك طلب سحب قيد المعالجة. يرجى الانتظار حتى يتم إكماله قبل تقديم طلب جديد.
            </div>
          ) : (
            <button
              onClick={() => setShowWithdrawForm(true)}
              disabled={(stats?.withdrawable ?? 0) <= 0}
              className="btn-primary mt-4 w-full"
            >
              <Wallet size={16} /> طلب سحب
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function translateAction(action: string): string {
  const map: Record<string, string> = {
    referral_click: 'نقر على رابط الإحالة',
    coupon_usage: 'استخدام كوبون',
    order_created: 'تم إنشاء طلب',
    order_completed: 'تم إكمال الطلب',
    commission_created: 'تم إنشاء عمولة',
    commission_approved: 'تم اعتماد عمولة',
    commission_paid: 'تم دفع عمولة',
    commission_cancelled: 'تم إلغاء عمولة',
    affiliate_approved: 'تمت الموافقة على المسوق',
    self_referral_blocked: 'تم منع إحالة ذاتية',
  };
  return map[action] ?? action;
}

function InfoCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="card p-4 text-center">
      <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-600">{icon}</div>
      <h3 className="font-semibold text-ink-900">{title}</h3>
      <p className="mt-1 text-xs text-ink-500">{desc}</p>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    primary: 'bg-primary-50 text-primary-600',
    accent: 'bg-accent-50 text-accent-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600',
  };
  return (
    <div className="card p-4">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${colors[color]}`}>{icon}</div>
      <p className="text-sm text-ink-500">{label}</p>
      <p className="text-xl font-bold text-ink-900">{value}</p>
    </div>
  );
}

function WalletRow({ label, value, highlight, bold }: { label: string; value: string; highlight?: boolean; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${highlight ? 'rounded-lg bg-primary-50 p-3' : ''}`}>
      <span className={highlight ? 'font-bold text-primary-800' : 'text-ink-500'}>{label}</span>
      <span className={`${highlight ? 'text-lg font-bold text-primary-700' : bold ? 'font-bold text-ink-900' : 'font-semibold text-ink-900'}`}>{value}</span>
    </div>
  );
}
