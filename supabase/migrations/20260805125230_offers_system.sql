/*
# Offers System — pick-your-own-books pricing campaigns

1. New Tables
- `offers`: a special pricing campaign. Customer selects eligible books and pays `price_per_book` per selected book.
  - id, name, slug (unique), description, cover_image, price_per_book (>0), min_books (>=1), max_books (nullable, >= min_books), start_at, end_at, status (draft|active|inactive), created_at, updated_at
- `offer_books`: join table connecting offers to eligible books. UNIQUE (offer_id, book_id). book_id ON DELETE RESTRICT (removing a book from an offer never deletes the book).

2. Security (RLS)
- offers: public SELECT on active offers; admin full CRUD via is_admin().
- offer_books: public SELECT for books belonging to active offers; admin full CRUD via is_admin().

3. Functions
- is_offer_purchasable(p_offer_id): active + within date window.
- validate_offer_cart(p_offer_id, p_book_ids): full backend validation + server-computed subtotal (count × price_per_book). Never trusts client price.
- match_offer_book_titles(p_titles): bulk import matching with normalized titles. Returns matched / not_found / ambiguous / duplicate_input_count.
- normalize_title(p_title): immutable helper used by matching.

4. Notes
- Offers are separate from categories and collections.
- Commission for affiliate-attributed offer orders uses the offer subtotal, not original book prices.
*/

CREATE TABLE IF NOT EXISTS public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  cover_image text,
  price_per_book numeric NOT NULL CHECK (price_per_book > 0),
  min_books integer NOT NULL CHECK (min_books >= 1),
  max_books integer CHECK (max_books IS NULL OR max_books >= 1),
  start_at timestamptz,
  end_at timestamptz,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT offers_max_ge_min CHECK (max_books IS NULL OR max_books >= min_books)
);

CREATE UNIQUE INDEX IF NOT EXISTS offers_slug_unique ON public.offers (slug);
CREATE INDEX IF NOT EXISTS offers_status_idx ON public.offers (status);

CREATE TABLE IF NOT EXISTS public.offer_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE RESTRICT,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (offer_id, book_id)
);

CREATE INDEX IF NOT EXISTS offer_books_offer_idx ON public.offer_books (offer_id);
CREATE INDEX IF NOT EXISTS offer_books_book_idx ON public.offer_books (book_id);

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_books ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "offers_select_public" ON public.offers;
CREATE POLICY "offers_select_public" ON public.offers FOR SELECT
  TO anon, authenticated
  USING (status = 'active');

DROP POLICY IF EXISTS "offers_admin_all" ON public.offers;
CREATE POLICY "offers_admin_all" ON public.offers FOR ALL
  TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "offer_books_select_public" ON public.offer_books;
CREATE POLICY "offer_books_select_public" ON public.offer_books FOR SELECT
  TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.offers o WHERE o.id = offer_books.offer_id AND o.status = 'active'));

DROP POLICY IF EXISTS "offer_books_admin_all" ON public.offer_books;
CREATE POLICY "offer_books_admin_all" ON public.offer_books FOR ALL
  TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS offers_touch_updated_at ON public.offers;
