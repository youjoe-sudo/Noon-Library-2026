import { useState, useEffect, useRef } from 'react';
import { Link } from '@/components/Link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import type { SupportTicket, SupportMessage } from '@/lib/types';
import { TICKET_STATUS_LABELS, TICKET_STATUS_COLORS, formatDateTime } from '@/lib/constants';
import { Send, ArrowRight, X } from 'lucide-react';

export function TicketDetailPage({ id }: { id: string }) {
  const { profile } = useAuth();
  const { show } = useToast();
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchTicket = async () => {
    const [t, m] = await Promise.all([
      supabase.from('support_tickets').select('*').eq('id', id).maybeSingle(),
      supabase.from('support_messages').select('*').eq('ticket_id', id).order('created_at', { ascending: true }),
    ]);
    setTicket(t.data as SupportTicket | null);
    setMessages((m.data as SupportMessage[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchTicket(); }, [id]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    const { data, error } = await supabase.rpc('reply_to_ticket', { p_ticket_id: id, p_message: reply.trim() });
    if (error || !(data as { success: boolean }).success) {
      show('فشل إرسال الرد', 'error');
    } else {
      setReply('');
      fetchTicket();
    }
    setSending(false);
  };

  const handleClose = async () => {
    await supabase.rpc('close_ticket', { p_ticket_id: id });
    fetchTicket();
  };

  if (loading) return <div className="mx-auto max-w-3xl px-4 py-8"><div className="skeleton h-64 w-full" /></div>;
  if (!ticket) return (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">
      <p className="text-ink-500">التذكرة غير موجودة</p>
      <Link to="/tickets" className="btn-primary mt-4">العودة للتذاكر</Link>
    </div>
  );

  const isAdmin = profile?.role === 'admin';

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link to={isAdmin ? "/admin/tickets" : "/tickets"} className="mb-4 flex items-center gap-1 text-sm text-ink-500 hover:text-primary-600">
        <ArrowRight size={16} /> العودة
      </Link>

      <div className="card mb-4 p-4">
        <div className="flex items-center justify-between">
          <h1 className="font-bold text-ink-900">{ticket.subject}</h1>
          <span className={`badge ${TICKET_STATUS_COLORS[ticket.status]}`}>{TICKET_STATUS_LABELS[ticket.status]}</span>
        </div>
        <p className="mt-1 text-xs text-ink-400">أُنشئت: {formatDateTime(ticket.created_at)}</p>
      </div>

      {/* Chat */}
      <div ref={scrollRef} className="card mb-4 h-[400px] overflow-y-auto p-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`mb-4 flex ${msg.sender_type === 'customer' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${msg.sender_type === 'customer' ? 'bg-ink-100 text-ink-800' : 'bg-primary-600 text-white'}`}>
              <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
              <p className={`mt-1 text-xs ${msg.sender_type === 'customer' ? 'text-ink-400' : 'text-primary-200'}`}>
                {msg.sender_type === 'customer' ? 'أنت' : 'الدعم'} • {formatDateTime(msg.created_at)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Reply box */}
      {ticket.status !== 'closed' ? (
        <div className="card p-4">
          <div className="flex gap-2">
            <input value={reply} onChange={(e) => setReply(e.target.value)} className="input flex-1" placeholder="اكتب ردك..." onKeyDown={(e) => { if (e.key === 'Enter') handleReply(); }} />
            <button onClick={handleReply} disabled={sending} className="btn-primary">
              <Send size={16} />
            </button>
          </div>
          {!isAdmin && (
            <button onClick={handleClose} className="mt-3 text-xs text-ink-400 hover:text-red-600">
              إغلاق التذكرة
            </button>
          )}
        </div>
      ) : (
        <div className="card p-4 text-center text-sm text-ink-500">
          هذه التذكرة مغلقة
        </div>
      )}
    </div>
  );
}
