-- ============================================================================
-- MIGRATION : Accès Public Sécurisé aux Billets Digitaux (/ticket/:id)
-- Projet : Thièsdn Billetterie
-- Date : 2026-11-03
-- ============================================================================

-- Fonction RPC SECURITY DEFINER permettant à un client (même sans compte / invité WhatsApp)
-- de charger les informations de son billet via son UUID unique à 128 bits.
CREATE OR REPLACE FUNCTION public.get_ticket_by_public_id(p_ticket_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket RECORD;
BEGIN
  IF p_ticket_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Identifiant de billet invalide.');
  END IF;

  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE id = p_ticket_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Billet introuvable.');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'ticket', to_jsonb(v_ticket)
  );
END;
$$;

-- Accorder l'exécution de la fonction au rôle anonyme et aux utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION public.get_ticket_by_public_id(UUID) TO anon, authenticated, service_role;
