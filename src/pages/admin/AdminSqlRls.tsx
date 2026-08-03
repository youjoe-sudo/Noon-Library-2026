import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Lock, Database, Shield, Table, FileText, Copy, Check } from 'lucide-react';

const RLS_PASSWORD = 'M@20252026';

interface RlsTable {
  table: string;
  rls_enabled: boolean;
}

interface RlsPolicy {
  table: string;
  policy: string;
  permissive: string;
  roles: string;
  cmd: string;
  using: string | null;
  with_check: string | null;
}

export function AdminSqlRls() {
  const { profile } = useAuth();
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [tables, setTables] = useState<RlsTable[]>([]);
  const [policies, setPolicies] = useState<RlsPolicy[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === RLS_PASSWORD) {
      setUnlocked(true);
      setError(false);
      fetchData();
    } else {
      setError(true);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase.rpc('get_rls_info');
    if (data) {
      setTables(data.tables as RlsTable[]);
      setPolicies(data.policies as RlsPolicy[]);
    }
    setLoading(false);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const generatePolicySql = (p: RlsPolicy): string => {
    const usingClause = p.using ? `USING (${p.using})` : '';
    const checkClause = p.with_check ? `WITH CHECK (${p.with_check})` : '';
    return `CREATE POLICY "${p.policy}" ON ${p.table} FOR ${p.cmd}\n  TO ${p.roles}\n  ${usingClause} ${checkClause};`.trim();
  };

  if (!unlocked) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <form onSubmit={handleUnlock} className="card max-w-md p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
              <Lock size={32} />
            </div>
            <h2 className="font-bold text-ink-900">SQL RLS - قسم المطورين</h2>
            <p className="mt-1 text-sm text-ink-500">هذا القسم محمي بكلمة مرور للمطورين فقط</p>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input text-center"
            placeholder="كلمة المرور"
            autoFocus
          />
          {error && <p className="mt-2 text-center text-sm text-red-600">كلمة المرور غير صحيحة</p>}
          <button type="submit" className="btn-primary mt-4 w-full">دخول</button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-bold text-ink-900">
          <Shield size={20} className="text-primary-600" /> SQL RLS Inspector
        </h2>
        <button onClick={fetchData} className="btn-outline text-sm">تحديث</button>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-16 w-full" />)}</div>
      ) : (
        <>
          {/* Tables with RLS status */}
          <section className="card p-6">
            <h3 className="mb-4 flex items-center gap-2 font-bold text-ink-900">
              <Table size={18} className="text-primary-600" /> الجداول وحالة RLS
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-right text-ink-500">
                    <th className="pb-2 pr-2">الجدول</th>
                    <th className="pb-2 px-2">RLS</th>
                    <th className="pb-2 px-2">عدد السياسات</th>
                  </tr>
                </thead>
                <tbody>
                  {tables.map((t) => {
                    const policyCount = policies.filter((p) => p.table === t.table).length;
                    return (
                      <tr key={t.table} className="border-b border-ink-50">
                        <td className="py-2 pr-2 font-mono font-semibold text-ink-900">{t.table}</td>
                        <td className="py-2 px-2">
                          <span className={`badge ${t.rls_enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {t.rls_enabled ? 'مفعّل' : 'معطّل'}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-ink-600">{policyCount}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Policies */}
          <section className="card p-6">
            <h3 className="mb-4 flex items-center gap-2 font-bold text-ink-900">
              <FileText size={18} className="text-primary-600" /> سياسات RLS
            </h3>
            <div className="space-y-3">
              {policies.map((p, i) => {
                const sql = generatePolicySql(p);
                return (
                  <div key={i} className="rounded-xl border border-ink-100 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-primary-700">{p.policy}</span>
                        <span className="badge bg-ink-100 text-ink-600">{p.cmd}</span>
                        <span className="text-xs text-ink-400">على {p.table}</span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(sql, `policy-${i}`)}
                        className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100"
                      >
                        {copied === `policy-${i}` ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      </button>
                    </div>
                    <pre className="overflow-x-auto rounded-lg bg-ink-900 p-3 text-xs text-ink-100" dir="ltr">
                      <code>{sql}</code>
                    </pre>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Migration snippets */}
          <section className="card p-6">
            <h3 className="mb-4 flex items-center gap-2 font-bold text-ink-900">
              <Database size={18} className="text-primary-600" /> مقتطفات SQL مفيدة
            </h3>
            <div className="space-y-3">
              <div className="rounded-xl border border-ink-100 p-4">
                <p className="mb-2 text-sm font-semibold text-ink-700">تفعيل RLS على جدول:</p>
                <pre className="overflow-x-auto rounded-lg bg-ink-900 p-3 text-xs text-ink-100" dir="ltr">
                  <code>ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;</code>
                </pre>
              </div>
              <div className="rounded-xl border border-ink-100 p-4">
                <p className="mb-2 text-sm font-semibold text-ink-700">إضافة سياسة SELECT للمستخدم:</p>
                <pre className="overflow-x-auto rounded-lg bg-ink-900 p-3 text-xs text-ink-100" dir="ltr">
                  <code>{`CREATE POLICY "select_own" ON table_name FOR SELECT
  TO authenticated USING (auth.uid() = user_id);`}</code>
                </pre>
              </div>
              <div className="rounded-xl border border-ink-100 p-4">
                <p className="mb-2 text-sm font-semibold text-ink-700">قائمة جميع الجداول في المخطط public:</p>
                <pre className="overflow-x-auto rounded-lg bg-ink-900 p-3 text-xs text-ink-100" dir="ltr">
                  <code>{`SELECT tablename, rowsecurity 
FROM pg_tables WHERE schemaname = 'public';`}</code>
                </pre>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
