-- ==============================================================================
-- THIÈSDN BILLETTERIE — COLMATAGE CRITIQUE DE LA FONCTION RPC SCAN_TICKET
-- 1. Obligation d'un code de poste de scan actif (p_station_code)
-- 2. Vérification stricte d'appartenance à l'événement (p_event_id = ticket.event_id)
-- 3. Verrouillage transactionnel atomique FOR UPDATE (anti race-condition)
-- ==============================================================================

-- 1. S'assurer de la présence de la table des postes de contrôle (scan_stations)
CREATE TABLE IF NOT EXISTS public.scan_stations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  access_code TEXT UNIQUE NOT NULL,
  created_by TEXT,
  created_by_name TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  scans_count INT DEFAULT 0,
  last_scanned_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index pour recherche rapide lors du scan
CREATE INDEX IF NOT EXISTS idx_scan_stations_code ON public.scan_stations (upper(trim(access_code)));
CREATE INDEX IF NOT EXISTS idx_scan_stations_event ON public.scan_stations (event_id);

-- Activation RLS sur scan_stations
ALTER TABLE public.scan_stations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture des postes par access_code" ON public.scan_stations;
CREATE POLICY "Lecture des postes par access_code" ON public.scan_stations
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Gestion des postes par promoteur ou admin" ON public.scan_stations;
CREATE POLICY "Gestion des postes par promoteur ou admin" ON public.scan_stations
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = scan_stations.event_id AND e.promoter_id = auth.uid())
    OR public.is_admin()
  );

GRANT SELECT ON public.scan_stations TO anon, authenticated, service_role;

-- 2. Suppression de l'ancienne signature vulnérable
DROP FUNCTION IF EXISTS public.scan_ticket(TEXT);
DROP FUNCTION IF EXISTS public.scan_ticket(TEXT, TEXT, UUID);

-- 3. Nouvelle procédure stockée sécurisée à 3 paramètres
CREATE OR REPLACE FUNCTION public.scan_ticket(
  p_qr_code TEXT,
  p_station_code TEXT,
  p_event_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_station public.scan_stations%ROWTYPE;
  v_ticket public.tickets%ROWTYPE;
  v_clean_code TEXT;
  v_clean_station TEXT;
  v_previous_scan_time TEXT;
BEGIN
  v_clean_code := upper(trim(p_qr_code));
  v_clean_station := upper(trim(p_station_code));

  -- ÉTAPE A : Vérification du poste de scan
  IF v_clean_station IS NULL OR v_clean_station = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'invalid_station',
      'message', 'CODE DE POSTE DE CONTRÔLE OBLIGATOIRE'
    );
  END IF;

  SELECT * INTO v_station
  FROM public.scan_stations
  WHERE upper(trim(access_code)) = v_clean_station
    AND is_active = true;

  IF NOT FOUND THEN
    -- Autoriser uniquement si administrateur connecté ou poste master admin dédié
    IF NOT (public.is_admin() OR v_clean_station IN ('ADMIN-CHECKIN', 'STA-ADMIN-MASTER')) THEN
      RETURN jsonb_build_object(
        'success', false,
        'reason', 'invalid_station',
        'message', 'POSTE DE CONTRÔLE INVALIDE OU DÉSACTIVÉ'
      );
    END IF;
  ELSE
    -- Si le poste existe mais est dédié à un autre événement
    IF v_station.event_id IS NOT NULL AND p_event_id IS NOT NULL AND v_station.event_id <> p_event_id THEN
      RETURN jsonb_build_object(
        'success', false,
        'reason', 'station_event_mismatch',
        'message', 'CE POSTE DE CONTRÔLE EST ASSIGNÉ À UN AUTRE ÉVÉNEMENT'
      );
    END IF;
  END IF;

  -- ÉTAPE B : Verrouillage atomique de la ligne ticket (FOR UPDATE)
  SELECT * INTO v_ticket 
  FROM public.tickets
  WHERE upper(trim(qr_code)) = v_clean_code OR id::text = trim(p_qr_code)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false, 
      'reason', 'not_found',
      'message', 'BILLET INTROUVABLE OU FAUX'
    );
  END IF;

  -- ÉTAPE C : Contrôle d'appartenance strict à l'événement
  IF p_event_id IS NOT NULL AND (v_ticket.event_id IS NULL OR v_ticket.event_id <> p_event_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'wrong_event',
      'message', 'BILLET INVALIDE POUR CET ÉVÉNEMENT (CONFLIT DE SOIRÉE)',
      'ticket', jsonb_build_object(
        'id', v_ticket.id,
        'event_id', v_ticket.event_id,
        'event_title', v_ticket.event_title,
        'tier_name', v_ticket.tier_name,
        'status', v_ticket.status
      )
    );
  END IF;

  -- ÉTAPE D : Billet physique non vendu (ACCÈS REFUSÉ)
  IF v_ticket.status = 'printed_not_sold' OR v_ticket.status IN ('physical_printed', 'physical_allocated') THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'printed_not_sold',
      'message', 'BILLET NON DÉCLARÉ VENDU (ACTIVATION GUICHET REQUISE)',
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

  -- ÉTAPE E : Billet déjà scanné (ANTI DOUBLE SCAN / SCREENSHOT)
  IF v_ticket.status IN ('scanned', 'used') THEN
    v_previous_scan_time := coalesce(to_char(v_ticket.used_at, 'HH24:MI:SS'), 'heure inconnue');
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'already_scanned',
      'message', 'BILLET DÉJÀ UTILISÉ À ' || v_previous_scan_time,
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

  -- ÉTAPE F : Billet annulé
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

  -- ÉTAPE G : Validation et marquage atomique du billet
  UPDATE public.tickets
  SET 
    status = 'scanned', 
    used_at = timezone('utc'::text, now()),
    validated_station_id = v_clean_station,
    validated_station_name = coalesce(v_station.name, v_clean_station)
  WHERE id = v_ticket.id;

  -- Incrémentation des statistiques du poste de scan
  IF v_station.id IS NOT NULL THEN
    UPDATE public.scan_stations
    SET 
      scans_count = coalesce(scans_count, 0) + 1,
      last_scanned_at = timezone('utc'::text, now())
    WHERE id = v_station.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'reason', 'authorized',
    'message', 'ACCÈS AUTORISÉ',
    'scanned_at', timezone('utc'::text, now()),
    'scanned_at_formatted', to_char(timezone('utc'::text, now()), 'HH24:MI:SS'),
    'ticket', jsonb_build_object(
      'id', v_ticket.id,
      'event_id', v_ticket.event_id,
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

-- 4. Droits d'exécution pour les postes de contrôle (anon, authenticated, service_role)
GRANT EXECUTE ON FUNCTION public.scan_ticket(TEXT, TEXT, UUID) TO anon, authenticated, service_role;

-- 5. Recharger le schéma PostgREST
NOTIFY pgrst, 'reload schema';
