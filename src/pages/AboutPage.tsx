import { Link } from '@/components/Link';
import { BookOpen, Heart, Truck, ShieldCheck, Users, Megaphone, Target, Award } from 'lucide-react';

export function AboutPage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-800 to-primary-900 py-20">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 font-serif text-5xl font-bold text-white backdrop-blur">
            ن
          </div>
          <h1 className="font-serif text-4xl font-bold text-white sm:text-5xl">عن مكتبة نون</h1>
          <p className="mt-4 text-lg leading-relaxed text-primary-100">
            رحلتنا في عالم الكتب العربية بدأت بشغف بسيط: جعل المعرفة في متناول الجميع.
            اليوم، نقدم آلاف الكتب في مختلف المجالات مع خدمة شحن لكل محافظات مصر.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="mx-auto max-w-4xl px-4 py-12">
        <div className="card p-8">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
              <Target size={24} />
            </div>
            <h2 className="text-2xl font-bold text-ink-900">رسالتنا</h2>
          </div>
          <p className="leading-relaxed text-ink-600">
            نؤمن بأن الكتاب هو جسر المعرفة وأداة التغيير. نسعى لتوفير الكتب العربية بأسعار مناسبة وجودة عالية،
            مع تجربة تسوق سهلة وممتعة. نقدم أيضاً فرصة فريدة للشباب المصري لكسب المال من خلال برنامج التسويق بالعمولة.
          </p>
        </div>
      </section>

      {/* Values */}
      <section className="mx-auto max-w-7xl px-4 py-8">
        <h2 className="section-title mb-6 text-center">قيمنا</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ValueCard icon={<BookOpen size={24} />} title="المعرفة للجميع" desc="كتب عربية بأسعار في متناول الجميع" />
          <ValueCard icon={<Truck size={24} />} title="شحن موثوق" desc="توصيل لكل محافظات مصر" />
          <ValueCard icon={<ShieldCheck size={24} />} title="جودة مضمونة" desc="كتب أصلية 100%" />
          <ValueCard icon={<Heart size={24} />} title="شغف بالعميل" desc="خدمة عملاء مميزة" />
        </div>
      </section>

      {/* Stats */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-4 rounded-2xl bg-primary-800 p-8 text-center sm:grid-cols-4">
          <Stat value="+5000" label="كتاب" />
          <Stat value="+10000" label="عميل" />
          <Stat value="27" label="محافظة" />
          <Stat value="+500" label="مسوق" />
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-12">
        <div className="card flex flex-col items-center justify-between gap-4 p-8 sm:flex-row">
          <div>
            <h2 className="text-xl font-bold text-ink-900">هل أنت مهتم بالتسويق بالعمولة؟</h2>
            <p className="mt-1 text-ink-500">انضم إلى برنامج المسوقين وابدأ كسب المال اليوم</p>
          </div>
          <Link to="/affiliate" className="btn-primary">
            <Megaphone size={18} /> ابدأ الآن
          </Link>
        </div>
      </section>
    </div>
  );
}

function ValueCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="card p-6 text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-primary-50 text-primary-600">{icon}</div>
      <h3 className="font-bold text-ink-900">{title}</h3>
      <p className="mt-1 text-sm text-ink-500">{desc}</p>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-serif text-3xl font-bold text-white">{value}</p>
      <p className="mt-1 text-sm text-primary-200">{label}</p>
    </div>
  );
}
