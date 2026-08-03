import { useState, useEffect } from 'react';
import { Link } from '@/components/Link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { SupportTicket } from '@/lib/types';
import { TICKET_STATUS_LABELS, TICKET_STATUS_COLORS, formatDateTime } from '@/lib/constants';
import { MessageSquare, ChevronLeft, Plus } from 'lucide-react';

export function TicketsPage() {
  const { profile } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    supabase.from('support_tickets').select('*').eq('user_id', profile.id).order('updated_at', { ascending: false }).then(({ data }) => {
      setTickets((data as SupportTicket[]) ?? []);
      setLoading(false);
    });
  }, [profile]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="section-title">تذاكر الدعم</h1>
        <Link to="/contact" className="btn-primary text-sm">
          <Plus size={16} /> تذكرة جديدة
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-20 w-full" />)}</div>
      ) : tickets.length === 0 ? (
        <div className="card p-12 text-center">
          <MessageSquare size={48} className="mx-auto text-ink-300" />
          <p className="mt-4 text-ink-500">لا توجد تذاكر دعم بعد</p>
          <Link to="/contact" className="btn-primary mt-4">إنشاء تذكرة جديدة</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <Link key={ticket.id} to={`/ticket/${ticket.id}`} className="card flex items-center justify-between p-4 transition-colors hover:border-primary-300">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <p className="font-bold text-ink-900">{ticket.subject}</p>
                  <span className={`badge ${TICKET_STATUS_COLORS[ticket.status]}`}>{TICKET_STATUS_LABELS[ticket.status]}</span>
                </div>
                <p className="mt-1 text-xs text-ink-400">{formatDateTime(ticket.updated_at)}</p>
              </div>
              <ChevronLeft size={20} className="text-ink-300" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
