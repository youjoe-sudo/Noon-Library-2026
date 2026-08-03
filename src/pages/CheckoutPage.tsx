import { useEffect, useState, useMemo } from 'react';
import { Link } from '@/components/Link';
import { useCart, getCartSubtotal, getCartBookCount } from '@/lib/cart';
import { useSettings } from '@/lib/settings';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { useHashRoute } from '@/lib/router';
import { supabase } from '@/lib/supabase';
import { getStoredReferral, clearReferral } from '@/lib/referral';
import type { Address, AffiliateCodeResult, DiscountCodeResult } from '@/lib/types';
import {
  EGYPT_GOVERNORATES, SHIPPING_METHODS, PAYMENT_METHODS,
  getShippingCost, isFreeShipping, formatPrice, generateOrderNumber,
  PAYMENT_VODAFONE_NUMBER,
} from '@/lib/constants';
import { MapPin, CreditCard, Truck, Check, Tag, X, UserCheck, Loader2 } from 'lucide-react';
import { ReceiptUpload } from '@/components/ReceiptUpload';

export function CheckoutPage() {
  const { items, clearCart } = useCart();
  const { settings } = useSettings();
  const { profile } = useAuth();
  const { show } = useToast();
  const { navigate } = useHashRoute();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [newAddress, setNewAddress] = useState({ full_name: '', phone: '', governorate: '', city: '', area: '', address_detail: '' });
  const [useNewAddress, setUseNewAddress] = useState(false);
  const [shippingMethod, setShippingMethod] = useState<'express' | 'postal'>('express');
  const [paymentMethod, setPaymentMethod] = useState<'full'>('full');
  const [paymentInfo, setPaymentInfo] = useState({ sender_phone: '', receipt_number: '', screenshot_url: '' });
  const [submitting, setSubmitting] = useState(false);

  // Affiliate code state
  const [affiliateCode, setAffiliateCode] = useState('');
  const [affiliateResult, setAffiliateResult] = useState<AffiliateCodeResult | null>(null);
  const [affiliateLoading, setAffiliateLoading] = useState(false);

  // Discount code state
  const [discountCode, setDiscountCode] = useState('');
  const [discountResult, setDiscountResult] = useState<DiscountCodeResult | null>(null);
  const [discountLoading, setDiscountLoading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    supabase.from('addresses').select('*').eq('user_id', profile.id).order('is_default', { ascending: false }).then(({ data }) => {
      const addrs = (data as Address[]) ?? [];
      setAddresses(addrs);
      if (addrs.length > 0) setSelectedAddressId(addrs[0].id);
      else setUseNewAddress(true);
    });
  }, [profile]);

  // Pre-fill affiliate code from stored referral link
  useEffect(() => {
    const referral = getStoredReferral();
    if (referral) {
      setAffiliateCode(referral.referralCode);
      // Auto-validate
      validateAffiliateCode(referral.referralCode);
    }
  }, []);

  const subtotal = getCartSubtotal(items);
  const bookCount = getCartBookCount(items);
  const address = addresses.find((a) => a.id === selectedAddressId);
  const governorate = useNewAddress ? newAddress.governorate : (address?.governorate ?? '');
  const shippingCost = useMemo(() => {
    if (!governorate) return 0;
    if (isFreeShipping(subtotal, settings)) return 0;
    return getShippingCost(governorate, shippingMethod, settings, bookCount);
  }, [governorate, shippingMethod, settings, bookCount, subtotal]);

  // Calculate discounts independently
  const affiliateDiscountAmount = affiliateResult?.valid
    ? (subtotal * (affiliateResult.customer_discount_percent ?? 0)) / 100
    : 0;
  const discountCodeDiscountAmount = discountResult?.valid
    ? (discountResult.discount_amount ?? 0)
    : 0;
  const totalDiscount = Math.min(affiliateDiscountAmount + discountCodeDiscountAmount, subtotal);
  const total = subtotal + shippingCost - totalDiscount;

  const validateAffiliateCode = async (code: string) => {
    if (!code.trim() || !profile) return;
    setAffiliateLoading(true);
    const { data, error } = await supabase.rpc('validate_affiliate_code', {
      p_code: code.trim(),
      p_user_id: profile.id,
    });
    if (error) {
      setAffiliateResult({ valid: false, error: 'فشل التحقق من كود المسوق' });
    } else {
      setAffiliateResult(data as AffiliateCodeResult);
    }
    setAffiliateLoading(false);
  };

  const validateDiscountCode = async (code: string) => {
    if (!code.trim() || !profile) return;
    setDiscountLoading(true);
    const bookIds = items.map((i) => i.book_id).filter(Boolean);
    const { data: booksData } = await supabase.from('books').select('category_id').in('id', bookIds);
    const categoryIds = (booksData ?? []).map((b: { category_id: string }) => b.category_id).filter(Boolean);
    const { data, error } = await supabase.rpc('validate_discount_code', {
      p_code: code.trim(),
      p_user_id: profile.id,
      p_subtotal: subtotal,
      p_book_ids: bookIds,
      p_category_ids: categoryIds,
    });
    if (error) {
      setDiscountResult({ valid: false, error: 'فشل التحقق من كود الخصم' });
    } else {
      setDiscountResult(data as DiscountCodeResult);
    }
    setDiscountLoading(false);
  };

  const handleSubmit = async () => {
    if (!profile) { show('يرجى تسجيل الدخول', 'error'); return; }
    if (items.length === 0) { show('السلة فارغة', 'error'); return; }
    if (!governorate) { show('يرجى اختيار المحافظة', 'error'); return; }

    let addr: { full_name: string; phone: string; governorate: string; city?: string | null; area?: string | null; address_detail?: string | null };
    if (useNewAddress) {
      if (!newAddress.full_name || !newAddress.phone || !newAddress.governorate) {
        show('يرجى إكمال بيانات العنوان', 'error'); return;
      }
      addr = newAddress;
    } else if (address) {
      addr = { ...address };
    } else {
      show('يرجى اختيار عنوان', 'error'); return;
    }

    if (paymentMethod === 'full') {
      if (!paymentInfo.sender_phone || !paymentInfo.receipt_number) {
        show('يرجى إكمال بيانات الدفع (رقم الهاتف ورقم الإيصال)', 'error'); return;
      }
      if (!paymentInfo.screenshot_url) {
        show('يرجى رفع صورة إيصال الدفع', 'error'); return;
      }
    }

    // Determine affiliate attribution
    // Priority: affiliate code entered > stored referral link
    const storedReferral = getStoredReferral();
    let referredAffiliateId: string | null = null;
    let commissionSource: 'affiliate_code' | 'referral' | 'none' = 'none';
    let affiliateCodeText: string | null = null;

    if (affiliateResult?.valid && affiliateResult.affiliate_id) {
      referredAffiliateId = affiliateResult.affiliate_id;
      commissionSource = 'affiliate_code';
      affiliateCodeText = affiliateResult.referral_code ?? null;
    } else if (storedReferral) {
      referredAffiliateId = storedReferral.affiliateId;
      commissionSource = 'referral';
      affiliateCodeText = storedReferral.referralCode;
    }

    // Self-referral prevention
    if (referredAffiliateId) {
      const { data: aff } = await supabase
        .from('affiliate_profiles')
        .select('user_id')
        .eq('id', referredAffiliateId)
        .maybeSingle();
      if (aff && (aff as { user_id: string }).user_id === profile.id) {
        referredAffiliateId = null;
        commissionSource = 'none';
        affiliateCodeText = null;
        show('لا يمكنك استخدام كود المسوق الخاص بك', 'error');
        return;
      }
    }

    // Discount code
    const discountCodeId = discountResult?.valid ? discountResult.discount_code_id ?? null : null;
    const discountCodeTextVal = discountResult?.valid ? discountResult.code ?? null : null;

    setSubmitting(true);
    try {
      const orderNumber = generateOrderNumber();
      const { data: orderData, error: orderError } = await supabase.from('orders').insert({
        order_number: orderNumber,
        user_id: profile.id,
        status: 'awaiting_review',
        subtotal,
        books_subtotal: subtotal,
        shipping_cost: shippingCost,
        discount_amount: totalDiscount,
        total,
        governorate: addr.governorate,
        shipping_method: shippingMethod,
        payment_method: paymentMethod,
        address_full_name: addr.full_name,
        address_phone: addr.phone,
        address_detail: [addr.city, addr.area, addr.address_detail].filter(Boolean).join('، ') || null,
        referred_affiliate_id: referredAffiliateId,
        commission_source: commissionSource,
        affiliate_code: affiliateCodeText,
        affiliate_discount_amount: affiliateDiscountAmount,
        discount_code_id: discountCodeId,
        discount_code_text: discountCodeTextVal,
        payment_sender_phone: paymentMethod === 'full' ? paymentInfo.sender_phone : null,
        payment_receipt_number: paymentMethod === 'full' ? paymentInfo.receipt_number : null,
        payment_screenshot_url: paymentMethod === 'full' ? paymentInfo.screenshot_url : null,
      }).select().single();

      if (orderError) throw orderError;

      const orderItems = items.map((item) => {
        if (!item.book) return null;
        const price = item.book.discount_price ?? item.book.price;
        return {
          order_id: orderData.id,
          book_id: item.book_id,
          book_title: item.book.title,
          book_author: item.book.author,
          quantity: item.quantity,
          unit_price: price,
          subtotal: price * item.quantity,
          cover_url: item.book.cover_url,
        };
      }).filter(Boolean);

      await supabase.from('order_items').insert(orderItems);

      // Record discount code usage
      if (discountCodeId) {
        await supabase.from('discount_code_usages').insert({
          discount_code_id: discountCodeId,
          user_id: profile.id,
          order_id: orderData.id,
        });
        // Update discount code stats
        await supabase.rpc('increment_discount_code_usage', {
          p_code_id: discountCodeId,
          p_discount_amount: discountCodeDiscountAmount,
          p_revenue: subtotal - totalDiscount,
        });
      }

      // Log affiliate activity
      if (referredAffiliateId) {
        await supabase.from('affiliate_activity_logs').insert({
          affiliate_id: referredAffiliateId,
          order_id: orderData.id,
          action: 'order_created',
          details: { commission_source: commissionSource, affiliate_code: affiliateCodeText, discount_code: discountCodeTextVal },
        });
      }

      clearReferral();

      await supabase.from('notifications').insert({
        user_id: profile.id,
        title: 'تم استلام طلبك',
        message: `طلبك رقم ${orderNumber} قيد المراجعة. ستصلك إشعار عند تأكيد الطلب.`,
        type: 'order',
      });

      const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin');
      if (admins) {
        await supabase.from('notifications').insert(admins.map((a) => ({
          user_id: (a as { id: string }).id,
          title: 'طلب جديد',
          message: `طلب جديد رقم ${orderNumber} بانتظار المراجعة`,
          type: 'admin',
        })));
      }

      await clearCart();
      show('تم إرسال طلبك بنجاح', 'success');
      navigate(`/order/${orderData.id}`);
    } catch (err) {
      show('فشل إنشاء الطلب', 'error');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <h2 className="text-xl font-bold text-ink-900">السلة فارغة</h2>
        <Link to="/" className="btn-primary mt-4">تصفح الكتب</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="section-title mb-6">إتمام الطلب</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
        <div className="space-y-6">
          {/* Address */}
          <section className="card p-6">
            <h2 className="mb-4 flex items-center gap-2 font-bold text-ink-900">
              <MapPin size={20} className="text-primary-600" /> عنوان التوصيل
            </h2>
            {addresses.length > 0 && (
              <div className="mb-4 space-y-2">
                {addresses.map((addr) => (
                  <label
                    key={addr.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                      selectedAddressId === addr.id && !useNewAddress ? 'border-primary-500 bg-primary-50' : 'border-ink-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="address"
                      checked={selectedAddressId === addr.id && !useNewAddress}
                      onChange={() => { setSelectedAddressId(addr.id); setUseNewAddress(false); }}
                      className="mt-1 accent-primary-600"
                    />
                    <div className="text-sm">
                      <p className="font-semibold text-ink-900">{addr.full_name}</p>
                      <p className="text-ink-500">{addr.phone}</p>
                      <p className="text-ink-500">{addr.governorate}، {addr.city} {addr.area}</p>
                      {addr.address_detail && <p className="text-ink-400">{addr.address_detail}</p>}
                    </div>
                  </label>
                ))}
              </div>
            )}
            <button
              onClick={() => setUseNewAddress(!useNewAddress)}
              className="text-sm font-semibold text-primary-600 hover:underline"
            >
              {useNewAddress ? 'إلغاء' : '+ إضافة عنوان جديد'}
            </button>
            {useNewAddress && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">الاسم الكامل</label>
                  <input value={newAddress.full_name} onChange={(e) => setNewAddress({ ...newAddress, full_name: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="label">رقم الهاتف</label>
                  <input value={newAddress.phone} onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })} className="input" dir="ltr" />
                </div>
                <div>
                  <label className="label">المحافظة</label>
                  <select value={newAddress.governorate} onChange={(e) => setNewAddress({ ...newAddress, governorate: e.target.value })} className="input">
                    <option value="">اختر المحافظة</option>
                    {EGYPT_GOVERNORATES.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">المدينة</label>
                  <input value={newAddress.city} onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="label">المنطقة</label>
                  <input value={newAddress.area} onChange={(e) => setNewAddress({ ...newAddress, area: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="label">تفاصيل العنوان</label>
                  <input value={newAddress.address_detail} onChange={(e) => setNewAddress({ ...newAddress, address_detail: e.target.value })} className="input" />
                </div>
              </div>
            )}
          </section>

          {/* Shipping method */}
          <section className="card p-6">
            <h2 className="mb-4 flex items-center gap-2 font-bold text-ink-900">
              <Truck size={20} className="text-primary-600" /> طريقة الشحن
            </h2>
            <div className="space-y-2">
              {SHIPPING_METHODS.map((m) => (
                <label
                  key={m.value}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${
                    shippingMethod === m.value ? 'border-primary-500 bg-primary-50' : 'border-ink-200'
                  }`}
                >
                  <input type="radio" name="shipping" checked={shippingMethod === m.value} onChange={() => setShippingMethod(m.value)} className="accent-primary-600" />
                  <div>
                    <p className="font-semibold text-ink-900">{m.label}</p>
                    <p className="text-xs text-ink-500">{m.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </section>

          {/* Payment method */}
          <section className="card p-6">
            <h2 className="mb-4 flex items-center gap-2 font-bold text-ink-900">
              <CreditCard size={20} className="text-primary-600" /> طريقة الدفع
            </h2>
            <div className="rounded-xl border border-primary-200 bg-primary-50 p-4">
              <p className="font-semibold text-ink-900">تحويل بنكي / محفظة إلكترونية</p>
              <p className="mt-2 text-sm text-ink-600">
                يحوّل المبلغ المطلوب إلى رقم فودافون كاش التالي:
              </p>
              <div className="mt-3 flex items-center justify-center rounded-lg bg-white py-3 text-2xl font-bold tracking-wider text-primary-700" dir="ltr">
                {PAYMENT_VODAFONE_NUMBER}
              </div>
              <p className="mt-2 text-xs text-ink-500">
                يمكنك الدفع عبر فودافون كاش أو إنستا باي أو أي محفظة إلكترونية. يحوّل المبلغ دائماً إلى الرقم أعلاه.
              </p>
            </div>

            <div className="mt-4 space-y-3 rounded-xl bg-accent-50 p-4">
              <p className="text-sm font-semibold text-accent-800">بيانات الدفع:</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">رقم هاتف المرسل</label>
                  <input value={paymentInfo.sender_phone} onChange={(e) => setPaymentInfo({ ...paymentInfo, sender_phone: e.target.value })} className="input" dir="ltr" placeholder="01xxxxxxxxx" />
                </div>
                <div>
                  <label className="label">رقم الإيصال / العملية</label>
                  <input value={paymentInfo.receipt_number} onChange={(e) => setPaymentInfo({ ...paymentInfo, receipt_number: e.target.value })} className="input" dir="ltr" />
                </div>
              </div>
              <div>
                <label className="label">إيصال الدفع</label>
                <ReceiptUpload value={paymentInfo.screenshot_url} onChange={(url) => setPaymentInfo({ ...paymentInfo, screenshot_url: url })} />
              </div>
              <p className="text-xs text-accent-600">يبدأ معالجة الطلب بعد تأكيد الدفع من الإدارة.</p>
            </div>
          </section>

          {/* Affiliate Code */}
          <section className="card p-6">
            <h2 className="mb-4 flex items-center gap-2 font-bold text-ink-900">
              <UserCheck size={20} className="text-primary-600" /> كود المسوق
            </h2>
            <p className="mb-3 text-xs text-ink-500">
              أدخل كود المسوق لربط طلبك بالمسوق. لا يؤثر على سعر الطلب ما لم يكن المسوق يقدم خصماً للعميل.
            </p>
            <div className="flex gap-2">
              <input
                value={affiliateCode}
                onChange={(e) => { setAffiliateCode(e.target.value); setAffiliateResult(null); }}
                className="input"
                placeholder="كود المسوق (اختياري)"
                dir="ltr"
              />
              <button
                onClick={() => validateAffiliateCode(affiliateCode)}
                disabled={affiliateLoading || !affiliateCode.trim()}
                className="btn-outline whitespace-nowrap"
              >
                {affiliateLoading ? <Loader2 size={16} className="animate-spin" /> : 'تطبيق'}
              </button>
            </div>
            {affiliateResult?.valid && (
              <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-primary-50 p-3 text-sm">
                <div className="flex items-center gap-2">
                  <Check size={16} className="text-primary-600" />
                  <span className="font-semibold text-primary-700">{affiliateResult.referral_code}</span>
                  {(affiliateResult.customer_discount_percent ?? 0) > 0 ? (
                    <span className="text-primary-600">خصم {affiliateResult.customer_discount_percent}% للعميل</span>
                  ) : (
                    <span className="text-ink-500">بدون خصم للعميل</span>
                  )}
                </div>
                <button onClick={() => { setAffiliateResult(null); setAffiliateCode(''); }} className="text-red-500 hover:underline">
                  <X size={14} />
                </button>
              </div>
            )}
            {affiliateResult && !affiliateResult.valid && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                <X size={16} /> {affiliateResult.error}
              </div>
            )}
          </section>

          {/* Discount Code */}
          <section className="card p-6">
            <h2 className="mb-4 flex items-center gap-2 font-bold text-ink-900">
              <Tag size={20} className="text-primary-600" /> كود الخصم
            </h2>
            <p className="mb-3 text-xs text-ink-500">
              أدخل كود خصم مستقل من الإدارة للحصول على خصم على طلبك.
            </p>
            <div className="flex gap-2">
              <input
                value={discountCode}
                onChange={(e) => { setDiscountCode(e.target.value); setDiscountResult(null); }}
                className="input"
                placeholder="كود الخصم (اختياري)"
                dir="ltr"
              />
              <button
                onClick={() => validateDiscountCode(discountCode)}
                disabled={discountLoading || !discountCode.trim()}
                className="btn-outline whitespace-nowrap"
              >
                {discountLoading ? <Loader2 size={16} className="animate-spin" /> : 'تطبيق'}
              </button>
            </div>
            {discountResult?.valid && (
              <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-primary-50 p-3 text-sm">
                <div className="flex items-center gap-2">
                  <Check size={16} className="text-primary-600" />
                  <span className="font-semibold text-primary-700">{discountResult.code}</span>
                  <span className="text-primary-600">
                    {discountResult.discount_type === 'percentage'
                      ? `خصم ${discountResult.discount_value}%`
                      : `خصم ${formatPrice(discountResult.discount_value ?? 0)}`}
                  </span>
                </div>
                <button onClick={() => { setDiscountResult(null); setDiscountCode(''); }} className="text-red-500 hover:underline">
                  <X size={14} />
                </button>
              </div>
            )}
            {discountResult && !discountResult.valid && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                <X size={16} /> {discountResult.error}
              </div>
            )}
          </section>
        </div>

        {/* Summary */}
        <div className="card h-fit p-6 lg:sticky lg:top-32">
          <h2 className="mb-4 font-bold text-ink-900">ملخص الطلب</h2>
          <div className="mb-4 max-h-48 space-y-2 overflow-y-auto text-sm">
            {items.map((item) => {
              if (!item.book) return null;
              const p = item.book.discount_price ?? item.book.price;
              return (
                <div key={item.id} className="flex justify-between">
                  <span className="text-ink-500 line-clamp-1">{item.book.title} × {item.quantity}</span>
                  <span className="font-semibold whitespace-nowrap">{formatPrice(p * item.quantity)}</span>
                </div>
              );
            })}
          </div>
          <div className="space-y-2 border-t border-ink-100 pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-500">المجموع الفرعي</span>
              <span className="font-semibold">{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-500">الشحن</span>
              <span className="font-semibold">{shippingCost === 0 ? 'مجاني' : formatPrice(shippingCost)}</span>
            </div>
            {affiliateDiscountAmount > 0 && (
              <div className="flex justify-between text-primary-600">
                <span>خصم المسوق</span>
                <span className="font-semibold">-{formatPrice(affiliateDiscountAmount)}</span>
              </div>
            )}
            {discountCodeDiscountAmount > 0 && (
              <div className="flex justify-between text-primary-600">
                <span>خصم كود الخصم</span>
                <span className="font-semibold">-{formatPrice(discountCodeDiscountAmount)}</span>
              </div>
            )}
          </div>
          <div className="mt-4 flex justify-between border-t border-ink-100 pt-4">
            <span className="font-bold text-ink-900">الإجمالي</span>
            <span className="text-xl font-bold text-primary-700">{formatPrice(total)}</span>
          </div>
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary mt-6 w-full">
            {submitting ? 'جاري إرسال الطلب...' : 'تأكيد الطلب'}
          </button>
        </div>
      </div>
    </div>
  );
}
