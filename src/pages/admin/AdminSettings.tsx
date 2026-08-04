import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/lib/settings';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { Save, Truck, CreditCard, Percent, Wallet, Palette, Type, FileText, Globe } from 'lucide-react';

const AVAILABLE_FONTS = [
  { value: 'Cairo', label: 'Cairo (القاهرة)' },
  { value: 'Amiri', label: 'Amiri (أميري)' },
  { value: 'Tajawal', label: 'Tajawal (تجوال)' },
  { value: 'Almarai', label: 'Almarai (المرعي)' },
  { value: 'Noto Sans Arabic', label: 'Noto Sans Arabic' },
  { value: 'Reem Kufi', label: 'Reem Kufi (ريم كوفي)' },
];

export function AdminSettings() {
  const { settings, refresh } = useSettings();
  const { profile } = useAuth();
  const { show } = useToast();
  const [form, setForm] = useState<Record<string, string>>(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(settings); }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    const updates = Object.entries(form).filter(([key, value]) => settings[key] !== value);
    if (updates.length === 0) { setSaving(false); return; }

    let hasError = false;
    for (const [key, value] of updates) {
      const { error } = await supabase.rpc('update_setting', {
        p_key: key,
        p_value: value,
        p_type: key.startsWith('theme_') ? 'color' : 'string',
      });
      if (error) { hasError = true; console.error(`Failed to save ${key}:`, error); }
    }

    if (hasError) {
      show('فشل حفظ بعض الإعدادات', 'error');
    } else {
      show('تم حفظ الإعدادات بنجاح', 'success');
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

      {/* Theme / Colors */}
      <section className="card p-6">
        <h3 className="mb-4 flex items-center gap-2 font-bold text-ink-900">
          <Palette size={20} className="text-primary-600" /> الألوان والمظهر
        </h3>
        <p className="mb-4 text-sm text-ink-500">تحكم في ألوان الموقع. التغييرات تُطبق فوراً على الموقع بالكامل.</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ColorField label="اللون الأساسي" value={form.theme_primary ?? ''} onChange={(v) => setForm({ ...form, theme_primary: v })} />
          <ColorField label="لون التمييز" value={form.theme_accent ?? ''} onChange={(v) => setForm({ ...form, theme_accent: v })} />
          <ColorField label="لون الخلفية" value={form.theme_background ?? ''} onChange={(v) => setForm({ ...form, theme_background: v })} />
          <ColorField label="لون البطاقات" value={form.theme_card ?? ''} onChange={(v) => setForm({ ...form, theme_card: v })} />
          <ColorField label="لون النص" value={form.theme_text ?? ''} onChange={(v) => setForm({ ...form, theme_text: v })} />
          <ColorField label="لون الحدود" value={form.theme_border ?? ''} onChange={(v) => setForm({ ...form, theme_border: v })} />
          <ColorField label="لون الأزرار" value={form.theme_button ?? ''} onChange={(v) => setForm({ ...form, theme_button: v })} />
        </div>
      </section>

      {/* Font Management */}
      <section className="card p-6">
        <h3 className="mb-4 flex items-center gap-2 font-bold text-ink-900">
          <Type size={20} className="text-primary-600" /> إدارة الخطوط
        </h3>
        <p className="mb-4 text-sm text-ink-500">اختر الخطوط المستخدمة في الموقع.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">الخط الأساسي</label>
            <select value={form.font_primary ?? 'Cairo'} onChange={(e) => setForm({ ...form, font_primary: e.target.value })} className="input">
              {AVAILABLE_FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">خط العناوين</label>
            <select value={form.font_heading ?? 'Amiri'} onChange={(e) => setForm({ ...form, font_heading: e.target.value })} className="input">
              {AVAILABLE_FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* Content Management */}
      <section className="card p-6">
        <h3 className="mb-4 flex items-center gap-2 font-bold text-ink-900">
          <Globe size={20} className="text-primary-600" /> محتوى الموقع
        </h3>
        <p className="mb-4 text-sm text-ink-500">النصوص التي تظهر للعملاء في الموقع.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="اسم الموقع" value={form.site_name ?? ''} onChange={(v) => setForm({ ...form, site_name: v })} />
          <Field label="الشعار / الوصف" value={form.site_tagline ?? ''} onChange={(v) => setForm({ ...form, site_tagline: v })} />
          <Field label="نص البانر العلوي" value={form.announcement_text ?? ''} onChange={(v) => setForm({ ...form, announcement_text: v })} />
          <Field label="نص الفوتر" value={form.footer_text ?? ''} onChange={(v) => setForm({ ...form, footer_text: v })} />
          <Field label="رقم واتساب" value={form.whatsapp_number ?? ''} onChange={(v) => setForm({ ...form, whatsapp_number: v })} dir="ltr" />
          <Field label="البريد الإلكتروني" value={form.contact_email ?? ''} onChange={(v) => setForm({ ...form, contact_email: v })} dir="ltr" />
          <Field label="رابط فيسبوك" value={form.facebook_url ?? ''} onChange={(v) => setForm({ ...form, facebook_url: v })} dir="ltr" />
          <Field label="رابط انستجرام" value={form.instagram_url ?? ''} onChange={(v) => setForm({ ...form, instagram_url: v })} dir="ltr" />
          <Field label="رابط تيليجرام" value={form.telegram_url ?? ''} onChange={(v) => setForm({ ...form, telegram_url: v })} dir="ltr" />
          <div className="sm:col-span-2">
            <label className="label">تعليمات الدفع</label>
            <textarea value={form.payment_instructions ?? ''} onChange={(e) => setForm({ ...form, payment_instructions: e.target.value })} className="input min-h-20" />
          </div>
        </div>
      </section>

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

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || '#1f7a4c'}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-ink-200"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input"
          dir="ltr"
          placeholder="#1f7a4c"
        />
      </div>
    </div>
  );
}
