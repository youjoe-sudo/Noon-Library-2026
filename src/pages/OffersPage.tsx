import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Link } from '@/components/Link';
import type { Offer } from '@/lib/types';
import { formatPrice } from '@/lib/constants';
import { useSeo } from '@/lib/seo';
import { useSettings } from '@/lib/settings';
import { Tag, ArrowLeft, ChevronLeft } from 'lucide-react';

export function OffersPage() {
  const { settings } = useSettings();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  useSeo({
    title: `العروض الخاصة | ${settings.site_name || 'مكتبة نون'}`,
    description: 'تصفح أحدث العروض والخصومات على الكتب والروايات. اختر كتبك المفضلة بأسعار مميزة واطلب عبر واتساب.',
    canonicalPath: '/offers',
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('offers').select('*').eq('status', 'active').order('display_order', { ascending: true });
      setOffers((data as Offer[]) ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="skeleton h-8 w-48" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-64 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <nav className="mb-4 flex items-center gap-1 text-sm text-ink-500">
        <Link to="/" className="hover:text-primary-600">الرئيسية</Link>
        <ChevronLeft size={14} />
        <span className="font-semibold text-ink-700">العروض</span>
      </nav>
      <h1 className="section-title mb-6">العروض الخاصة</h1>
      {offers.length === 0 ? (
        <div className="card p-12 text-center">
          <Tag size={48} className="mx-auto text-ink-300" />
          <p className="mt-4 text-ink-500">لا توجد عروض حالياً. تابعنا قريباً!</p>
          <Link to="/" className="btn-primary mt-4">تصفح الكتب <ArrowLeft size={16} /></Link>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {offers.map((offer) => {
            const isExpired = offer.end_at ? new Date(offer.end_at) < new Date() : false;
            if (isExpired) return null;
            return (
              <Link
                key={offer.id}
                to={`/offers/${offer.slug}`}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card transition-all hover:border-primary-300 hover:shadow-soft"
              >
                <div className="relative aspect-[16/9] overflow-hidden bg-primary-900">
                  {offer.cover_image ? (
                    <img src={offer.cover_image} alt={offer.name} className="h-full w-full object-cover opacity-90 transition-transform group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary-700 to-primary-900">
                      <Tag size={48} className="text-white/30" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-3 right-3 left-3">
                    <h2 className="font-serif text-xl font-bold text-white">{offer.name}</h2>
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  {offer.description && <p className="line-clamp-2 text-sm text-ink-600">{offer.description}</p>}
                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <p className="text-lg font-bold text-primary-700">{formatPrice(offer.price_per_book)} <span className="text-xs font-normal text-ink-500">/ كتاب</span></p>
                      <p className="text-xs text-ink-500">الحد الأدنى: {offer.min_books} كتب</p>
                    </div>
                    <span className="btn-primary text-xs">عرض الكتب <ArrowLeft size={14} /></span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
