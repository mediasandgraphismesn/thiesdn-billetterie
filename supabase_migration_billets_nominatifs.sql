-- ============================================================
-- MIGRATION : billets physiques nominatifs (nom + téléphone)
-- A exécuter dans Supabase > SQL Editor. Idempotent (relançable).
-- ============================================================

-- 0. Contrôle des prérequis (message clair si une table de base manque)
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','events','tickets'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE EXCEPTION 'Table public.% absente : exécutez d''abord le schéma de base (Admin > Schéma SQL) puis relancez ce script.', t;
    END IF;
  END LOOP;
END $$;

-- 1. Table des collaborateurs / points de vente (créée si absente)
CREATE TABLE IF NOT EXISTS public.sales_agents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  promoter_id TEXT NOT NULL,
  point_de_vente TEXT NOT NULL,
  gerant_name TEXT NOT NULL,
  telephone TEXT NOT NULL,
  email TEXT,
  quartier TEXT,
  allocated_count INT DEFAULT 0,
  sold_count INT DEFAULT 0,
  commission_percent NUMERIC DEFAULT 10,
  cash_collected NUMERIC DEFAULT 0,
  amount_due NUMERIC DEFAULT 0,
  amount_paid_to_promoter NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Colonnes d'identité de l'acheteur sur la table tickets (Étape 1 : holder_name, holder_phone, holder_email)
--    Nullable : les billets existants sans nom s'afficheront « Nom non renseigné » au scan.
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS holder_name TEXT;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS holder_phone TEXT;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS holder_email TEXT;

-- Colonnes d'affichage du billet (absentes des anciens schémas, nullables)
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS event_title TEXT;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS event_poster TEXT;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS event_date TEXT;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS event_time TEXT;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS event_venue TEXT;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS seat_number TEXT;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS purchased_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- 3. Contrôle des colonnes indispensables déjà attendues sur public.tickets
DO $$
DECLARE c TEXT; missing TEXT := '';
BEGIN
  FOREACH c IN ARRAY ARRAY['id','event_id','user_id','tier_name','price','qr_code','status'] LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='tickets' AND column_name=c) THEN
      missing := missing || c || ' ';
    END IF;
  END LOOP;
  IF missing <> '' THEN
    RAISE EXCEPTION 'Colonnes manquantes sur public.tickets : % . Envoyez la liste des colonnes de la table pour adapter le script.', missing;
  END IF;
END $$;

ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS used_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS validated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS sold_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS is_physical BOOLEAN DEFAULT FALSE;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES public.sales_agents(id) ON DELETE SET NULL;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS agent_name TEXT;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS validated_station_id TEXT;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS validated_station_name TEXT;

ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_status_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_status_check CHECK (status IN ('valid','used','cancelled','printed_not_sold','sold_valid','scanned','physical_printed','physical_allocated','physical_sold'));

-- RPC 1 : Scan sécurisé et sans concurrence (RÈGLE DE SÉCURITÉ : VALIDATION PAR VENTE)
DROP FUNCTION IF EXISTS public.scan_ticket(TEXT);
CREATE OR REPLACE FUNCTION public.scan_ticket(p_qr_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ticket public.tickets%ROWTYPE;
BEGIN
  -- Verrouillage de la ligne avec FOR UPDATE pour empêcher la validation concurrente
  SELECT * INTO v_ticket 
  FROM public.tickets
  WHERE qr_code = p_qr_code OR id::text = p_qr_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Billet introuvable ou faux');
  END IF;

  -- 1. Billet physique non vendu : ACCÈS STRICTEMENT REFUSÉ
  IF v_ticket.status = 'printed_not_sold' OR v_ticket.status IN ('physical_printed', 'physical_allocated') THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'Ce billet n''a pas été déclaré comme vendu. Contactez le promoteur.', 
      'ticket', row_to_json(v_ticket)
    );
  END IF;

  -- 2. Billet déjà scanné
  IF v_ticket.status IN ('scanned', 'used') THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'Billet déjà utilisé. Double entrée interdite.', 
      'ticket', row_to_json(v_ticket)
    );
  END IF;

  -- 3. Billet annulé ou désactivé
  IF v_ticket.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'Ce billet a été désactivé ou annulé par l''organisation.', 
      'ticket', row_to_json(v_ticket)
    );
  END IF;

  -- 4. Billet valide (sold_valid ou digital valid)
  UPDATE public.tickets
  SET status = 'scanned', used_at = now(), validated_by = auth.uid()
  WHERE id = v_ticket.id;

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Accès Autorisé : ' || v_ticket.tier_name,
    'ticket', jsonb_build_object(
      'id', v_ticket.id,
      'holder_name', coalesce(nullif(trim(v_ticket.holder_name), ''), 'Nom non renseigné'),
      'holder_phone', v_ticket.holder_phone,
      'qr_code', v_ticket.qr_code,
      'event_title', v_ticket.event_title,
      'tier_name', v_ticket.tier_name,
      'status', 'scanned',
      'is_physical', v_ticket.is_physical
    )
  );
