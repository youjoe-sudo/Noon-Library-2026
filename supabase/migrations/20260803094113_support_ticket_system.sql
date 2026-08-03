/*
# Support Ticket System

## New Tables
- `support_tickets`: Main ticket container (subject, status, user_id, customer info)
- `support_messages`: Individual messages in a ticket conversation (ticket_id, sender_type, body)

## Security
- RLS enabled on both tables
- Users can CRUD their own tickets and messages
- Admins can read/reply to all tickets
- SECURITY DEFINER functions for create/reply/close/reopen
*/

CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  customer_name text,
  customer_email text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_type text NOT NULL DEFAULT 'customer',
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tickets_user ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_messages_ticket ON support_messages(ticket_id);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_tickets" ON support_tickets;
CREATE POLICY "select_own_tickets" ON support_tickets FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "insert_own_tickets" ON support_tickets;
CREATE POLICY "insert_own_tickets" ON support_tickets FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_tickets" ON support_tickets;
CREATE POLICY "update_own_tickets" ON support_tickets FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "select_own_messages" ON support_messages;
CREATE POLICY "select_own_messages" ON support_messages FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM support_tickets WHERE id = support_messages.ticket_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "insert_own_messages" ON support_messages;
CREATE POLICY "insert_own_messages" ON support_messages FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM support_tickets WHERE id = support_messages.ticket_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE OR REPLACE FUNCTION public.create_ticket(
  p_subject text,
  p_message text,
  p_customer_name text DEFAULT NULL,
  p_customer_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket_id uuid;
BEGIN
  IF p_subject IS NULL OR trim(p_subject) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Subject is required');
  END IF;
  IF p_message IS NULL OR trim(p_message) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Message is required');
  END IF;

  INSERT INTO support_tickets (user_id, subject, customer_name, customer_email)
  VALUES (auth.uid(), p_subject, p_customer_name, p_customer_email)
  RETURNING id INTO v_ticket_id;

  INSERT INTO support_messages (ticket_id, sender_type, body)
  VALUES (v_ticket_id, 'customer', p_message);

  INSERT INTO notifications (user_id, title, message, type)
  SELECT id, 'تذكرة دعم جديدة', p_subject, 'admin'
  FROM profiles WHERE role = 'admin';

  RETURN jsonb_build_object('success', true, 'ticket_id', v_ticket_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_ticket(text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_ticket(text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.reply_to_ticket(
  p_ticket_id uuid,
  p_message text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket record;
BEGIN
  SELECT * INTO v_ticket FROM support_tickets WHERE id = p_ticket_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket not found');
  END IF;
  IF v_ticket.status = 'closed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket is closed');
  END IF;

  INSERT INTO support_messages (ticket_id, sender_type, body)
  VALUES (p_ticket_id, 'customer', p_message);

  UPDATE support_tickets SET status = 'waiting_support', updated_at = now() WHERE id = p_ticket_id;

  INSERT INTO notifications (user_id, title, message, type)
  SELECT id, 'رد جديد على تذكرة', v_ticket.subject, 'admin'
  FROM profiles WHERE role = 'admin';

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reply_to_ticket(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.reply_to_ticket(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_reply_to_ticket(
  p_ticket_id uuid,
  p_message text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT * INTO v_ticket FROM support_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket not found');
  END IF;

  INSERT INTO support_messages (ticket_id, sender_type, body)
  VALUES (p_ticket_id, 'admin', p_message);

  UPDATE support_tickets SET status = 'replied', updated_at = now() WHERE id = p_ticket_id;

  INSERT INTO notifications (user_id, title, message, type)
  VALUES (v_ticket.user_id, 'رد على تذكرتك', v_ticket.subject, 'support');

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_reply_to_ticket(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_reply_to_ticket(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.close_ticket(p_ticket_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM support_tickets WHERE id = p_ticket_id AND (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  UPDATE support_tickets SET status = 'closed', updated_at = now() WHERE id = p_ticket_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.close_ticket(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.close_ticket(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.reopen_ticket(p_ticket_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  UPDATE support_tickets SET status = 'replied', updated_at = now() WHERE id = p_ticket_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reopen_ticket(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.reopen_ticket(uuid) TO authenticated;