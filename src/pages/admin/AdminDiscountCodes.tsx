import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import type { DiscountCode } from '@/lib/types';
import { formatPrice, formatDateTime } from '@/lib/constants';
import { Plus, Pencil, Trash2, X, Search, Tag, TrendingUp, Percent, DollarSign, AlertCircle } from 'lucide-react';

export function AdminDiscountCodes() {
  const { show } = useToast();
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: '',
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: 10,
    is_active: true,
    expires_at: '',
    max_uses: '',
    uses_per_user: '',
    min_order_amount: '',
    notes: '',
  });

  const fetchCodes = async () => {
    const { data } = await supabase.from('discount_codes').select('*').order('created_at', { ascending: false });
    setCodes((data as DiscountCode[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchCodes(); }, []);

  const resetForm = () => {
    setForm({ code: '', discount_type: 'percentage', discount_value: 10, is_active: true, expires_at: '', max_uses: '', uses_per_user: '', min_order_amount: '', notes: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (c: DiscountCode) => {
    setForm({
      code: c.code,
      discount_type: c.discount_type,
      discount_value: c.discount_value,
      is_active: c.is_active,
      expires_at: c.expires_at ? c.expires_at.slice(0, 16) : '',
      max_uses: c.max_uses?.toString() ?? '',
      uses_per_user: c.uses_per_user?.toString() ?? '',
      min_order_amount: c.min_order_amount?.toString() ?? '',
      notes: c.notes ?? '',
    });
    setEditingId(c.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim()) { show('يرجى إدخال الكود', 'error'); return; }
    const payload = {
      code: form.code.trim().toUpperCase(),
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      is_active: form.is_active,
      expires_at: form.expires_at || null,
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      uses_per_user: form.uses_per_user ? Number(form.uses_per_user) : null,
      min_order_amount: form.min_order_amount ? Number(form.min_order_amount) : null,
      notes: form.notes || null,
    };
    if (editingId) {
      const { error } = await supabase.from('discount_codes').update(payload).eq('id', editingId);
      if (error) { show(error.code === '23505' ? 'الكود مستخدم بالفعل' : 'فشل التحديث', 'error'); return; }
      show('تم تحديث كود الخصم', 'success');
    } else {
      const { error } = await supabase.from('discount_codes').insert(payload);
      if (error) { show(error.code === '23505' ? 'الكود مستخدم بالفعل' : 'فشل الإضافة', 'error'); return; }
      show('تمت إضافة كود الخصم', 'success');
    }
    resetForm();
    fetchCodes();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الكود؟')) return;
    const { error } = await supabase.from('discount_codes').delete().eq('id', id);
    if (error) { show('فشل الحذف', 'error'); return; }
    show('تم حذف الكود', 'success');
    fetchCodes();
  };

  const toggleActive = async (c: DiscountCode) => {
    await supabase.from('discount_codes').update({ is_active: !c.is_active }).eq('id', c.id);
    fetchCodes();
  };

  const filtered = codes.filter((c) => c.code.toLowerCase().includes(search.toLowerCase()));
  const activeCount = codes.filter((c) => c.is_active).length;
  const expiredCount = codes.filter((c) => c.expires_at && new Date(c.expires_at) < new Date()).length;
  const totalUsed = codes.reduce((sum, c) => sum + c.used_count, 0);
  const totalDiscount = codes.reduce((sum, c) => sum + c.total_discount_given, 0);
  const totalRevenue = codes.reduce((sum, c) => sum + c.total_revenue, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-ink-900">أكواد الخصم ({codes.length})</h2>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary">
          <Plus size={18} /> إضافة كود
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatBox icon={<Tag size={18} />} label="إجمالي الأكواد" value={String(codes.length)} />
        <StatBox icon={<Tag size={18} />} label="أكواد نشطة" value={String(activeCount)} />
        <StatBox icon={<AlertCircle size={18} />} label="أكواد منتهية" value={String(expiredCount)} />
        <StatBox icon={<TrendingUp size={18} />} label="مرات الاستخدام" value={String(totalUsed)} />
        <StatBox icon={<Percent size={18} />} label="إجمالي الخصم" value={formatPrice(totalDiscount)} />
        <StatBox icon={<DollarSign size={18} />} label="الإيرادات" value={formatPrice(totalRevenue)} />
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold text-ink-900">{editingId ? 'تعديل كود خصم' : 'كود خصم جديد'}</h3>
            <button type="button" onClick={resetForm} className="text-ink-400 hover:text-ink-600"><X size={20} /></button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="label">الكود *</label>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="input" dir="ltr" placeholder="SUMMER20" />
            </div>
            <div>
              <label className="label">نوع الخصم</label>
              <select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value as 'percentage' | 'fixed' })} className="input">
                <option value="percentage">نسبة مئوية %</option>
                <option value="fixed">مبلغ ثابت</option>
              </select>
            </div>
            <div>
              <label className="label">قيمة الخصم</label>
              <input type="number" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: Number(e.target.value) })} className="input" />
            </div>
            <div>
              <label className="label">تاريخ الانتهاء</label>
              <input type="datetime-local" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} className="input" dir="ltr" />
            </div>
            <div>
              <label className="label">حد الاستخدام الكلي</label>
              <input type="number" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} className="input" placeholder="غير محدود" />
            </div>
            <div>
              <label className="label">حد الاستخدام لكل مستخدم</label>
              <input type="number" value={form.uses_per_user} onChange={(e) => setForm({ ...form, uses_per_user: e.target.value })} className="input" placeholder="غير محدود" />
            </div>
            <div>
              <label className="label">الحد الأدنى للطلب</label>
              <input type="number" value={form.min_order_amount} onChange={(e) => setForm({ ...form, min_order_amount: e.target.value })} className="input" placeholder="0" />
            </div>
            <div>
              <label className="label">ملاحظات</label>
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input" />
            </div>
            <div className="flex items-end">
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="accent-primary-600" />
                <span className="text-sm font-semibold text-ink-700">نشط</span>
              </label>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" className="btn-primary">{editingId ? 'تحديث' : 'إضافة'}</button>
            <button type="button" onClick={resetForm} className="btn-ghost">إلغاء</button>
          </div>
        </form>
      )}

      <div className="relative">
        <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث عن كود..." className="input pr-10" />
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-20 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-ink-400">لا توجد أكواد خصم</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const isExpired = c.expires_at && new Date(c.expires_at) < new Date();
            return (
              <div key={c.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-mono font-bold text-primary-700" dir="ltr">{c.code}</p>
                      <span className={`badge ${c.is_active ? 'bg-primary-100 text-primary-700' : 'bg-ink-100 text-ink-500'}`}>
                        {c.is_active ? 'نشط' : 'متوقف'}
                      </span>
                      {isExpired && <span className="badge bg-red-100 text-red-700">منتهي</span>}
                    </div>
                    <p className="mt-1 text-sm text-ink-600">
                      {c.discount_type === 'percentage' ? `خصم ${c.discount_value}%` : `خصم ${formatPrice(c.discount_value)}`}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-ink-400">
                      <span>الاستخدام: {c.used_count}{c.max_uses ? `/${c.max_uses}` : ''}</span>
                      {c.uses_per_user && <span>لكل مستخدم: {c.uses_per_user}</span>}
                      {c.min_order_amount && <span>الحد الأدنى: {formatPrice(c.min_order_amount)}</span>}
                      {c.expires_at && <span>ينتهي: {formatDateTime(c.expires_at)}</span>}
                      <span>خصم معطى: {formatPrice(c.total_discount_given)}</span>
                      <span>إيرادات: {formatPrice(c.total_revenue)}</span>
                    </div>
                    {c.notes && <p className="mt-1 text-xs text-ink-500">ملاحظات: {c.notes}</p>}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => toggleActive(c)} className="rounded-lg p-2 text-ink-500 hover:bg-ink-100" title={c.is_active ? 'إيقاف' : 'تفعيل'}>
                      {c.is_active ? <X size={16} /> : <Plus size={16} />}
                    </button>
                    <button onClick={() => handleEdit(c)} className="rounded-lg p-2 text-ink-500 hover:bg-ink-100">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => handleDelete(c.id)} className="rounded-lg p-2 text-red-500 hover:bg-red-50">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="card p-3">
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-600">{icon}</div>
      <p className="text-xs text-ink-500">{label}</p>
      <p className="text-lg font-bold text-ink-900">{value}</p>
    </div>
  );
}
