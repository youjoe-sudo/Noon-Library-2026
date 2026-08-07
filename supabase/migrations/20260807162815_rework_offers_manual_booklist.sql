/*
# Rework Offers: Manual Book List + Display Order

1. Changes to `offers` table
- Add `book_list text[]` column: stores manually-entered book names (one per array element).
  Admin pastes a text block; the frontend splits by newlines, trims, removes empties, deduplicates,
  and saves as an array. No link to the books table.
- Add `display_order integer NOT NULL DEFAULT 0`: controls the order offers appear on the homepage.

2. Removed:
- `offer_books` table is dropped (no longer needed — offers no longer link to database books).
- `validate_offer_cart` RPC is dropped (no longer needed — no website checkout for offers).
- `is_offer_purchasable` RPC is dropped (no longer needed).
- `match_offer_book_titles` RPC is dropped (no longer needed).
- `normalize_title` function is dropped (no longer needed).
- `offer_id` column on `order_items` is dropped (offers no longer create website orders).

3. Security:
- RLS policies on `offers` remain: public SELECT on active offers, admin full CRUD via is_admin().
- `offer_books` policies and table are gone.

4. Important Notes:
- Offers are now manually-written promotional campaigns. The admin types book names directly.
- Offers are ordered via WhatsApp ONLY. No website cart, checkout, inventory, or affiliate commission.
- The `book_list` array preserves the admin's entered order and Arabic text exactly.
*/

-- Add book_list and display_order to offers
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS book_list text[] DEFAULT '{}';
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;

-- Drop the offer_books table and its indexes
DROP TABLE IF EXISTS public.offer_books CASCADE;

-- Drop offer-related functions
DROP FUNCTION IF EXISTS public.validate_offer_cart(uuid, uuid[]);
DROP FUNCTION IF EXISTS public.is_offer_purchasable(uuid);
DROP FUNCTION IF EXISTS public.match_offer_book_titles(text[]);
DROP FUNCTION IF EXISTS public.normalize_title(text);

-- Drop offer_id from order_items (offers no longer create website orders)
ALTER TABLE public.order_items DROP COLUMN IF EXISTS offer_id;

-- Add index for display ordering
CREATE INDEX IF NOT EXISTS offers_display_order_idx ON public.offers (display_order);
