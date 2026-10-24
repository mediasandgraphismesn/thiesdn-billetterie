-- ====================================================================
-- THIESDN BILLETTERIE — MIGRATION ASSIGNATION & TRANSFERT DE BILLETS
-- Achats Multiples : Assignation nominative à un ami avec lien unique
-- ====================================================================

-- 1. Ajout des colonnes d'assignation dans la table public.tickets
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS assigned_to_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_to_name TEXT,
  ADD COLUMN IF NOT EXISTS assigned_to_phone TEXT,
  ADD COLUMN IF NOT EXISTS assigned_to_email TEXT,
  ADD COLUMN IF NOT EXISTS assigned_to_avatar TEXT,
  ADD COLUMN IF NOT EXISTS assignment_status TEXT CHECK (assignment_status IN ('unassigned', 'pending', 'accepted', 'declined')) DEFAULT 'unassigned',
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS claim_token TEXT UNIQUE;

-- 2. Index de performance pour résolution instantanée (< 5ms)
CREATE INDEX IF NOT EXISTS idx_tickets_claim_token ON public.tickets (claim_token) WHERE claim_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_profile ON public.tickets (assigned_to_profile_id) WHERE assigned_to_profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_assignment_status ON public.tickets (assignment_status);

-- 3. Mise à jour de la politique RLS pour permettre à l'ami de voir son billet assigné
DROP POLICY IF EXISTS "Tickets select owner, assignee or admin" ON public.tickets;
CREATE POLICY "Tickets select owner, assignee or admin" ON public.tickets
FOR SELECT USING (
  auth.uid() = user_id 
  OR auth.uid() = assigned_to_profile_id 
  OR public.is_admin()
  OR EXISTS (SELECT 1 FROM public.events WHERE events.id = tickets.event_id AND events.promoter_id = auth.uid())
);

