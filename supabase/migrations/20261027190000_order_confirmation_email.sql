-- ====================================================================
-- MIGRATION V2.1 : Confirmation Email Commande, Guest Token & Email Logs
-- ====================================================================

-- 0. Fonction helper anti-récursion RLS public.is_admin()
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- 1. Colonnes sur public.orders (CORRECTION 2 : SANS DEFAULT sur guest_token)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS guest_token TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;

ALTER TABLE public.orders ALTER COLUMN guest_token DROP DEFAULT;

-- 2. Table de traçabilité public.email_logs (CORRECTION 1 : RLS via public.is_admin())
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  recipient TEXT,
  status TEXT CHECK (status IN ('sent', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read email_logs" ON public.email_logs;
CREATE POLICY "Admins can read email_logs" ON public.email_logs
  FOR SELECT USING (public.is_admin());

-- 3. RPC confirm_manual_order (CORRECTION 2 : Génération de guest_token à la confirmation)
CREATE OR REPLACE FUNCTION public.confirm_manual_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_event public.events%ROWTYPE;
  v_i INT;
  v_qr TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Accès refusé. Rôle administrateur requis.');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Commande introuvable.');
  END IF;

  IF v_order.status = 'confirmed' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cette commande a déjà été confirmée.');
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = v_order.event_id;

  -- Marquer confirmée
  UPDATE public.orders
  SET status = 'confirmed', confirmed_by = auth.uid(), confirmed_at = now()
  WHERE id = p_order_id;

  -- Générer guest_token uniquement à la confirmation du paiement
  UPDATE public.orders
  SET guest_token = replace(gen_random_uuid()::text, '-', '')
  WHERE id = p_order_id AND guest_token IS NULL;

  -- Génération des billets pour chaque place commandée
  FOR v_i IN 1..v_order.quantity LOOP
    v_qr := 'THIESDN-' || upper(COALESCE(v_event.city, 'THIES')) || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);
    INSERT INTO public.tickets (
      order_id, event_id, user_id, event_title, event_poster, event_date,
      event_time, event_venue, tier_name, price, qr_code, holder_name, holder_phone, status
    ) VALUES (
      v_order.id, v_event.id, v_order.user_id, v_event.title, COALESCE(v_event.poster_url, v_event.affiche_url),
      COALESCE(v_event.date, v_event.event_date::text), COALESCE(v_event.time, v_event.event_time), v_event.venue, v_order.tier_name,
      v_order.unit_price, v_qr, v_order.customer_name, v_order.customer_phone, 'valid'
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'message', 'Paiement confirmé et billets émis avec succès.');
END;
$$;

-- 4. RPC sécurisée pour permettre à un Guest d'accéder à son billet via (?order=CMD-XXX&token=abc123)
CREATE OR REPLACE FUNCTION public.get_order_tickets_by_token(
  p_reference TEXT,
  p_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_tickets JSONB;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 16 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Jeton d''accès invalide.');
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE reference = p_reference
    AND guest_token = p_token
    AND status = 'confirmed'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Commande introuvable, non confirmée ou lien invalide.');
  END IF;

  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_tickets
  FROM public.tickets t
  WHERE t.order_id = v_order.id;

  RETURN jsonb_build_object(
    'success', true,
    'order', to_jsonb(v_order),
    'tickets', v_tickets
  );
END;
$$;
