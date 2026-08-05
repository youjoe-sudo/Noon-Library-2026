import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import type { Book, Category, Offer, OfferMatchResult } from '@/lib/types';
import { formatPrice } from '@/lib/constants';
import { ArrowRight, Search, Upload, ClipboardPaste, Download, Check, X, Loader2, Trash2, ArrowUp, ArrowDown, FileText } from 'lucide-react';

interface Props {
  offerId: string;
  offer: Offer | undefined;
  onBack: () => void;
}

const PAGE_SIZE = 20;

export function AdminOfferBooks({ offerId, offer, onBack }: Props) {
  const { show } = useToast();
  const [mode, setMode] = useState<'manage' | 'manual' | 'bulk'>('manage');
  const [offerBooks, setOfferBooks] = useState<{ id: string; book_id: string; display_order: number; book: Book | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchOfferBooks = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('offer_books')
      .select('id, offer_id, book_id, display_order, book:books(*)')
      .eq('offer_id', offerId)
      .order('display_order', { ascending: true });
    setOfferBooks((data as unknown as { id: string; book_id: string; display_order: number; book: Book | null }[]) ?? []);
    setLoading(false);
  }, [offerId]);

  useEffect(() => {
    fetchOfferBooks();
  }, [fetchOfferBooks]);

  const removeBook = async (offerBookId: string) => {
    const { error } = await supabase.from('offer_books').delete().eq('id', offerBookId);
    if (error) { show('فشل الحذف', 'error'); return; }
    show('تم حذف الكتاب من العرض', 'success');
    fetchOfferBooks();
  };

  const reorder = async (offerBookId: string, direction: 'up' | 'down') => {
    const idx = offerBooks.findIndex((ob) => ob.id === offerBookId);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= offerBooks.length) return;
    const a = offerBooks[idx];
    const b = offerBooks[swapIdx];
    await Promise.all([
      supabase.from('offer_books').update({ display_order: b.display_order }).eq('id', a.id),
      supabase.from('offer_books').update({ display_order: a.display_order }).eq('id', b.id),
    ]);
    fetchOfferBooks();
  };

  const filtered = offerBooks.filter((ob) => {
    if (!ob.book) return false;
    return ob.book.title.toLowerCase().includes(search.toLowerCase()) || (ob.book.author?.toLowerCase().includes(search.toLowerCase()) ?? false);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <button onClick={onBack} className="mb-2 flex items-center gap-1 text-sm font-semibold text-primary-600 hover:underline">
            <ArrowRight size={16} /> العودة للعروض
          </button>
          <h2 className="font-bold text-ink-900">إدارة كتب العرض: {offer?.name ?? ''}</h2>
          <p className="text-sm text-ink-500">{offerBooks.length} كتاب في العرض</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setMode('manual')} className={`btn-outline text-xs ${mode === 'manual' ? 'border-primary-500 bg-primary-50' : ''}`}>
            <Search size={14} /> اختيار يدوي
          </button>
          <button onClick={() => setMode('bulk')} className={`btn-outline text-xs ${mode === 'bulk' ? 'border-primary-500 bg-primary-50' : ''}`}>
            <Upload size={14} /> استيراد بالجملة
          </button>
        </div>
      </div>

      {mode === 'manual' && <ManualSelection offerId={offerId} onDone={fetchOfferBooks} existingIds={new Set(offerBooks.map((ob) => ob.book_id))} />}
      {mode === 'bulk' && <BulkImport offerId={offerId} onDone={fetchOfferBooks} existingIds={new Set(offerBooks.map((ob) => ob.book_id))} />}

      {mode === 'manage' && (
        <>
          <div className="relative">
            <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث في كتب العرض..." className="input pr-10" />
          </div>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-16 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="card p-8 text-center text-ink-500">لا توجد كتب في هذا العرض بعد. استخدم الاختيار اليدوي أو الاستيراد بالجملة.</div>
          ) : (
            <div className="space-y-2">
              {filtered.map((ob, i) => (
                <div key={ob.id} className="card flex items-center gap-3 p-3">
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => reorder(ob.id, 'up')} disabled={i === 0} className="text-ink-400 hover:text-primary-600 disabled:opacity-30"><ArrowUp size={14} /></button>
                    <button onClick={() => reorder(ob.id, 'down')} disabled={i === filtered.length - 1} className="text-ink-400 hover:text-primary-600 disabled:opacity-30"><ArrowDown size={14} /></button>
                  </div>
                  <div className="h-14 w-10 shrink-0 overflow-hidden rounded-lg bg-ink-100">
                    {ob.book?.cover_url && <img src={ob.book.cover_url} alt={ob.book.title} className="h-full w-full object-cover" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-ink-900">{ob.book?.title}</p>
                    <p className="text-xs text-ink-500">{ob.book?.author}</p>
                    <div className="mt-0.5 flex items-center gap-2 text-xs">
                      <span className="font-bold text-primary-700">{formatPrice(ob.book?.price ?? 0)}</span>
                      <span className={`badge ${(ob.book?.stock ?? 0) <= 0 ? 'bg-red-100 text-red-700' : (ob.book?.stock ?? 0) <= (ob.book?.stock_threshold ?? 5) ? 'bg-accent-100 text-accent-700' : 'bg-primary-100 text-primary-700'}`}>
                        مخزون: {ob.book?.stock ?? 0}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => removeBook(ob.id)} className="rounded-lg p-2 text-red-500 hover:bg-red-50"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ManualSelection({ offerId, onDone, existingIds }: { offerId: string; onDone: () => void; existingIds: Set<string> }) {
  const { show } = useToast();
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'in_stock' | 'out_of_stock'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: booksData }, { data: catsData }] = await Promise.all([
        supabase.from('books').select('*, category:categories(*)').order('title'),
        supabase.from('categories').select('*').order('name_ar'),
      ]);
      setBooks((booksData as Book[]) ?? []);
      setCategories((catsData as Category[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const filtered = books.filter((b) => {
    if (search && !b.title.toLowerCase().includes(search.toLowerCase()) && !(b.author?.toLowerCase().includes(search.toLowerCase()) ?? false)) return false;
    if (categoryFilter && b.category_id !== categoryFilter) return false;
    if (availabilityFilter === 'in_stock' && b.stock <= 0) return false;
    if (availabilityFilter === 'out_of_stock' && b.stock > 0) return false;
    return true;
  });

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(filtered.filter((b) => !existingIds.has(b.id)).map((b) => b.id)));
  };

  const deselectAll = () => setSelected(new Set());

  const save = async () => {
    if (selected.size === 0) { show('لم يتم اختيار أي كتب', 'error'); return; }
    setSaving(true);
    const rows = Array.from(selected).map((bookId, i) => ({ offer_id: offerId, book_id: bookId, display_order: Date.now() + i }));
    const { error } = await supabase.from('offer_books').upsert(rows, { onConflict: 'offer_id,book_id', ignoreDuplicates: true });
    if (error) { show('فشل حفظ الكتب', 'error'); setSaving(false); return; }
    show(`تمت إضافة ${selected.size} كتاب`, 'success');
    setSelected(new Set());
    setSaving(false);
    onDone();
  };

  return (
    <div className="card p-4 space-y-3">
      <h3 className="font-bold text-ink-900">اختيار الكتب يدوياً</h3>
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="ابحث..." className="input pr-9 text-sm" />
        </div>
        <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(0); }} className="input w-auto text-sm">
          <option value="">كل التصنيفات</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
        </select>
        <select value={availabilityFilter} onChange={(e) => { setAvailabilityFilter(e.target.value as 'all' | 'in_stock' | 'out_of_stock'); setPage(0); }} className="input w-auto text-sm">
          <option value="all">الكل</option>
          <option value="in_stock">متوفر</option>
          <option value="out_of_stock">غير متوفر</option>
        </select>
      </div>
      <div className="flex items-center justify-between text-sm">
        <div className="flex gap-2">
          <button onClick={selectAll} className="text-primary-600 hover:underline">تحديد الكل</button>
          <button onClick={deselectAll} className="text-ink-500 hover:underline">إلغاء التحديد</button>
        </div>
        <span className="font-semibold text-ink-700">محدد: {selected.size} كتاب</span>
      </div>
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-16 w-full" />)}</div>
      ) : (
        <div className="max-h-96 space-y-1 overflow-y-auto">
          {paged.map((book) => {
            const isExisting = existingIds.has(book.id);
            return (
              <label key={book.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-2 transition-colors ${isExisting ? 'border-primary-200 bg-primary-50/50' : 'border-ink-100 hover:bg-ink-50'}`}>
                <input type="checkbox" checked={selected.has(book.id)} onChange={() => toggle(book.id)} disabled={isExisting} className="accent-primary-600" />
                <div className="h-12 w-9 shrink-0 overflow-hidden rounded bg-ink-100">
                  {book.cover_url && <img src={book.cover_url} alt={book.title} className="h-full w-full object-cover" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-ink-900">{book.title}</p>
                  <p className="text-xs text-ink-500">{book.author} • {book.category?.name_ar ?? 'بدون'}</p>
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-primary-700">{formatPrice(book.price)}</p>
                  <p className={`text-xs ${book.stock <= 0 ? 'text-red-500' : 'text-ink-500'}`}>مخزون: {book.stock}</p>
                </div>
                {isExisting && <span className="badge bg-primary-100 text-primary-700">مضاف</span>}
              </label>
            );
          })}
        </div>
      )}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="btn-ghost text-xs">السابق</button>
          <span className="text-ink-500">{page + 1} / {totalPages}</span>
          <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page === totalPages - 1} className="btn-ghost text-xs">التالي</button>
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={save} disabled={saving || selected.size === 0} className="btn-primary">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} حفظ الكتب المحددة ({selected.size})
        </button>
        <button onClick={() => setSelected(new Set())} className="btn-ghost">إلغاء</button>
      </div>
    </div>
  );
}

function BulkImport({ offerId, onDone, existingIds }: { offerId: string; onDone: () => void; existingIds: Set<string> }) {
  const { show } = useToast();
  const [pasteText, setPasteText] = useState('');
  const [preview, setPreview] = useState<OfferMatchResult | null>(null);
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [alreadyInOffer, setAlreadyInOffer] = useState<string[]>([]);
  const [ambiguousResolved, setAmbiguousResolved] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [loading, setLoading] = useState(false);

  const parseFile = async (file: File) => {
    const text = await file.text();
    setPasteText(text);
    runPreview(text);
  };

  const runPreview = async (text?: string) => {
    const raw = text ?? pasteText;
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    // If CSV with header "book_name", skip it
    if (lines.length > 0 && lines[0].toLowerCase().replace(/"/g, '').includes('book_name')) {
      lines.shift();
    }
    if (lines.length === 0) { show('القائمة فارغة', 'error'); return; }
    setLoading(true);
    setPreview(null);
    setMatchedIds([]);
    setAlreadyInOffer([]);
    setAmbiguousResolved({});
    const { data, error } = await supabase.rpc('match_offer_book_titles', { p_titles: lines });
    setLoading(false);
    if (error) { show('فشل تحليل القائمة', 'error'); return; }
    const result = data as OfferMatchResult;
    setPreview(result);
    const matched = result.matched.map((m) => m.book_id);
    setMatchedIds(matched);
    const already = matched.filter((id) => existingIds.has(id));
    setAlreadyInOffer(already);
  };

  const resolveAmbiguous = (input: string, bookId: string) => {
    setAmbiguousResolved((prev) => ({ ...prev, [input]: bookId }));
    setMatchedIds((prev) => Array.from(new Set([...prev.filter((id) => !Object.values(ambiguousResolved).includes(id)), bookId])));
  };

  const downloadTemplate = () => {
    const blob = new Blob(['book_name\nأنت أيضا صحابيه\nجلسات نفسية\nرسائل من عمر\n'], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'offer-books-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = async () => {
    const idsToImport = matchedIds.filter((id) => !existingIds.has(id));
    if (idsToImport.length === 0) { show('لا توجد كتب جديدة للاستيراد', 'error'); return; }
    setImporting(true);
    const rows = idsToImport.map((bookId, i) => ({ offer_id: offerId, book_id: bookId, display_order: Date.now() + i }));
    const { error } = await supabase.from('offer_books').upsert(rows, { onConflict: 'offer_id,book_id', ignoreDuplicates: true });
    setImporting(false);
    if (error) { show('فشل الاستيراد', 'error'); return; }
    show(`تم استيراد ${idsToImport.length} كتاب`, 'success');
    setPreview(null);
    setPasteText('');
    setMatchedIds([]);
    setAlreadyInOffer([]);
    setAmbiguousResolved({});
    onDone();
  };

  return (
    <div className="card p-4 space-y-4">
      <h3 className="font-bold text-ink-900">استيراد الكتب بالجملة</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-semibold text-ink-700">رفع ملف CSV / TXT</p>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-ink-200 p-6 hover:border-primary-400 hover:bg-ink-50">
            <FileText size={24} className="text-ink-400" />
            <span className="mt-2 text-sm text-ink-500">اختر ملف CSV أو TXT</span>
            <input type="file" accept=".csv,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f); e.target.value = ''; }} />
          </label>
          <button onClick={downloadTemplate} className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline">
            <Download size={14} /> تحميل قالب CSV
          </button>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-ink-700">أو لصق أسماء الكتب</p>
          <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} className="input min-h-24 text-sm" placeholder={"كتاب اسمه كذا\nكتاب آخر\n..."} />
          <button onClick={() => runPreview()} disabled={loading || !pasteText.trim()} className="btn-outline mt-2 text-xs">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <ClipboardPaste size={14} />} معاينة الكتب
          </button>
        </div>
      </div>

      <p className="rounded-lg bg-accent-50 p-3 text-xs text-accent-700">
        أضف اسم كتاب موجود في كل سطر. سيتم مطابقة الأسماء مع الكتب الموجودة في قاعدة البيانات. لن يتم إنشاء كتب جديدة تلقائياً.
      </p>

      {preview && (
        <div className="space-y-3 border-t border-ink-100 pt-4">
          <h4 className="font-bold text-ink-900">معاينة الاستيراد</h4>
          <div className="grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-4">
            <div className="rounded-lg bg-primary-50 p-2">
              <p className="text-lg font-bold text-primary-700">{preview.matched.length}</p>
              <p className="text-xs text-ink-500">مطابق</p>
            </div>
            <div className="rounded-lg bg-red-50 p-2">
              <p className="text-lg font-bold text-red-700">{preview.not_found.length}</p>
              <p className="text-xs text-ink-500">غير موجود</p>
            </div>
            <div className="rounded-lg bg-accent-50 p-2">
              <p className="text-lg font-bold text-accent-700">{alreadyInOffer.length}</p>
              <p className="text-xs text-ink-500">مضاف سابقاً</p>
            </div>
            <div className="rounded-lg bg-ink-100 p-2">
              <p className="text-lg font-bold text-ink-700">{preview.duplicate_input_count}</p>
              <p className="text-xs text-ink-500">مكرر في الملف</p>
            </div>
          </div>

          {preview.matched.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-semibold text-primary-700">المطابق:</p>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg bg-primary-50/50 p-2 text-sm">
                {preview.matched.map((m, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Check size={14} className="text-primary-600" />
                    <span className="text-ink-700">{m.title}</span>
                    {existingIds.has(m.book_id) && <span className="badge bg-accent-100 text-accent-700">مضاف سابقاً</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {preview.ambiguous.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-semibold text-accent-700">مطابقة محتملة (اختر الصحيح):</p>
              <div className="space-y-2">
                {preview.ambiguous.map((amb, i) => (
                  <div key={i} className="rounded-lg border border-accent-200 bg-accent-50/50 p-2">
                    <p className="text-sm font-semibold text-ink-800">{amb.input}</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {amb.candidates.map((c) => (
                        <button key={c.book_id} onClick={() => resolveAmbiguous(amb.input, c.book_id)}
                          className={`rounded-lg border px-3 py-1 text-xs font-semibold transition-colors ${ambiguousResolved[amb.input] === c.book_id ? 'border-primary-500 bg-primary-100 text-primary-700' : 'border-ink-200 bg-white text-ink-600 hover:border-primary-400'}`}>
                          {c.title}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {preview.not_found.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-semibold text-red-700">غير موجود:</p>
              <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg bg-red-50/50 p-2 text-sm">
                {preview.not_found.map((n, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <X size={14} className="text-red-500" />
                    <span className="text-ink-600">{n}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={doImport} disabled={importing || matchedIds.filter((id) => !existingIds.has(id)).length === 0} className="btn-primary">
              {importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              استيراد الكتب المطابقة ({matchedIds.filter((id) => !existingIds.has(id)).length})
            </button>
            <button onClick={() => { setPreview(null); setMatchedIds([]); }} className="btn-ghost">إلغاء</button>
          </div>
        </div>
      )}
    </div>
  );
}