-- 4. RPC : Assigner un billet à un ami (par l'acheteur initial)
DROP FUNCTION IF EXISTS public.assign_ticket_to_friend(UUID, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.assign_ticket_to_friend(
  p_ticket_id UUID,
  p_friend_name TEXT,
  p_friend_phone TEXT,
  p_friend_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ticket public.tickets%ROWTYPE;
  v_claim_token TEXT;
BEGIN
  -- Nettoyage des entrées
  p_friend_name := trim(p_friend_name);
  p_friend_phone := trim(p_friend_phone);

  IF p_friend_name IS NULL OR p_friend_name = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Le nom de l''ami est obligatoire.');
  END IF;

  IF p_friend_phone IS NULL OR p_friend_phone = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Le numéro de téléphone est obligatoire.');
  END IF;

  -- Verrouillage de la ligne
  SELECT * INTO v_ticket 
  FROM public.tickets 
  WHERE id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Billet introuvable.');
  END IF;

  -- Vérification : seul l'acheteur ou un admin peut assigner le billet
  IF v_ticket.user_id != auth.uid() AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Non autorisé à transférer ce billet.');
  END IF;

  -- Sécurité : un billet déjà scanné ou déjà accepté ne peut plus être réassigné
  IF v_ticket.status IN ('scanned', 'used') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Impossible : ce billet a déjà été validé à l''entrée.');
  END IF;

  IF v_ticket.assignment_status = 'accepted' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ce billet a déjà été définitivement accepté par l''ami.');
  END IF;

  -- Génération d'un claim_token aléatoire unique
  v_claim_token := 'CLM-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 12));

  UPDATE public.tickets
  SET 
    assigned_to_name = p_friend_name,
    assigned_to_phone = p_friend_phone,
    assigned_to_email = nullif(trim(p_friend_email), ''),
    assignment_status = 'pending',
    assigned_at = timezone('utc'::text, now()),
    claim_token = v_claim_token
  WHERE id = v_ticket.id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Billet préparé pour le transfert.',
    'ticket_id', v_ticket.id,
    'claim_token', v_claim_token,
    'assigned_to_name', p_friend_name,
    'assigned_to_phone', p_friend_phone
  );
END;
$$;

-- 5. RPC : Annuler ou révoquer une assignation en attente
DROP FUNCTION IF EXISTS public.cancel_ticket_assignment(UUID);
CREATE OR REPLACE FUNCTION public.cancel_ticket_assignment(p_ticket_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ticket public.tickets%ROWTYPE;
BEGIN
  SELECT * INTO v_ticket 
  FROM public.tickets 
  WHERE id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Billet introuvable.');
  END IF;

  IF v_ticket.user_id != auth.uid() AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Non autorisé.');
  END IF;

  IF v_ticket.assignment_status = 'accepted' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Impossible d''annuler un billet déjà accepté.');
  END IF;

  UPDATE public.tickets
  SET 
    assigned_to_name = NULL,
    assigned_to_phone = NULL,
    assigned_to_email = NULL,
    assigned_to_avatar = NULL,
    assignment_status = 'unassigned',
    assigned_at = NULL,
    claim_token = NULL
  WHERE id = v_ticket.id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Assignation annulée. Le billet est de nouveau dans votre portefeuille personnel.'
  );
END;
$$;

-- 6. RPC : Réclamer et accepter le billet par l'ami (avec nom, téléphone et photo)
DROP FUNCTION IF EXISTS public.claim_ticket(TEXT, TEXT, TEXT, TEXT, UUID);
CREATE OR REPLACE FUNCTION public.claim_ticket(
  p_token_or_id TEXT,
  p_friend_name TEXT,
  p_friend_phone TEXT,
  p_friend_avatar TEXT DEFAULT NULL,
  p_friend_profile_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ticket public.tickets%ROWTYPE;
  v_purchaser_profile public.profiles%ROWTYPE;
  v_effective_profile_id UUID;
BEGIN
  p_friend_name := trim(p_friend_name);
  p_friend_phone := trim(p_friend_phone);

  IF p_friend_name IS NULL OR p_friend_name = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Votre nom complet est obligatoire pour recevoir le pass.');
  END IF;

  IF p_friend_phone IS NULL OR p_friend_phone = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Votre numéro de téléphone est obligatoire.');
  END IF;

  -- Recherche du billet par claim_token ou ID
  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE claim_token = trim(p_token_or_id) OR id::text = trim(p_token_or_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Lien d''invitation invalide ou expiré.');
  END IF;

  IF v_ticket.status IN ('scanned', 'used') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ce billet a déjà été utilisé.');
  END IF;

  IF v_ticket.assignment_status = 'accepted' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ce billet a déjà été réclamé.');
  END IF;

  -- Déterminer le profil ami (si connecté auth.uid() ou paramètre)
  v_effective_profile_id := coalesce(auth.uid(), p_friend_profile_id);

  -- Mise à jour du billet avec l'identité de l'ami
  UPDATE public.tickets
  SET 
    holder_name = p_friend_name,
    holder_phone = p_friend_phone,
    assigned_to_name = p_friend_name,
    assigned_to_phone = p_friend_phone,
    assigned_to_avatar = nullif(trim(p_friend_avatar), ''),
    assigned_to_profile_id = v_effective_profile_id,
    assignment_status = 'accepted',
    claimed_at = timezone('utc'::text, now())
  WHERE id = v_ticket.id;

  -- Enregistrement d'une notification pour l'acheteur initial
  IF v_ticket.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      type,
      read,
      created_at
    ) VALUES (
      v_ticket.user_id,
      '🎟️ Billet Accepté !',
      p_friend_name || ' a accepté votre billet pour ' || v_ticket.event_title || '.',
      'ticket',
      false,
      timezone('utc'::text, now())
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Félicitations ! Votre pass officiel pour ' || v_ticket.event_title || ' est activé.',
    'ticket', jsonb_build_object(
      'id', v_ticket.id,
      'event_title', v_ticket.event_title,
      'tier_name', v_ticket.tier_name,
      'qr_code', v_ticket.qr_code,
      'holder_name', p_friend_name,
      'holder_phone', p_friend_phone,
      'holder_avatar', p_friend_avatar,
      'status', 'valid'
    )
  );
END;
$$;

-- 7. RPC : Décliner l'invitation (par l'ami)
DROP FUNCTION IF EXISTS public.decline_ticket(TEXT);
CREATE OR REPLACE FUNCTION public.decline_ticket(p_token_or_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ticket public.tickets%ROWTYPE;
BEGIN
  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE claim_token = trim(p_token_or_id) OR id::text = trim(p_token_or_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Billet introuvable.');
  END IF;

  IF v_ticket.assignment_status = 'accepted' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ce billet a déjà été accepté.');
  END IF;

  UPDATE public.tickets
  SET 
    assignment_status = 'declined',
    claim_token = NULL
  WHERE id = v_ticket.id;

  -- Notifier l'acheteur initial du refus
  IF v_ticket.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      type,
      read,
      created_at
    ) VALUES (
      v_ticket.user_id,
      'Billet Décliné',
      coalesce(v_ticket.assigned_to_name, 'Votre ami') || ' n''a pas pu accepter le billet. Il est de nouveau disponible dans votre Wallet.',
      'ticket',
      false,
      timezone('utc'::text, now())
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Le cadeau a été décliné et restitué à l''acheteur.'
  );
END;
$$;

-- 8. Mise à jour de scan_ticket pour renvoyer également holder_avatar
DROP FUNCTION IF EXISTS public.scan_ticket(TEXT);
CREATE OR REPLACE FUNCTION public.scan_ticket(p_qr_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ticket public.tickets%ROWTYPE;
  v_previous_scan_time TEXT;
  v_clean_code TEXT;
  v_avatar TEXT;
BEGIN
  v_clean_code := upper(trim(p_qr_code));

  -- Verrouillage atomique de la ligne
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

  v_avatar := coalesce(v_ticket.assigned_to_avatar, NULL);

  -- 1. Billet physique non vendu
  IF v_ticket.status = 'printed_not_sold' OR v_ticket.status IN ('physical_printed', 'physical_allocated') THEN
    RETURN jsonb_build_object(
      'success', false, 
      'reason', 'printed_not_sold',
      'message', 'BILLET NON DÉCLARÉ VENDU', 
      'ticket', jsonb_build_object(
        'id', v_ticket.id,
        'holder_name', coalesce(nullif(trim(v_ticket.holder_name), ''), 'Nom non renseigné'),
        'holder_phone', coalesce(nullif(trim(v_ticket.holder_phone), ''), 'Téléphone non renseigné'),
        'holder_avatar', v_avatar,
        'qr_code', v_ticket.qr_code,
        'event_title', v_ticket.event_title,
        'tier_name', v_ticket.tier_name,
        'status', v_ticket.status,
        'is_physical', coalesce(v_ticket.is_physical, false)
      )
    );
  END IF;

  -- 2. Billet déjà scanné
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
        'holder_avatar', v_avatar,
        'qr_code', v_ticket.qr_code,
        'event_title', v_ticket.event_title,
        'tier_name', v_ticket.tier_name,
        'status', v_ticket.status,
        'is_physical', coalesce(v_ticket.is_physical, false)
      )
    );
  END IF;

  -- 3. Billet annulé
  IF v_ticket.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'success', false, 
      'reason', 'cancelled',
      'message', 'BILLET ANNULÉ PAR L''ORGANISATION', 
      'ticket', jsonb_build_object(
        'id', v_ticket.id,
        'holder_name', coalesce(nullif(trim(v_ticket.holder_name), ''), 'Nom non renseigné'),
        'holder_phone', coalesce(nullif(trim(v_ticket.holder_phone), ''), 'Téléphone non renseigné'),
        'holder_avatar', v_avatar,
        'qr_code', v_ticket.qr_code,
        'event_title', v_ticket.event_title,
        'tier_name', v_ticket.tier_name,
        'status', v_ticket.status,
        'is_physical', coalesce(v_ticket.is_physical, false)
      )
    );
  END IF;

  -- 4. Billet valide -> passage IMMÉDIAT à scanned
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
      'holder_avatar', v_avatar,
      'qr_code', v_ticket.qr_code,
      'event_title', v_ticket.event_title,
      'tier_name', v_ticket.tier_name,
      'status', 'scanned',
      'is_physical', coalesce(v_ticket.is_physical, false)
    )
  );
END;
$$;

-- 9. Droits d'exécution RPC
GRANT EXECUTE ON FUNCTION public.assign_ticket_to_friend(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_ticket_assignment(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_ticket(TEXT, TEXT, TEXT, TEXT, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.decline_ticket(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.scan_ticket(TEXT) TO anon, authenticated, service_role;