CREATE TRIGGER offers_touch_updated_at BEFORE UPDATE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.is_offer_purchasable(p_offer_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
SELECT EXISTS (
  SELECT 1 FROM public.offers o
  WHERE o.id = p_offer_id
    AND o.status = 'active'
    AND (o.start_at IS NULL OR o.start_at <= now())
    AND (o.end_at IS NULL OR o.end_at >= now())
);
$$;

CREATE OR REPLACE FUNCTION public.validate_offer_cart(p_offer_id uuid, p_book_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_offer record;
  v_count integer;
  v_not_in_offer uuid[];
  v_out_of_stock uuid[];
  v_subtotal numeric;
BEGIN
  SELECT * INTO v_offer FROM public.offers WHERE id = p_offer_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'العرض غير موجود');
  END IF;

  IF v_offer.status != 'active' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'العرض غير نشط');
  END IF;
  IF v_offer.start_at IS NOT NULL AND v_offer.start_at > now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'العرض لم يبدأ بعد');
  END IF;
  IF v_offer.end_at IS NOT NULL AND v_offer.end_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'انتهت صلاحية العرض');
  END IF;

  SELECT array_agg(DISTINCT x) INTO p_book_ids FROM unnest(p_book_ids) AS x;
  v_count := array_length(p_book_ids, 1);
  IF v_count IS NULL OR v_count = 0 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'لم يتم اختيار أي كتب');
  END IF;

  IF v_count < v_offer.min_books THEN
    RETURN jsonb_build_object('valid', false, 'error', 'الحد الأدنى ' || v_offer.min_books || ' كتب');
  END IF;
  IF v_offer.max_books IS NOT NULL AND v_count > v_offer.max_books THEN
    RETURN jsonb_build_object('valid', false, 'error', 'الحد الأقصى ' || v_offer.max_books || ' كتب');
  END IF;

  SELECT array_agg(x) INTO v_not_in_offer
  FROM unnest(p_book_ids) AS x
  LEFT JOIN public.offer_books ob ON ob.offer_id = p_offer_id AND ob.book_id = x
  WHERE ob.book_id IS NULL;
  IF v_not_in_offer IS NOT NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'بعض الكتب لا تنتمي للعرض', 'invalid_books', v_not_in_offer);
  END IF;

  SELECT array_agg(b.id) INTO v_out_of_stock
  FROM public.books b
  WHERE b.id = ANY(p_book_ids) AND b.stock <= 0;
  IF v_out_of_stock IS NOT NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'بعض الكتب غير متوفرة بالمخزون', 'out_of_stock', v_out_of_stock);
  END IF;

  v_subtotal := v_count * v_offer.price_per_book;
  RETURN jsonb_build_object(
    'valid', true,
    'offer_id', v_offer.id,
    'offer_name', v_offer.name,
    'price_per_book', v_offer.price_per_book,
    'book_ids', p_book_ids,
    'count', v_count,
    'subtotal', v_subtotal
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_title(p_title text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE t text;
BEGIN
  t := lower(trim(p_title));
  t := translate(t, 'أإآٱ', 'اااا');
  t := translate(t, 'يىئ', 'ييي');
  t := translate(t, 'ة', 'ه');
  t := regexp_replace(t, '[\p{P}\p{S}]', '', 'g');
  t := regexp_replace(t, '\s+', ' ', 'g');
  RETURN t;
END;
$$;

CREATE OR REPLACE FUNCTION public.match_offer_book_titles(p_titles text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_matched jsonb := '[]'::jsonb;
  v_not_found text[] := '{}';
  v_ambiguous jsonb := '[]'::jsonb;
  v_seen_norm text[] := '{}';
  v_dup_count integer := 0;
  v_norm text;
  v_match_count integer;
  v_book_id uuid;
  v_book_title text;
  v_candidates jsonb;
BEGIN
  IF p_titles IS NULL THEN
    RETURN jsonb_build_object('matched', '[]', 'not_found', '{}', 'ambiguous', '[]', 'duplicate_input_count', 0);
  END IF;

  FOR i IN 1..array_length(p_titles, 1) LOOP
    DECLARE v_raw text := trim(p_titles[i]); BEGIN
      IF v_raw = '' THEN CONTINUE; END IF;
      v_norm := public.normalize_title(v_raw);

      IF v_seen_norm @> ARRAY[v_norm] THEN
        v_dup_count := v_dup_count + 1;
        CONTINUE;
      END IF;
      v_seen_norm := array_append(v_seen_norm, v_norm);

      SELECT count(*) INTO v_match_count FROM public.books b WHERE public.normalize_title(b.title) = v_norm;

      IF v_match_count = 0 THEN
        v_not_found := array_append(v_not_found, v_raw);
      ELSIF v_match_count = 1 THEN
        SELECT b.id, b.title INTO v_book_id, v_book_title FROM public.books b WHERE public.normalize_title(b.title) = v_norm LIMIT 1;
        v_matched := v_matched || jsonb_build_array(jsonb_build_object('input', v_raw, 'book_id', v_book_id, 'title', v_book_title));
      ELSE
        SELECT jsonb_agg(jsonb_build_object('book_id', b.id, 'title', b.title)) INTO v_candidates
        FROM public.books b WHERE public.normalize_title(b.title) = v_norm;
        v_ambiguous := v_ambiguous || jsonb_build_array(jsonb_build_object('input', v_raw, 'candidates', v_candidates));
      END IF;
    END; END LOOP;

  RETURN jsonb_build_object(
    'matched', v_matched,
    'not_found', to_jsonb(v_not_found),
    'ambiguous', v_ambiguous,
    'duplicate_input_count', v_dup_count
  );
END;
$$;
