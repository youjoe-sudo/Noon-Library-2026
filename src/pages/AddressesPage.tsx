import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import type { Address } from '@/lib/types';
import { EGYPT_GOVERNORATES } from '@/lib/constants';
import { MapPin, Plus, Trash2, Check, Pencil } from 'lucide-react';

export function AddressesPage() {
  const { profile } = useAuth();
  const { show } = useToast();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ full_name: '', phone: '', governorate: '', city: '', area: '', address_detail: '', is_default: false });

  const fetchAddresses = async () => {
    if (!profile) return;
    const { data } = await supabase.from('addresses').select('*').eq('user_id', profile.id).order('is_default', { ascending: false });
    setAddresses((data as Address[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAddresses(); }, [profile]);

  const resetForm = () => {
    setForm({ full_name: '', phone: '', governorate: '', city: '', area: '', address_detail: '', is_default: false });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!form.full_name || !form.phone || !form.governorate) {
      show('يرجى إكمال البيانات المطلوبة', 'error');
      return;
    }
    if (form.is_default) {
      await supabase.from('addresses').update({ is_default: false }).eq('user_id', profile.id);
    }
    if (editingId) {
      const { error } = await supabase.from('addresses').update(form).eq('id', editingId);
      if (error) { show('فشل التحديث', 'error'); return; }
      show('تم تحديث العنوان', 'success');
    } else {
      const { error } = await supabase.from('addresses').insert({ ...form, user_id: profile.id });
      if (error) { show('فشل إضافة العنوان', 'error'); return; }
      show('تمت إضافة العنوان', 'success');
    }
    resetForm();
    fetchAddresses();
  };

  const handleEdit = (addr: Address) => {
    setForm({
      full_name: addr.full_name,
      phone: addr.phone,
      governorate: addr.governorate,
      city: addr.city ?? '',
      area: addr.area ?? '',
      address_detail: addr.address_detail ?? '',
      is_default: addr.is_default,
    });
    setEditingId(addr.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('addresses').delete().eq('id', id);
    if (error) { show('فشل الحذف', 'error'); return; }
    show('تم حذف العنوان', 'success');
    fetchAddresses();
  };

  if (loading) {
    return <div className="mx-auto max-w-7xl px-4 py-12"><div className="skeleton h-8 w-32" /><div className="mt-6 space-y-4">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="skeleton h-32 w-full" />)}</div></div>;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="section-title">عناويني</h1>
        {!showForm && (
          <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary">
            <Plus size={18} /> إضافة عنوان
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card mb-6 p-6">
          <h2 className="mb-4 font-bold text-ink-900">{editingId ? 'تعديل العنوان' : 'عنوان جديد'}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">الاسم الكامل *</label>
              <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">رقم الهاتف *</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" dir="ltr" />
            </div>
            <div>
              <label className="label">المحافظة *</label>
              <select value={form.governorate} onChange={(e) => setForm({ ...form, governorate: e.target.value })} className="input">
                <option value="">اختر المحافظة</option>
                {EGYPT_GOVERNORATES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="label">المدينة</label>
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">المنطقة</label>
              <input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">تفاصيل العنوان</label>
              <input value={form.address_detail} onChange={(e) => setForm({ ...form, address_detail: e.target.value })} className="input" />
            </div>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} className="accent-primary-600" />
            <span className="font-semibold text-ink-700">تعيين كعنوان افتراضي</span>
          </label>
          <div className="mt-4 flex gap-2">
            <button type="submit" className="btn-primary">{editingId ? 'تحديث' : 'حفظ'}</button>
            <button type="button" onClick={resetForm} className="btn-ghost">إلغاء</button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {addresses.length === 0 && !showForm ? (
          <div className="py-20 text-center">
            <MapPin size={64} className="mx-auto text-ink-300" />
            <h2 className="mt-4 text-xl font-bold text-ink-900">لا توجد عناوين محفوظة</h2>
            <p className="mt-2 text-ink-500">أضف عنوان لتسهيل عملية الطلب</p>
          </div>
        ) : (
          addresses.map((addr) => (
            <div key={addr.id} className="card p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-ink-900">{addr.full_name}</p>
                      {addr.is_default && <span className="badge bg-primary-100 text-primary-700"><Check size={12} /> افتراضي</span>}
                    </div>
                    <p className="text-sm text-ink-500">{addr.phone}</p>
                    <p className="mt-1 text-sm text-ink-600">{addr.governorate}، {addr.city} {addr.area} {addr.address_detail}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleEdit(addr)} className="rounded-lg p-2 text-ink-500 hover:bg-ink-100" aria-label="تعديل">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => handleDelete(addr.id)} className="rounded-lg p-2 text-red-500 hover:bg-red-50" aria-label="حذف">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
