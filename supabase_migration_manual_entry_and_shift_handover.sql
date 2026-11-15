-- ==============================================================================
-- MIGRATION : FLAG DÉCLARATION MANUELLE (is_manual_entry) & CLÔTURE DE CAISSE POS
-- Projet : Thièsdn Billetterie
-- Exécution : Copier-coller ce script dans Supabase > SQL Editor (100% idempotent)
-- ==============================================================================

-- 1. Ajouter le flag is_manual_entry sur public.tickets
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS is_manual_entry BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_tickets_agent_manual_entry
  ON public.tickets (agent_id, is_manual_entry)
  WHERE is_physical = true;

-- 2. Mettre à jour la RPC atomique activate_physical_ticket_sale
--    Supprimer les anciennes signatures avant recréation (règle PostgreSQL)
DROP FUNCTION IF EXISTS public.activate_physical_ticket_sale(UUID, TEXT);
DROP FUNCTION IF EXISTS public.activate_physical_ticket_sale(UUID, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.activate_physical_ticket_sale(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN);

CREATE OR REPLACE FUNCTION public.activate_physical_ticket_sale(
  p_agent_id UUID,
  p_ticket_code TEXT,
  p_holder_name TEXT,
  p_holder_phone TEXT,
  p_holder_email TEXT DEFAULT NULL,
  p_is_manual_entry BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket public.tickets%ROWTYPE;
  v_manual BOOLEAN := COALESCE(p_is_manual_entry, FALSE);
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
  SET status = 'sold_valid',
      sold_at = now(),
      agent_id = p_agent_id,
      holder_name = trim(p_holder_name),
      holder_phone = trim(p_holder_phone),
      holder_email = nullif(trim(coalesce(p_holder_email, '')), ''),
      is_manual_entry = v_manual
  WHERE id = v_ticket.id;

  UPDATE public.sales_agents
  SET sold_count = sold_count + 1,
      cash_collected = cash_collected + v_ticket.price,
      amount_due = amount_due + ROUND(v_ticket.price * (1 - commission_percent / 100.0))
  WHERE id = p_agent_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Billet activé avec succès (' || v_ticket.price || ' FCFA).',
    'ticket', jsonb_build_object(
      'id', v_ticket.id,
      'qr_code', v_ticket.qr_code,
      'price', v_ticket.price,
      'status', 'sold_valid',
      'is_manual_entry', v_manual
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_physical_ticket_sale(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;

-- 3. Table de journalisation des Relevés / Clôtures de Caisse (Shift Handover)
CREATE TABLE IF NOT EXISTS public.pos_shift_handovers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.sales_agents(id) ON DELETE CASCADE,
  agent_name TEXT,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  event_title TEXT,
  sold_count INT NOT NULL DEFAULT 0,
  manual_sales_count INT NOT NULL DEFAULT 0,
  expected_amount NUMERIC NOT NULL DEFAULT 0,
  counted_amount NUMERIC NOT NULL DEFAULT 0,
  discrepancy_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('matched', 'mismatch_blocked')),
  notes TEXT,
  submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pos_shift_handovers_agent_created
  ON public.pos_shift_handovers (agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pos_shift_handovers_event_created
  ON public.pos_shift_handovers (event_id, created_at DESC);

ALTER TABLE public.pos_shift_handovers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "POS shift handovers select policy" ON public.pos_shift_handovers;
CREATE POLICY "POS shift handovers select policy"
ON public.pos_shift_handovers
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.sales_agents sa
    WHERE sa.id = pos_shift_handovers.agent_id
    AND (sa.user_id = auth.uid() OR sa.promoter_id::text = auth.uid()::text)
  )
  OR EXISTS (
    SELECT 1 FROM public.events ev
    WHERE ev.id = pos_shift_handovers.event_id
    AND ev.promoter_id::text = auth.uid()::text
  )
);

DROP POLICY IF EXISTS "POS shift handovers insert policy" ON public.pos_shift_handovers;
CREATE POLICY "POS shift handovers insert policy"
ON public.pos_shift_handovers
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.sales_agents sa
    WHERE sa.id = pos_shift_handovers.agent_id
    AND (sa.user_id = auth.uid() OR sa.promoter_id::text = auth.uid()::text)
  )
  OR EXISTS (
    SELECT 1 FROM public.events ev
    WHERE ev.id = pos_shift_handovers.event_id
    AND ev.promoter_id::text = auth.uid()::text
  )
);

-- Vérification post-migration (attendu : 1 ligne 'is_manual_entry' et 1 ligne 'pos_shift_handovers')
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tickets'
  AND column_name = 'is_manual_entry';

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'pos_shift_handovers';
