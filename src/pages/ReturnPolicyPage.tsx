import { RETURN_POLICY_TEXT, SOCIAL_LINKS } from '@/lib/constants';
import { PackageCheck, MessageCircle } from 'lucide-react';
import { Link } from '@/components/Link';

export function ReturnPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="card p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
            <PackageCheck size={24} />
          </div>
          <h1 className="font-serif text-2xl font-bold text-ink-900">سياسة الإرجاع</h1>
        </div>

        <div className="space-y-4 text-ink-600">
          <p className="text-lg leading-relaxed">{RETURN_POLICY_TEXT}</p>

          <div className="rounded-xl bg-accent-50 p-4">
            <p className="font-semibold text-accent-800">للتواصل عبر واتساب:</p>
            <a href={`https://wa.me/2${SOCIAL_LINKS.whatsapp}`} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-2 text-accent-700 hover:underline">
              <MessageCircle size={18} />
              <span dir="ltr">{SOCIAL_LINKS.whatsapp}</span>
            </a>
          </div>

          <p className="text-sm text-ink-500">للمزيد من الاستفسارات، يمكنك أيضاً التواصل معنا من <Link to="/contact" className="text-primary-600 hover:underline">صفحة التواصل</Link>.</p>
        </div>
      </div>
    </div>
  );
}
