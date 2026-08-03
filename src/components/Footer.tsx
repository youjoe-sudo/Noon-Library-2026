import { Link } from './Link';
import { FaTiktok } from "react-icons/fa";
import { BookOpen, Mail, Phone, MapPin, Facebook, Instagram, Send } from 'lucide-react';
import { SOCIAL_LINKS } from '@/lib/constants';

export function Footer() {
  return (
    <footer className="mt-16 border-t border-ink-100 bg-ink-900 text-ink-300">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 font-serif text-2xl font-bold text-white">
                ن
              </div>

              <div>
                <h3 className="font-serif text-xl font-bold text-white">
                  مكتبة نون
                </h3>
                <p className="text-xs text-ink-400">Noon Library</p>
              </div>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-ink-400">
              متجرك الأول للكتب العربية. نقدم آلاف الكتب في مختلف المجالات مع خدمة
              شحن لكل محافظات مصر ونظام تسويق بالعمولة.
            </p>

            <div className="mt-4 flex gap-3">
              <a
                href={SOCIAL_LINKS.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-ink-800 p-2 hover:bg-primary-600 transition-colors"
                aria-label="فيسبوك"
              >
                <Facebook size={18} />
              </a>

              <a
                href={SOCIAL_LINKS.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-ink-800 p-2 hover:bg-primary-600 transition-colors"
                aria-label="انستجرام"
              >
                <Instagram size={18} />
              </a>

              <a
                href={SOCIAL_LINKS.telegram}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-ink-800 p-2 hover:bg-primary-600 transition-colors"
                aria-label="تيليجرام"
              >
                <Send size={18} />
              </a>

              <a
                href={SOCIAL_LINKS.tiktok}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-ink-800 p-2 hover:bg-primary-600 transition-colors"
                aria-label="تيك توك"
              >
                <FaTiktok size={18} />
              </a>
            </div>
          </div>

          <div>
            <h4 className="mb-4 font-semibold text-white">روابط سريعة</h4>

            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  to="/"
                  className="hover:text-primary-400 transition-colors"
                >
                  الرئيسية
                </Link>
              </li>

              <li>
                <Link
                  to="/about"
                  className="hover:text-primary-400 transition-colors"
                >
                  من نحن
                </Link>
              </li>

              <li>
                <Link
                  to="/contact"
                  className="hover:text-primary-400 transition-colors"
                >
                  تواصل معنا
                </Link>
              </li>

              <li>
                <Link
                  to="/affiliate"
                  className="hover:text-primary-400 transition-colors"
                >
                  التسويق بالعمولة
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-semibold text-white">خدمة العملاء</h4>

            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  to="/orders"
                  className="hover:text-primary-400 transition-colors"
                >
                  تتبع الطلب
                </Link>
              </li>

              <li>
                <Link
                  to="/addresses"
                  className="hover:text-primary-400 transition-colors"
                >
                  العناوين
                </Link>
              </li>

              <li>
                <Link
                  to="/return-policy"
                  className="hover:text-primary-400 transition-colors"
                >
                  سياسة الإرجاع
                </Link>
              </li>

              <li>
                <Link
                  to="/tickets"
                  className="hover:text-primary-400 transition-colors"
                >
                  تذاكر الدعم
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-semibold text-white">تواصل معنا</h4>

            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2">
                <Phone size={16} className="text-primary-400" />
                <a
                  href={`https://wa.me/2${SOCIAL_LINKS.whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary-400 transition-colors"
                  dir="ltr"
                >
                  {SOCIAL_LINKS.whatsapp}
                </a>
              </li>

              <li className="flex items-center gap-2">
                <Mail size={16} className="text-primary-400" />
                <a
                  href={`mailto:${SOCIAL_LINKS.email}`}
                  className="hover:text-primary-400 transition-colors"
                  dir="ltr"
                >
                  {SOCIAL_LINKS.email}
                </a>
              </li>

              <li className="flex items-start gap-2">
                <MapPin
                  size={16}
                  className="mt-0.5 shrink-0 text-primary-400"
                />
                <span>القاهرة، جمهورية مصر العربية</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-ink-800 pt-6 sm:flex-row">
          <p className="text-xs text-ink-500">
            © 2025 مكتبة نون. جميع الحقوق محفوظة.
          </p>

          <div className="flex items-center gap-2 text-xs text-ink-500">
            <BookOpen size={14} className="text-primary-400" />
            <span>صُنع بشغف للمعرفة</span>
          </div>
        </div>
      </div>
    </footer>
  );
}