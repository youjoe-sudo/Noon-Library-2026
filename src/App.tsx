import { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { SettingsProvider } from '@/lib/settings';
import { CartProvider } from '@/lib/cart';
import { ToastProvider } from '@/lib/toast';
import { useHashRoute, parseRoute, getQueryParam } from '@/lib/router';
import { processReferralLink } from '@/lib/referral';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { SEO } from '@/components/SEO';
import { HomePage } from '@/pages/HomePage';
import { BookDetailPage } from '@/pages/BookDetailPage';
import { BrowsePage } from '@/pages/BrowsePage';
import { CartPage } from '@/pages/CartPage';
import { CheckoutPage } from '@/pages/CheckoutPage';
import { AuthPage } from '@/pages/AuthPage';
import { OrdersPage } from '@/pages/OrdersPage';
import { OrderDetailPage } from '@/pages/OrderDetailPage';
import { WishlistPage } from '@/pages/WishlistPage';
import { AddressesPage } from '@/pages/AddressesPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { AffiliatePage } from '@/pages/AffiliatePage';
import { AdminPage } from '@/pages/admin/AdminPage';
import { AboutPage } from '@/pages/AboutPage';
import { ContactPage } from '@/pages/ContactPage';
import { TicketsPage } from '@/pages/TicketsPage';
import { TicketDetailPage } from '@/pages/TicketDetailPage';
import { ReturnPolicyPage } from '@/pages/ReturnPolicyPage';
import { OfferPage } from '@/pages/OfferPage';
import { OffersPage } from '@/pages/OffersPage';

function AppContent() {
  const { route } = useHashRoute();
  const { profile, loading } = useAuth();
  const { page, params } = parseRoute(route);
  const seoConfig = {
  home: {
    title: 'مكتبة نون - كتب وروايات عربية',
    description:
      'اكتشف آلاف الكتب والروايات العربية في مكتبة نون. كتب في الأدب والعلوم والتاريخ والفلسفة والتعليم مع شحن لجميع محافظات مصر.',
  },

  category: {
    title: 'تصفح الكتب',
    description:
      'تصفح مجموعة متنوعة من الكتب والروايات العربية واكتشف كتابك القادم من مكتبة نون.',
  },

  search: {
    title: 'البحث عن الكتب',
    description:
      'ابحث عن الكتب والروايات التي تريدها في مكتبة نون.',
  },

  about: {
    title: 'من نحن',
    description:
      'تعرف على مكتبة نون ورؤيتنا في توفير الكتب والروايات العربية للقراء في مصر.',
  },

  contact: {
    title: 'تواصل معنا',
    description:
      'تواصل مع فريق مكتبة نون للاستفسارات والمساعدة والدعم.',
  },

  offers: {
    title: 'عروض الكتب',
    description:
      'اكتشف أحدث عروض وخصومات الكتب في مكتبة نون.',
  },

  returnPolicy: {
    title: 'سياسة الإرجاع',
    description:
      'تعرف على سياسة الإرجاع والاستبدال في مكتبة نون.',
  },
};

  useEffect(() => {
    processReferralLink();
  }, [route]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-600 font-serif text-3xl font-bold text-white shadow-soft animate-pulse">
            ن
          </div>
          <p className="text-sm text-ink-500">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  // Pages that require authentication
  const authPages = ['checkout', 'profile', 'orders', 'order', 'wishlist', 'addresses', 'notifications', 'affiliate', 'admin', 'tickets', 'ticket'];
  const needsAuth = authPages.includes(page);
  if (needsAuth && !profile) {
    return (
      <>
        <Header />
        <div className="mx-auto max-w-7xl px-4 py-20 text-center">
          <h2 className="text-xl font-bold text-ink-900">يرجى تسجيل الدخول</h2>
          <p className="mt-2 text-ink-500">يجب تسجيل الدخول للوصول إلى هذه الصفحة</p>
          <a href="#/login" className="btn-primary mt-4">تسجيل الدخول</a>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
    <SEO
  title={
    page === 'home'
      ? seoConfig.home.title
      : page === 'category'
        ? seoConfig.category.title
        : page === 'search'
          ? seoConfig.search.title
          : page === 'about'
            ? seoConfig.about.title
            : page === 'contact'
              ? seoConfig.contact.title
              : page === 'offers'
                ? seoConfig.offers.title
                : page === 'return-policy'
                  ? seoConfig.returnPolicy.title
                  : undefined
  }
  description={
    page === 'home'
      ? seoConfig.home.description
      : page === 'category'
        ? seoConfig.category.description
        : page === 'search'
          ? seoConfig.search.description
          : page === 'about'
            ? seoConfig.about.description
            : page === 'contact'
              ? seoConfig.contact.description
              : page === 'offers'
                ? seoConfig.offers.description
                : page === 'return-policy'
                  ? seoConfig.returnPolicy.description
                  : undefined
  }
/>
      <Header />
      <main className="min-h-[60vh]">
        {page === 'home' && <HomePage />}
        {page === 'book' && <BookDetailPage id={params.id} />}
        {page === 'category' && <BrowsePage slug={params.slug} />}
        {page === 'search' && <BrowsePage searchQuery={getQueryParam(route, 'q') ?? ''} />}
        {page === 'cart' && <CartPage />}
        {page === 'checkout' && <CheckoutPage />}
        {page === 'login' && <AuthPage mode="login" />}
        {page === 'signup' && <AuthPage mode="signup" />}
        {page === 'profile' && <ProfilePage />}
        {page === 'orders' && <OrdersPage />}
        {page === 'order' && <OrderDetailPage id={params.id} />}
        {page === 'wishlist' && <WishlistPage />}
        {page === 'addresses' && <AddressesPage />}
        {page === 'notifications' && <NotificationsPage />}
        {page === 'affiliate' && <AffiliatePage />}
        {page === 'affiliate-register' && <AffiliatePage />}
        {page === 'admin' && <AdminPage />}
        {page === 'about' && <AboutPage />}
        {page === 'contact' && <ContactPage />}
        {page === 'tickets' && <TicketsPage />}
        {page === 'ticket' && <TicketDetailPage id={params.id} />}
        {page === 'return-policy' && <ReturnPolicyPage />}
        {page === 'offers' && <OffersPage />}
        {page === 'offer' && <OfferPage slug={params.slug} />}
      </main>
      <Footer />
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <SettingsProvider>
          <CartProvider>
            <AppContent />
          </CartProvider>
        </SettingsProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
