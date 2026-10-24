-- ====================================================================
-- THIESDN BILLETTERIE — MIGRATION RPC SCAN SÉCURISÉ & ANTI-FRAUDE
-- Verrouillage FOR UPDATE atomique + Retour complet Titulaire & Statut
-- ====================================================================

-- 1. Nettoyage de l'ancienne signature si nécessaire
DROP FUNCTION IF EXISTS public.scan_ticket(TEXT);

-- 2. Procédure stockée scan_ticket(p_qr_code)
CREATE OR REPLACE FUNCTION public.scan_ticket(p_qr_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ticket public.tickets%ROWTYPE;
  v_previous_scan_time TEXT;
  v_clean_code TEXT;
BEGIN
  v_clean_code := upper(trim(p_qr_code));

  -- Verrouillage atomique de la ligne avec FOR UPDATE pour empêcher toute concurrence
  SELECT * INTO v_ticket 
  FROM public.tickets
  WHERE upper(trim(qr_code)) = v_clean_code OR id::text = trim(p_qr_code)
  FOR UPDATE;

  -- Billet inexistant dans la base
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false, 
      'reason', 'not_found',
      'message', 'BILLET INTROUVABLE OU FAUX'
    );
  END IF;

  -- CAS 1 : Billet physique non déclaré vendu (ACCÈS STRICTEMENT REFUSÉ)
  IF v_ticket.status = 'printed_not_sold' OR v_ticket.status IN ('physical_printed', 'physical_allocated') THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'printed_not_sold',
      'message', 'BILLET NON DÉCLARÉ VENDU',
      'ticket', jsonb_build_object(
        'id', v_ticket.id,
        'holder_name', coalesce(nullif(trim(v_ticket.holder_name), ''), 'Nom non renseigné'),
        'holder_phone', coalesce(nullif(trim(v_ticket.holder_phone), ''), 'Téléphone non renseigné'),
        'qr_code', v_ticket.qr_code,
        'event_title', v_ticket.event_title,
        'tier_name', v_ticket.tier_name,
        'status', v_ticket.status,
        'is_physical', coalesce(v_ticket.is_physical, false)
      )
    );
  END IF;

  -- CAS 2 : Billet déjà scanné (ANTI-CAPTURE D'ÉCRAN & MULTI-IMPRESSION)
  IF v_ticket.status IN ('scanned', 'used') THEN
    v_previous_scan_time := coalesce(to_char(v_ticket.used_at, 'HH24:MI:SS'), 'heure inconnue');
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'already_scanned',
      'message', 'BILLET DÉJÀ UTILISÉ',
      'scanned_at', v_ticket.used_at,
      'scanned_at_formatted', v_previous_scan_time,
      'ticket', jsonb_build_object(
        'id', v_ticket.id,
        'holder_name', coalesce(nullif(trim(v_ticket.holder_name), ''), 'Nom non renseigné'),
        'holder_phone', coalesce(nullif(trim(v_ticket.holder_phone), ''), 'Téléphone non renseigné'),
        'qr_code', v_ticket.qr_code,
        'event_title', v_ticket.event_title,
        'tier_name', v_ticket.tier_name,
        'status', v_ticket.status,
        'is_physical', coalesce(v_ticket.is_physical, false)
      )
    );
  END IF;

  -- CAS 3 : Billet annulé par l'organisation
  IF v_ticket.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'cancelled',
      'message', 'BILLET ANNULÉ PAR L''ORGANISATION',
      'ticket', jsonb_build_object(
        'id', v_ticket.id,
        'holder_name', coalesce(nullif(trim(v_ticket.holder_name), ''), 'Nom non renseigné'),
        'holder_phone', coalesce(nullif(trim(v_ticket.holder_phone), ''), 'Téléphone non renseigné'),
        'qr_code', v_ticket.qr_code,
        'event_title', v_ticket.event_title,
        'tier_name', v_ticket.tier_name,
        'status', v_ticket.status,
        'is_physical', coalesce(v_ticket.is_physical, false)
      )
    );
  END IF;

  -- CAS 4 : Billet valide (valid ou sold_valid) -> Passage IMMÉDIAT à 'scanned' avec timestamp now()
  UPDATE public.tickets
  SET 
    status = 'scanned', 
    used_at = timezone('utc'::text, now())
  WHERE id = v_ticket.id;

  RETURN jsonb_build_object(
    'success', true,
    'reason', 'authorized',
    'message', 'ACCÈS AUTORISÉ',
    'scanned_at', timezone('utc'::text, now()),
    'scanned_at_formatted', to_char(timezone('utc'::text, now()), 'HH24:MI:SS'),
    'ticket', jsonb_build_object(
      'id', v_ticket.id,
      'holder_name', coalesce(nullif(trim(v_ticket.holder_name), ''), 'Nom non renseigné'),
      'holder_phone', coalesce(nullif(trim(v_ticket.holder_phone), ''), 'Téléphone non renseigné'),
      'qr_code', v_ticket.qr_code,
      'event_title', v_ticket.event_title,
      'tier_name', v_ticket.tier_name,
      'status', 'scanned',
      'is_physical', coalesce(v_ticket.is_physical, false)
    )
  );
END;
$$;

-- 3. Droits d'exécution pour les postes de scan publics (anon) et authentifiés
GRANT EXECUTE ON FUNCTION public.scan_ticket(TEXT) TO anon, authenticated, service_role;
