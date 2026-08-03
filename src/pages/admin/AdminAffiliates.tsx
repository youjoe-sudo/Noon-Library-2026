import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import type { AffiliateProfile, Withdrawal, PromoCode, Profile } from '@/lib/types';
import {
  AFFILIATE_STATUS_LABELS, AFFILIATE_STATUS_COLORS, PAYOUT_METHODS,
  WITHDRAWAL_STATUS_LABELS, WITHDRAWAL_STATUS_COLORS,
  ROLE_LABELS, ROLE_COLORS,
  formatPrice, formatDate, formatDateTime,
} from '@/lib/constants';
import {
  Check, X, Wallet, Search, Ban, Trash2, UserCog, Shield,
  ShieldCheck, ShieldOff, UserPlus, UserMinus, Power, PowerOff,
  Pencil, Save,
} from 'lucide-react';

export function AdminAffiliates() {
  const { profile } = useAuth();
  const { show } = useToast();
  const [affiliates, setAffiliates] = useState<AffiliateProfile[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [tab, setTab] = useState<'affiliates' | 'withdrawals' | 'promos' | 'users'>('affiliates');
  const [editingAffiliate, setEditingAffiliate] = useState<AffiliateProfile | null>(null);
  const [editForm, setEditForm] = useState({ referral_code: '', commission_rate: '', customer_discount: '', status: '', notes: '' });

  const fetchAll = async () => {
    const [affs, wds, prs, usrs] = await Promise.all([
      supabase.from('affiliate_profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('withdrawals').select('*').order('created_at', { ascending: false }),
      supabase.from('promo_codes').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    ]);
    setAffiliates((affs.data as AffiliateProfile[]) ?? []);
    setWithdrawals((wds.data as Withdrawal[]) ?? []);
    setPromos((prs.data as PromoCode[]) ?? []);
    setUsers((usrs.data as Profile[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const updateAffiliateStatus = async (id: string, status: 'active' | 'rejected' | 'disabled', reason?: string) => {
    if (!profile) return;
    if (status === 'active') {
      const { error } = await supabase.rpc('approve_affiliate', { p_affiliate_id: id, p_admin_id: profile.id });
      if (error) { show('فشل تفعيل المسوق', 'error'); return; }
      show('تم تفعيل المسوق', 'success');
    } else if (status === 'disabled') {
      const { error } = await supabase.rpc('suspend_affiliate', { p_affiliate_id: id, p_admin_id: profile.id, p_reason: reason ?? null });
      if (error) { show('فشل إيقاف المسوق', 'error'); return; }
      show('تم إيقاف المسوق', 'success');
    } else {
      const payload: Record<string, unknown> = { status };
      if (reason) payload.reject_reason = reason;
      const { error } = await supabase.from('affiliate_profiles').update(payload).eq('id', id);
      if (error) { show('فشل التحديث', 'error'); return; }
      show('تم رفض المسوق', 'success');
    }
    fetchAll();
  };

  const handleDeleteAffiliate = async (id: string) => {
    if (!profile) return;
    if (!confirm('هل أنت متأكد من حذف هذا المسوق نهائياً؟ سيتم حذف جميع البيانات المرتبطة.')) return;
    const { error } = await supabase.rpc('delete_affiliate', { p_affiliate_id: id, p_admin_id: profile.id });
    if (error) { show('فشل الحذف', 'error'); return; }
    show('تم حذف المسوق نهائياً', 'success');
    fetchAll();
  };

  const handleWithdrawal = async (id: string, action: 'approve' | 'reject', reason?: string) => {
    if (!profile) return;
    const { error } = await supabase.rpc('process_withdrawal', {
      p_withdrawal_id: id,
      p_action: action,
      p_admin_id: profile.id,
      p_reject_reason: reason ?? null,
    });
    if (error) { show('فشل معالجة طلب السحب', 'error'); return; }
    show(action === 'approve' ? 'تم صرف المبلغ وتحديث المحفظة' : 'تم رفض طلب السحب', 'success');
    fetchAll();
  };

  // Role management
  const handlePromoteAffiliate = async (userId: string) => {
    if (!profile) return;
    const { error } = await supabase.rpc('promote_to_affiliate', { p_user_id: userId, p_admin_id: profile.id });
    if (error) { show('فشل الترقية', 'error'); return; }
    show('تم ترقية المستخدم إلى مسوق', 'success');
    fetchAll();
  };

  const handleDemoteAffiliate = async (userId: string) => {
    if (!profile) return;
    if (!confirm('هل أنت متأكد من إرجاع هذا المسوق إلى مستخدم عادي؟')) return;
    const { error } = await supabase.rpc('demote_affiliate', { p_user_id: userId, p_admin_id: profile.id });
    if (error) { show('فشل الإرجاع', 'error'); return; }
    show('تم إرجاع المسوق إلى مستخدم عادي', 'success');
    fetchAll();
  };

  const handlePromoteAdmin = async (userId: string) => {
    if (!profile) return;
    if (!confirm('هل أنت متأكد من ترقية هذا المستخدم إلى مشرف؟')) return;
    const { error } = await supabase.rpc('promote_to_admin', { p_user_id: userId, p_admin_id: profile.id });
    if (error) { show('فشل الترقية', 'error'); return; }
    show('تم ترقية المستخدم إلى مشرف', 'success');
    fetchAll();
  };

  const handleDemoteAdmin = async (userId: string) => {
    if (!profile) return;
    if (!confirm('هل أنت متأكد من إزالة صلاحيات المشرف؟')) return;
    const { error } = await supabase.rpc('demote_admin', { p_user_id: userId, p_admin_id: profile.id });
    if (error) { show(error.message, 'error'); return; }
    show('تم إزالة صلاحيات المشرف', 'success');
    fetchAll();
  };

  const handleDisableUser = async (userId: string) => {
    if (!profile) return;
    const reason = prompt('سبب إيقاف الحساب؟ (اختياري)');
    const { error } = await supabase.rpc('disable_user', { p_user_id: userId, p_admin_id: profile.id, p_reason: reason ?? null });
    if (error) { show('فشل إيقاف الحساب', 'error'); return; }
    show('تم إيقاف الحساب', 'success');
    fetchAll();
  };

  const handleEnableUser = async (userId: string) => {
    if (!profile) return;
    const { error } = await supabase.rpc('enable_user', { p_user_id: userId, p_admin_id: profile.id });
    if (error) { show('فشل تفعيل الحساب', 'error'); return; }
    show('تم تفعيل الحساب', 'success');
    fetchAll();
  };

  const handleEditAffiliate = (aff: AffiliateProfile) => {
    setEditForm({
      referral_code: aff.referral_code ?? '',
      commission_rate: aff.custom_commission_rate != null ? String(aff.custom_commission_rate) : '',
      customer_discount: String(aff.customer_discount_percent ?? 0),
      status: aff.status,
      notes: aff.admin_notes ?? '',
    });
    setEditingAffiliate(aff);
  };

  const handleSaveAffiliate = async () => {
    if (!editingAffiliate) return;
    const { error } = await supabase.rpc('update_affiliate_settings', {
      p_affiliate_id: editingAffiliate.id,
      p_referral_code: editForm.referral_code.trim() || null,
      p_commission_rate: editForm.commission_rate ? Number(editForm.commission_rate) : null,
      p_customer_discount: Number(editForm.customer_discount) || 0,
      p_status: editForm.status || null,
      p_notes: editForm.notes || null,
    });
    if (error) { show('فشل تحديث إعدادات المسوق', 'error'); return; }
    show('تم تحديث إعدادات المسوق', 'success');
    setEditingAffiliate(null);
    fetchAll();
  };

  const filteredAff = affiliates.filter((a) =>
    a.full_name.toLowerCase().includes(search.toLowerCase()) ||
    a.phone.includes(search)
  );

  const filteredUsers = users.filter((u) =>
    u.username?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const pendingWithdrawals = withdrawals.filter((w) => w.status === 'pending');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-ink-900">إدارة المسوقين والمستخدمين</h2>
        {pendingWithdrawals.length > 0 && (
          <button onClick={() => setTab('withdrawals')} className="badge bg-accent-100 text-accent-700">
            {pendingWithdrawals.length} طلب سحب معلق
          </button>
        )}
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl bg-ink-100 p-1">
        {([
          ['affiliates', `المسوقون (${affiliates.length})`],
          ['withdrawals', `طلبات السحب (${pendingWithdrawals.length})`],
          ['promos', `الأكواد (${promos.length})`],
          ['users', `المستخدمون (${users.length})`],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              tab === id ? 'bg-white text-primary-700 shadow-soft' : 'text-ink-500 hover:text-ink-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'affiliates' && (
        <div className="space-y-3">
          <div className="relative">
            <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالاسم أو الهاتف..." className="input pr-10" />
          </div>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-28 w-full" />)}</div>
          ) : filteredAff.length === 0 ? (
            <p className="py-12 text-center text-ink-400">لا توجد مسوقون</p>
          ) : (
            filteredAff.map((aff) => (
              <div key={aff.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-ink-900">{aff.full_name}</p>
                      <span className={`badge ${AFFILIATE_STATUS_COLORS[aff.status]}`}>{AFFILIATE_STATUS_LABELS[aff.status]}</span>
                    </div>
                    <p className="text-sm text-ink-500">{aff.phone} • {aff.email}</p>
                    <p className="text-xs text-ink-400">
                      {PAYOUT_METHODS.find((m) => m.value === aff.payout_method)?.label}: <span dir="ltr">{aff.payout_account}</span>
                    </p>
                    {aff.channel_desc && <p className="mt-1 text-xs text-ink-500">{aff.channel_desc}</p>}
                    <div className="mt-2 flex flex-wrap gap-3 text-xs">
                      <span className="text-ink-500">المبيعات: <span className="font-bold text-ink-900">{formatPrice(aff.total_sales)}</span></span>
                      <span className="text-ink-500">المعتمد: <span className="font-bold text-primary-700">{formatPrice(aff.approved_earnings)}</span></span>
                      <span className="text-ink-500">المدفوع: <span className="font-bold text-emerald-700">{formatPrice(aff.paid_earnings)}</span></span>
                      {aff.referral_code && <span className="text-ink-500">الكود: <span className="font-mono font-bold text-ink-900" dir="ltr">{aff.referral_code}</span></span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {aff.status === 'pending' && (
                      <>
                        <button onClick={() => updateAffiliateStatus(aff.id, 'active')} className="btn-primary text-xs"><Check size={14} /> قبول</button>
                        <button onClick={() => { const r = prompt('سبب الرفض؟'); if (r) updateAffiliateStatus(aff.id, 'rejected', r); }} className="btn-danger text-xs"><X size={14} /> رفض</button>
                      </>
                    )}
                    {aff.status === 'active' && (
                      <button onClick={() => { const r = prompt('سبب الإيقاف؟'); updateAffiliateStatus(aff.id, 'disabled', r ?? undefined); }} className="btn-danger text-xs"><Ban size={14} /> إيقاف</button>
                    )}
                    {aff.status === 'disabled' && (
                      <button onClick={() => updateAffiliateStatus(aff.id, 'active')} className="btn-primary text-xs"><Power size={14} /> تفعيل</button>
                    )}
                    {aff.status === 'rejected' && (
                      <button onClick={() => updateAffiliateStatus(aff.id, 'active')} className="btn-primary text-xs"><Power size={14} /> إعادة تفعيل</button>
                    )}
                    {/* Demote to normal user */}
                    <button onClick={() => handleDemoteAffiliate(aff.user_id)} className="btn-ghost text-xs" title="إرجاع إلى مستخدم عادي">
                      <UserMinus size={14} /> إرجاع لمستخدم
                    </button>
                    {/* Edit settings */}
                    <button onClick={() => handleEditAffiliate(aff)} className="btn-outline text-xs" title="تعديل الإعدادات">
                      <Pencil size={14} /> إعدادات
                    </button>
                    {/* Permanent delete */}
                    <button onClick={() => handleDeleteAffiliate(aff.id)} className="btn-danger text-xs" title="حذف نهائي">
                      <Trash2 size={14} /> حذف
                    </button>
                  </div>
                </div>
                {aff.reject_reason && aff.status !== 'active' && (
                  <p className="mt-2 text-xs text-red-600">السبب: {aff.reject_reason}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Affiliate settings edit modal */}
      {editingAffiliate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card max-w-lg p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-bold text-ink-900">
                <UserCog size={20} /> إعدادات المسوق: {editingAffiliate.full_name}
              </h3>
              <button onClick={() => setEditingAffiliate(null)} className="text-ink-400 hover:text-ink-600"><X size={20} /></button>
            </div>
            <div className="grid gap-4">
              <div>
                <label className="label">كود المسوق</label>
                <input value={editForm.referral_code} onChange={(e) => setEditForm({ ...editForm, referral_code: e.target.value })} className="input" dir="ltr" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">نسبة العمولة %</label>
                  <input type="number" value={editForm.commission_rate} onChange={(e) => setEditForm({ ...editForm, commission_rate: e.target.value })} className="input" placeholder="10" />
                </div>
                <div>
                  <label className="label">خصم العميل %</label>
                  <input type="number" value={editForm.customer_discount} onChange={(e) => setEditForm({ ...editForm, customer_discount: e.target.value })} className="input" placeholder="0" />
                </div>
              </div>
              <div>
                <label className="label">الحالة</label>
                <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="input">
                  <option value="active">نشط</option>
                  <option value="disabled">متوقف</option>
                  <option value="pending">قيد المراجعة</option>
                  <option value="rejected">مرفوض</option>
                </select>
              </div>
              <div>
                <label className="label">ملاحظات الإدارة</label>
                <textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} className="input min-h-20" placeholder="ملاحظات داخلية للمسوق" />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={handleSaveAffiliate} className="btn-primary"><Save size={16} /> حفظ الإعدادات</button>
              <button onClick={() => setEditingAffiliate(null)} className="btn-ghost">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {tab === 'withdrawals' && (
        <div className="space-y-3">
          {withdrawals.length === 0 ? (
            <p className="py-12 text-center text-ink-400">لا توجد طلبات سحب</p>
          ) : (
            withdrawals.map((wd) => (
              <div key={wd.id} className="card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-primary-700">{formatPrice(wd.amount)}</p>
                    <p className="text-sm text-ink-500">{formatDateTime(wd.created_at)}</p>
                    <p className="text-xs text-ink-400">
                      {PAYOUT_METHODS.find((m) => m.value === wd.payout_method)?.label}: <span dir="ltr">{wd.payout_account}</span>
                    </p>
                    {wd.paid_at && <p className="text-xs text-emerald-600">تم الصرف: {formatDateTime(wd.paid_at)}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`badge ${WITHDRAWAL_STATUS_COLORS[wd.status] ?? 'bg-ink-100 text-ink-500'}`}>
                      {WITHDRAWAL_STATUS_LABELS[wd.status] ?? wd.status}
                    </span>
                    {wd.status === 'pending' && (
                      <div className="flex gap-1">
                        <button onClick={() => handleWithdrawal(wd.id, 'approve')} className="btn-primary text-xs"><Check size={14} /> صرف</button>
                        <button onClick={() => { const r = prompt('سبب الرفض؟'); handleWithdrawal(wd.id, 'reject', r || undefined); }} className="btn-danger text-xs"><X size={14} /> رفض</button>
                      </div>
                    )}
                  </div>
                </div>
                {wd.reject_reason && <p className="mt-2 text-xs text-red-600">سبب الرفض: {wd.reject_reason}</p>}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'promos' && (
        <div className="space-y-3">
          {promos.length === 0 ? (
            <p className="py-12 text-center text-ink-400">لا توجد أكواد</p>
          ) : (
            promos.map((promo) => (
              <div key={promo.id} className="card flex items-center justify-between p-4">
                <div>
                  <p className="font-mono font-bold text-primary-700" dir="ltr">{promo.code}</p>
                  <p className="text-xs text-ink-500">خصم {promo.discount_percent}%</p>
                  <div className="mt-1 flex gap-3 text-xs text-ink-400">
                    <span>نقرات: {promo.click_count}</span>
                    <span>طلبات: {promo.order_count}</span>
                    <span>مبيعات: {formatPrice(promo.total_sales)}</span>
                  </div>
                </div>
                <span className={`badge ${promo.is_active ? 'bg-primary-100 text-primary-700' : 'bg-ink-100 text-ink-500'}`}>
                  {promo.is_active ? 'نشط' : 'متوقف'}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'users' && (
        <div className="space-y-3">
          <div className="relative">
            <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="ابحث بالاسم أو البريد..." className="input pr-10" />
          </div>
          {filteredUsers.map((u) => (
            <div key={u.id} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-ink-900">{u.username ?? u.email}</p>
                    <span className={`badge ${ROLE_COLORS[u.role]}`}>{ROLE_LABELS[u.role]}</span>
                    {u.is_disabled && <span className="badge bg-red-100 text-red-700">متوقف</span>}
                  </div>
                  <p className="text-sm text-ink-500">{u.email} • {u.phone ?? 'بدون هاتف'}</p>
                  <p className="text-xs text-ink-400">تاريخ التسجيل: {formatDate(u.created_at)}</p>
                  {u.is_disabled && u.disable_reason && <p className="text-xs text-red-600">سبب الإيقاف: {u.disable_reason}</p>}
                </div>
                <div className="flex flex-wrap gap-1">
                  {/* Role controls */}
                  {u.role === 'user' && (
                    <button onClick={() => handlePromoteAffiliate(u.id)} className="btn-outline text-xs" title="ترقية إلى مسوق">
                      <UserPlus size={14} /> مسوق
                    </button>
                  )}
                  {u.role === 'affiliate' && (
                    <button onClick={() => handleDemoteAffiliate(u.id)} className="btn-ghost text-xs" title="إرجاع إلى مستخدم">
                      <UserMinus size={14} /> مستخدم
                    </button>
                  )}
                  {u.role !== 'admin' && (
                    <button onClick={() => handlePromoteAdmin(u.id)} className="btn-outline text-xs" title="ترقية إلى مشرف">
                      <ShieldCheck size={14} /> مشرف
                    </button>
                  )}
                  {u.role === 'admin' && u.id !== profile?.id && (
                    <button onClick={() => handleDemoteAdmin(u.id)} className="btn-ghost text-xs" title="إزالة صلاحيات المشرف">
                      <ShieldOff size={14} /> إزالة مشرف
                    </button>
                  )}
                  {/* Enable/Disable */}
                  {u.is_disabled ? (
                    <button onClick={() => handleEnableUser(u.id)} className="btn-primary text-xs" title="تفعيل الحساب">
                      <Power size={14} /> تفعيل
                    </button>
                  ) : (
                    u.id !== profile?.id && (
                      <button onClick={() => handleDisableUser(u.id)} className="btn-danger text-xs" title="إيقاف الحساب">
                        <PowerOff size={14} /> إيقاف
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