END;
$$;

-- RPC 1.1 : Activation unitaire par le collaborateur (identité de l'acheteur OBLIGATOIRE)
DROP FUNCTION IF EXISTS public.activate_physical_ticket_sale(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.activate_physical_ticket_sale(
  p_agent_id UUID,
  p_ticket_code TEXT,
  p_holder_name TEXT,
  p_holder_phone TEXT,
  p_holder_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ticket public.tickets%ROWTYPE;
BEGIN
  IF length(trim(coalesce(p_holder_name, ''))) = 0 OR length(trim(coalesce(p_holder_phone, ''))) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Le nom et le téléphone du client sont obligatoires pour activer le billet.');
  END IF;

  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE (qr_code = p_ticket_code OR id::text = p_ticket_code)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Billet introuvable.');
  END IF;

  IF v_ticket.agent_id IS NOT NULL AND v_ticket.agent_id <> p_agent_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ce billet est alloué à un autre point de vente.');
  END IF;

  IF v_ticket.status = 'sold_valid' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ce billet a déjà été déclaré vendu.');
  END IF;

  IF v_ticket.status IN ('scanned', 'used') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ce billet a déjà été scanné à l''entrée.');
  END IF;

  IF v_ticket.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ce billet a été désactivé ou annulé.');
  END IF;

  UPDATE public.tickets
  SET status = 'sold_valid', sold_at = now(), agent_id = p_agent_id,
      holder_name = trim(p_holder_name), holder_phone = trim(p_holder_phone),
      holder_email = nullif(trim(coalesce(p_holder_email, '')), '')
  WHERE id = v_ticket.id;

  UPDATE public.sales_agents
  SET sold_count = sold_count + 1,
      cash_collected = cash_collected + v_ticket.price,
      amount_due = amount_due + ROUND(v_ticket.price * (1 - commission_percent / 100.0))
  WHERE id = p_agent_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Billet activé avec succès (' || v_ticket.price || ' FCFA).',
    'ticket', jsonb_build_object('id', v_ticket.id, 'qr_code', v_ticket.qr_code, 'price', v_ticket.price, 'status', 'sold_valid')
  );
END;
$$;

-- ====================================================================
-- RLS (ROW LEVEL SECURITY) POLITIQUES DE SÉCURITÉ SERVEUR
-- RÈGLE D'OR : Ne JAMAIS faire de SELECT direct sur public.profiles
-- dans une politique RLS (risque d'infinite recursion).
-- Toujours utiliser public.is_admin() en SECURITY DEFINER.
-- ====================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Tickets : lecture par le propriétaire du billet, collaborateur assigné, promoteur ou admin via is_admin()
DROP POLICY IF EXISTS "Tickets read owner or admin" ON public.tickets;
CREATE POLICY "Tickets read owner or admin" ON public.tickets FOR SELECT 
USING (
  user_id = auth.uid() 
  OR agent_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.events WHERE events.id = tickets.event_id AND events.promoter_id = auth.uid())
  OR public.is_admin()
);

-- RLS Collaborateurs : activation exclusive des billets alloués lors de la vente
DROP POLICY IF EXISTS "Sales agents update assigned tickets" ON public.tickets;
CREATE POLICY "Sales agents update assigned tickets" ON public.tickets FOR UPDATE
USING (
  status IN ('printed_not_sold', 'physical_printed', 'physical_allocated')
  AND (
    agent_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.sales_agents WHERE sales_agents.user_id = auth.uid() AND sales_agents.id = tickets.agent_id)
  )
)
WITH CHECK (
  status = 'sold_valid'
  AND length(trim(coalesce(holder_name, ''))) > 0
  AND length(trim(coalesce(holder_phone, ''))) > 0
);

-- Les agents de scan (liens /scan/...) n'ont AUCUNE policy directe sur tickets :
-- ils passent uniquement par la RPC SECURITY DEFINER scan_ticket (lecture + validation).
-- Les promoteurs/admins corrigent nom/téléphone via la policy "Promoters update event tickets".

-- RLS Promoteurs : désactivation / annulation / correction sécurisée de leurs billets
DROP POLICY IF EXISTS "Promoters update event tickets" ON public.tickets;
CREATE POLICY "Promoters update event tickets" ON public.tickets FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.events WHERE events.id = tickets.event_id AND events.promoter_id = auth.uid())
  OR public.is_admin()
);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
