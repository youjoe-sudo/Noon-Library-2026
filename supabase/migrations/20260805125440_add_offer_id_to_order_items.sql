-- Add offer_id to order_items for historical preservation of offer orders.
-- Existing orders remain valid (NULL). New offer orders set the offer_id and store
-- the actual offer price paid in unit_price (server-computed via validate_offer_cart).
-- Even if the offer is later edited or deleted, order_items retain book_title,
-- unit_price, subtotal, and (if set) offer_id — so historical orders stay correct.

ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS order_items_offer_idx ON public.order_items (offer_id) WHERE offer_id IS NOT NULL;
