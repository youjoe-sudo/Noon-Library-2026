import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import type { SupportTicket, SupportMessage } from '@/lib/types';
import { TICKET_STATUS_LABELS, TICKET_STATUS_COLORS, formatDateTime } from '@/lib/constants';
import { Search, Send, X, CheckCircle, RotateCcw } from 'lucide-react';

export function AdminTickets() {
  const { profile } = useAuth();
  const { show } = useToast();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const fetchTickets = async () => {
    let q = supabase.from('support_tickets').select('*').order('updated_at', { ascending: false });
    if (statusFilter !== 'all') q = q.eq('status', statusFilter);
    const { data } = await q;
    setTickets((data as SupportTicket[]) ?? []);
  };

  useEffect(() => { fetchTickets(); }, [statusFilter]);

  const openTicket = async (t: SupportTicket) => {
    setSelectedTicket(t);
    const { data } = await supabase.from('support_messages').select('*').eq('ticket_id', t.id).order('created_at', { ascending: true });
    setMessages((data as SupportMessage[]) ?? []);
  };

  const handleReply = async () => {
    if (!reply.trim() || !selectedTicket) return;
    setSending(true);
    const { data, error } = await supabase.rpc('admin_reply_to_ticket', { p_ticket_id: selectedTicket.id, p_message: reply.trim() });
    if (error || !(data as { success: boolean }).success) {
      show('فشل إرسال الرد', 'error');
    } else {
      setReply('');
      const { data: msgs } = await supabase.from('support_messages').select('*').eq('ticket_id', selectedTicket.id).order('created_at', { ascending: true });
      setMessages((msgs as SupportMessage[]) ?? []);
      const { data: t } = await supabase.from('support_tickets').select('*').eq('id', selectedTicket.id).maybeSingle();
      setSelectedTicket(t as SupportTicket);
      fetchTickets();
    }
    setSending(false);
  };

  const handleClose = async () => {
    if (!selectedTicket) return;
    await supabase.rpc('close_ticket', { p_ticket_id: selectedTicket.id });
    const { data: t } = await supabase.from('support_tickets').select('*').eq('id', selectedTicket.id).maybeSingle();
    setSelectedTicket(t as SupportTicket);
    fetchTickets();
  };

  const handleReopen = async () => {
    if (!selectedTicket) return;
    await supabase.rpc('reopen_ticket', { p_ticket_id: selectedTicket.id });
    const { data: t } = await supabase.from('support_tickets').select('*').eq('id', selectedTicket.id).maybeSingle();
    setSelectedTicket(t as SupportTicket);
    fetchTickets();
  };

  const filtered = tickets.filter((t) =>
    t.subject.toLowerCase().includes(search.toLowerCase()) ||
    (t.customer_name?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  return (
    <div className="space-y-4">
      <h2 className="font-bold text-ink-900">تذاكر الدعم ({tickets.length})</h2>

      {!selectedTicket ? (
        <>
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-48">
              <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث في التذاكر..." className="input pr-10" />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input w-auto">
              <option value="all">كل الحالات</option>
              {Object.entries(TICKET_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {filtered.length === 0 ? (
            <p className="py-12 text-center text-ink-400">لا توجد تذاكر</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((t) => (
                <button key={t.id} onClick={() => openTicket(t)} className="card flex w-full items-center justify-between p-4 text-right transition-colors hover:border-primary-300">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-ink-900">{t.subject}</p>
                      <span className={`badge ${TICKET_STATUS_COLORS[t.status]}`}>{TICKET_STATUS_LABELS[t.status]}</span>
                    </div>
                    <p className="mt-1 text-xs text-ink-400">{t.customer_name ?? 'عميل'} • {formatDateTime(t.updated_at)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <div>
          <div className="card mb-4 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-ink-900">{selectedTicket.subject}</h3>
                <p className="mt-1 text-xs text-ink-400">
                  العميل: {selectedTicket.customer_name ?? 'غير معروف'}
                  {selectedTicket.customer_email && <> • <span dir="ltr">{selectedTicket.customer_email}</span></>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`badge ${TICKET_STATUS_COLORS[selectedTicket.status]}`}>{TICKET_STATUS_LABELS[selectedTicket.status]}</span>
                <button onClick={() => setSelectedTicket(null)} className="text-ink-400 hover:text-ink-600"><X size={20} /></button>
              </div>
            </div>
          </div>

          <div className="card mb-4 h-[400px] overflow-y-auto p-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`mb-4 flex ${msg.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${msg.sender_type === 'admin' ? 'bg-primary-600 text-white' : 'bg-ink-100 text-ink-800'}`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                  <p className={`mt-1 text-xs ${msg.sender_type === 'admin' ? 'text-primary-200' : 'text-ink-400'}`}>
                    {msg.sender_type === 'admin' ? 'الدعم' : 'العميل'} • {formatDateTime(msg.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {selectedTicket.status !== 'closed' ? (
            <div className="card p-4">
              <div className="flex gap-2">
                <input value={reply} onChange={(e) => setReply(e.target.value)} className="input flex-1" placeholder="اكتب ردك..." onKeyDown={(e) => { if (e.key === 'Enter') handleReply(); }} />
                <button onClick={handleReply} disabled={sending} className="btn-primary"><Send size={16} /></button>
              </div>
              <button onClick={handleClose} className="mt-3 flex items-center gap-1 text-xs text-ink-400 hover:text-red-600">
                <CheckCircle size={14} /> إغلاق التذكرة
              </button>
            </div>
          ) : (
            <div className="card p-4 text-center">
              <p className="mb-3 text-sm text-ink-500">هذه التذكرة مغلقة</p>
              <button onClick={handleReopen} className="btn-outline text-sm">
                <RotateCcw size={14} /> إعادة فتح التذكرة
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
