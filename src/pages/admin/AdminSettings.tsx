import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/lib/settings';
import { useToast } from '@/lib/toast';
import { Save, Truck, CreditCard, Percent, Wallet } from 'lucide-react';

export function AdminSettings() {
  const { settings, refresh } = useSettings();
  const { show } = useToast();
  const [form, setForm] = useState<Record<string, string>>(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(settings); }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    const updates = Object.entries(form)
      .filter(([key, value]) => settings[key] !== value)
      .map(([key, value]) => ({ key, value }));
    if (updates.length === 0) { setSaving(false); return; }
    const { error } = await supabase.from('settings').upsert(updates, { onConflict: 'key' });
    if (error) { show('فشل حفظ الإعدادات', 'error'); }
    else {
      show('تم حفظ الإعدادات', 'success');
      await refresh();
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-ink-900">إعدادات المتجر</h2>
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          <Save size={16} /> {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
        </button>
      </div>

      {/* Shipping */}
      <section className="card p-6">
        <h3 className="mb-4 flex items-center gap-2 font-bold text-ink-900">
          <Truck size={20} className="text-primary-600" /> إعدادات الشحن
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="القاهرة والجيزة (ج.م)" value={form.shipping_cairo_giza ?? ''} onChange={(v) => setForm({ ...form, shipping_cairo_giza: v })} />
          <Field label="المحافظات الكبرى (ج.م)" value={form.shipping_metro ?? ''} onChange={(v) => setForm({ ...form, shipping_metro: v })} />
          <Field label="القناة والسفلى (ج.م)" value={form.shipping_lower_canal ?? ''} onChange={(v) => setForm({ ...form, shipping_lower_canal: v })} />
          <Field label="الصعيد (ج.م)" value={form.shipping_upper ?? ''} onChange={(v) => setForm({ ...form, shipping_upper: v })} />
          <Field label="المناطق النائية (ج.م)" value={form.shipping_remote ?? ''} onChange={(v) => setForm({ ...form, shipping_remote: v })} />
          <Field label="الشحن البريدي (ج.م)" value={form.shipping_postal ?? ''} onChange={(v) => setForm({ ...form, shipping_postal: v })} />
          <Field label="إضافة لأكثر من 10 كتب (ج.م)" value={form.shipping_extra_over10 ?? ''} onChange={(v) => setForm({ ...form, shipping_extra_over10: v })} />
          <Field label="حد الشحن المجاني (ج.م)" value={form.free_shipping_threshold ?? ''} onChange={(v) => setForm({ ...form, free_shipping_threshold: v })} />
        </div>
      </section>

      {/* Commission */}
      <section className="card p-6">
        <h3 className="mb-4 flex items-center gap-2 font-bold text-ink-900">
          <Percent size={20} className="text-primary-600" /> إعدادات العمولة
        </h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="نسبة العمولة الافتراضية (%)" value={form.default_commission_rate ?? ''} onChange={(v) => setForm({ ...form, default_commission_rate: v })} />
          <Field label="مكافأة 10 طلبات (+%)" value={form.bonus_10_orders_boost ?? ''} onChange={(v) => setForm({ ...form, bonus_10_orders_boost: v })} />
          <Field label="مكافأة 50 طلب (+%)" value={form.bonus_50_orders_boost ?? ''} onChange={(v) => setForm({ ...form, bonus_50_orders_boost: v })} />
        </div>
      </section>

      {/* Withdrawal */}
      <section className="card p-6">
        <h3 className="mb-4 flex items-center gap-2 font-bold text-ink-900">
          <Wallet size={20} className="text-primary-600" /> إعدادات السحب
        </h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="حد أدنى للسحب (ج.م)" value={form.withdrawal_threshold ?? ''} onChange={(v) => setForm({ ...form, withdrawal_threshold: v })} />
        </div>
      </section>

      {/* Payment accounts */}
      <section className="card p-6">
        <h3 className="mb-4 flex items-center gap-2 font-bold text-ink-900">
          <CreditCard size={20} className="text-primary-600" /> حسابات الدفع
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="فودافون كاش" value={form.payment_account_vodafone ?? ''} onChange={(v) => setForm({ ...form, payment_account_vodafone: v })} dir="ltr" />
          <Field label="إنستا باي" value={form.payment_account_instapay ?? ''} onChange={(v) => setForm({ ...form, payment_account_instapay: v })} dir="ltr" />
          <Field label="رقم الحساب البنكي" value={form.payment_account_bank ?? ''} onChange={(v) => setForm({ ...form, payment_account_bank: v })} dir="ltr" />
          <Field label="اسم البنك" value={form.payment_bank_name ?? ''} onChange={(v) => setForm({ ...form, payment_bank_name: v })} />
          <Field label="اسم صاحب الحساب" value={form.payment_account_holder ?? ''} onChange={(v) => setForm({ ...form, payment_account_holder: v })} />
        </div>
      </section>
    </div>
  );
}

function Field({ label, value, onChange, dir }: { label: string; value: string; onChange: (v: string) => void; dir?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="input" dir={dir} />
    </div>
  );
}
