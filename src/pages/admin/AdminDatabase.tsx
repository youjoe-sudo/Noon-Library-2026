import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { Database, Table, Play, Search, AlertTriangle, Loader2, ChevronRight } from 'lucide-react';

interface TableInfo {
  table: string;
  columns: { name: string; type: string; nullable: boolean; is_pk: boolean }[];
}

interface QueryResult {
  success: boolean;
  data?: Record<string, unknown>[];
  error?: string;
}

export function AdminDatabase() {
  const { show } = useToast();
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const pageSize = 20;

  // SQL editor
  const [sql, setSql] = useState('');
  const [sqlResult, setSqlResult] = useState<QueryResult | null>(null);
  const [sqlLoading, setSqlLoading] = useState(false);
  const [mode, setMode] = useState<'browser' | 'sql'>('browser');

  useEffect(() => {
    fetchTables();
  }, []);

  const fetchTables = async () => {
    const { data } = await supabase.rpc('get_table_info');
    if (data && (data as { success: boolean }).success) {
      setTables((data as { tables: TableInfo[] }).tables);
    }
    setLoading(false);
  };

  const fetchRows = async (table: string) => {
    setRowsLoading(true);
    setSelectedTable(table);
    setPage(0);
    let query = supabase.from(table).select('*');
    if (sortCol) query = query.order(sortCol, { ascending: sortDir === 'asc' });
    else query = query.order('created_at', { ascending: false });
    query = query.range(page * pageSize, (page + 1) * pageSize - 1);
    const { data, error } = await query;
    if (error) {
      setRows([]);
    } else {
      setRows(data ?? []);
    }
    setRowsLoading(false);
  };

  // Re-fetch when page/sort changes
  useEffect(() => {
    if (selectedTable) {
      let query = supabase.from(selectedTable).select('*');
      if (sortCol) query = query.order(sortCol, { ascending: sortDir === 'asc' });
      else query = query.order('created_at', { ascending: false });
      query = query.range(page * pageSize, (page + 1) * pageSize - 1);
      query.then(({ data }) => setRows(data ?? []));
    }
  }, [page, sortCol, sortDir]);

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const runSql = async () => {
    if (!sql.trim()) return;
    setSqlLoading(true);
    setSqlResult(null);
    const { data, error } = await supabase.rpc('run_admin_sql', { p_sql: sql });
    if (error) {
      setSqlResult({ success: false, error: error.message });
    } else {
      setSqlResult(data as QueryResult);
    }
    setSqlLoading(false);
  };

  const filteredTables = tables.filter((t) => t.table.toLowerCase().includes(search.toLowerCase()));

  const currentTable = tables.find((t) => t.table === selectedTable);
  const columns = currentTable?.columns ?? [];
  const filteredRows = search && rows.length > 0
    ? rows.filter((r) => Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(search.toLowerCase())))
    : rows;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-bold text-ink-900">
          <Database size={20} className="text-primary-600" /> إدارة قاعدة البيانات
        </h2>
        <div className="flex gap-1 rounded-xl bg-ink-100 p-1">
          <button
            onClick={() => setMode('browser')}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${mode === 'browser' ? 'bg-white text-primary-700 shadow-soft' : 'text-ink-500'}`}
          >
            <Table size={16} className="inline" /> متصفح الجداول
          </button>
          <button
            onClick={() => setMode('sql')}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${mode === 'sql' ? 'bg-white text-primary-700 shadow-soft' : 'text-ink-500'}`}
          >
            <Database size={16} className="inline" /> محرر SQL
          </button>
        </div>
      </div>

      {mode === 'browser' && (
        <div className="grid gap-4 lg:grid-cols-[250px_1fr]">
          {/* Table list */}
          <div className="card h-fit p-3">
            <div className="relative mb-3">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث عن جدول..." className="input pr-9 text-sm" />
            </div>
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-8 w-full" />)}</div>
            ) : (
              <div className="max-h-[500px] space-y-1 overflow-y-auto">
                {filteredTables.map((t) => (
                  <button
                    key={t.table}
                    onClick={() => fetchRows(t.table)}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      selectedTable === t.table ? 'bg-primary-600 text-white' : 'text-ink-700 hover:bg-primary-50'
                    }`}
                  >
                    <Table size={14} />
                    <span className="flex-1 truncate font-mono">{t.table}</span>
                    <ChevronRight size={14} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Table data */}
          <div className="card p-4">
            {!selectedTable ? (
              <div className="flex h-64 items-center justify-center text-ink-400">
                <div className="text-center">
                  <Table size={48} className="mx-auto text-ink-200" />
                  <p className="mt-2">اختر جدولاً لعرض البيانات</p>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-mono font-bold text-ink-900">{selectedTable}</h3>
                  <div className="flex items-center gap-2 text-xs text-ink-400">
                    {columns.length} عمود
                  </div>
                </div>
                {rowsLoading ? (
                  <div className="flex h-32 items-center justify-center"><Loader2 className="animate-spin text-primary-500" /></div>
                ) : (
                  <div className="overflow-x-auto">
                    {filteredRows.length === 0 ? (
                      <p className="py-8 text-center text-ink-400">لا توجد بيانات</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-ink-100 text-right">
                            {columns.map((col) => (
                              <th
                                key={col.name}
                                onClick={() => handleSort(col.name)}
                                className="cursor-pointer whitespace-nowrap px-3 py-2 font-semibold text-ink-500 hover:text-primary-600"
                              >
                                {col.name}
                                {col.is_pk && <span className="mr-1 text-xs text-primary-500">PK</span>}
                                {sortCol === col.name && <span className="mr-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRows.map((row, i) => (
                            <tr key={i} className="border-b border-ink-50 hover:bg-ink-50">
                              {columns.map((col) => {
                                const val = row[col.name];
                                return (
                                  <td key={col.name} className="max-w-xs truncate px-3 py-2 text-ink-700" title={String(val ?? '')}>
                                    {val === null ? <span className="text-ink-300">NULL</span> :
                                     typeof val === 'boolean' ? (val ? 'true' : 'false') :
                                     typeof val === 'object' ? JSON.stringify(val).slice(0, 50) :
                                     String(val)}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
                <div className="mt-4 flex items-center justify-between">
                  <button
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                    className="btn-outline text-sm disabled:opacity-50"
                  >
                    السابق
                  </button>
                  <span className="text-sm text-ink-500">صفحة {page + 1}</span>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={filteredRows.length < pageSize}
                    className="btn-outline text-sm disabled:opacity-50"
                  >
                    التالي
                  </button>
                </div>
                <p className="mt-3 text-xs text-ink-400">
                  عرض {filteredRows.length} صف. للتعديل على البيانات استخدم محرر SQL أو صفحة الإدارة المخصصة.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {mode === 'sql' && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-accent-50 p-3 text-sm text-accent-700">
              <AlertTriangle size={18} />
              <span>محرر SQL مخصص للمشرفين فقط. مسموح فقط بتنفيذ استعلامات SELECT للقراءة فقط.</span>
            </div>
            <textarea
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              className="input min-h-32 font-mono text-sm"
              dir="ltr"
              placeholder="SELECT * FROM books LIMIT 10;"
            />
            <div className="mt-3 flex gap-2">
              <button onClick={runSql} disabled={sqlLoading || !sql.trim()} className="btn-primary">
                {sqlLoading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                تنفيذ الاستعلام
              </button>
              <button onClick={() => { setSql(''); setSqlResult(null); }} className="btn-ghost">
                مسح
              </button>
            </div>
          </div>

          {sqlResult && (
            <div className="card p-4">
              {sqlResult.success ? (
                <>
                  <p className="mb-3 text-sm font-semibold text-emerald-600">
                    تم تنفيذ الاستعلام بنجاح ({sqlResult.data?.length ?? 0} صف)
                  </p>
                  {sqlResult.data && sqlResult.data.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-ink-100 text-right">
                            {Object.keys(sqlResult.data[0]).map((col) => (
                              <th key={col} className="whitespace-nowrap px-3 py-2 font-semibold text-ink-500">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sqlResult.data.slice(0, 100).map((row, i) => (
                            <tr key={i} className="border-b border-ink-50">
                              {Object.values(row).map((val, j) => (
                                <td key={j} className="max-w-xs truncate px-3 py-2 text-ink-700" title={String(val ?? '')}>
                                  {val === null ? <span className="text-ink-300">NULL</span> :
                                   typeof val === 'object' ? JSON.stringify(val).slice(0, 80) :
                                   String(val)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {sqlResult.data.length > 100 && (
                        <p className="mt-2 text-xs text-ink-400">عرض أول 100 صف من {sqlResult.data.length}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-ink-400">لا توجد نتائج</p>
                  )}
                </>
              ) : (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                  {sqlResult.error}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
