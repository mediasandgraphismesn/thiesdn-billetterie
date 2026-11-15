-- ============================================================================
-- THIESDN BILLETTERIE — MISSION 3 & 4 : INDEXATION, RLS CACHE, SECURITY DEFINER & RPC SCAN
-- Exécutable de manière idempotente sur PostgreSQL / Supabase
-- ============================================================================

-- 1. INDEXATION DES COLONNES UTILISÉES PAR LES POLITIQUES RLS & REQUÊTES CRITIQUES
CREATE INDEX IF NOT EXISTS idx_tickets_agent_id ON public.tickets (agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON public.tickets (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_profile ON public.tickets (assigned_to_profile_id) WHERE assigned_to_profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_event_id ON public.tickets (event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_order_id ON public.tickets (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_agent_status ON public.tickets (agent_id, status) WHERE agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_event_physical_status ON public.tickets (event_id, is_physical, status);
CREATE INDEX IF NOT EXISTS idx_tickets_qr_upper ON public.tickets (upper(btrim(qr_code)));

CREATE INDEX IF NOT EXISTS idx_sales_agents_user_id ON public.sales_agents (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_agents_event_id ON public.sales_agents (event_id);
CREATE INDEX IF NOT EXISTS idx_sales_agents_promoter_id ON public.sales_agents (promoter_id);
CREATE INDEX IF NOT EXISTS idx_sales_agents_status ON public.sales_agents (status);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_event_id ON public.orders (event_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at_desc ON public.orders (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_promoter_id ON public.events (promoter_id) WHERE promoter_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_status ON public.events (status);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower ON public.profiles (lower(email)) WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_accreditations_event_id ON public.accreditations (event_id);
CREATE INDEX IF NOT EXISTS idx_accreditations_created_by ON public.accreditations (created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accreditations_qr_upper ON public.accreditations (upper(btrim(qr_code)));

CREATE INDEX IF NOT EXISTS idx_scan_stations_event_id ON public.scan_stations (event_id);
CREATE INDEX IF NOT EXISTS idx_scan_stations_created_by ON public.scan_stations (created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scan_stations_code_upper ON public.scan_stations (upper(btrim(access_code)));

CREATE INDEX IF NOT EXISTS idx_event_coproducers_event_id ON public.event_coproducers (event_id);
CREATE INDEX IF NOT EXISTS idx_event_coproducers_user_id ON public.event_coproducers (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_coproducers_promoter_id ON public.event_coproducers (promoter_id) WHERE promoter_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ticket_allocations_agent_id ON public.ticket_allocations (agent_id);
CREATE INDEX IF NOT EXISTS idx_ticket_allocations_event_id ON public.ticket_allocations (event_id);

CREATE INDEX IF NOT EXISTS idx_transactions_promoter_id ON public.transactions (promoter_id) WHERE promoter_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_event_id ON public.transactions (event_id);
CREATE INDEX IF NOT EXISTS idx_transactions_order_id ON public.transactions (order_id) WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON public.user_notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_unread ON public.user_notifications (user_id, read_at) WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_vigile_sessions_event_id ON public.vigile_sessions (event_id);
CREATE INDEX IF NOT EXISTS idx_vigile_sessions_station_code ON public.vigile_sessions (station_code);
CREATE INDEX IF NOT EXISTS idx_event_pre_registrations_event_id ON public.event_pre_registrations (event_id);
CREATE INDEX IF NOT EXISTS idx_event_pre_registrations_user_id ON public.event_pre_registrations (user_id) WHERE user_id IS NOT NULL;

-- 2. FONCTIONS SECURITY DEFINER (CONTOURNEMENT PROPRE DU RLS SUR LES TABLES JOINTES + CACHE)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'super_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_event_owner(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events
    WHERE id = p_event_id
      AND promoter_id = (SELECT auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_sales_agent_member(p_agent_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sales_agents
    WHERE id = p_agent_id
      AND (
        user_id = (SELECT auth.uid())
        OR promoter_id = ((SELECT auth.uid()))::text
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_sales_agent_user(p_agent_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sales_agents
    WHERE id = p_agent_id
      AND user_id = (SELECT auth.uid())
      AND coalesce(status, 'active') = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_push_role_allowed()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'super_admin', 'promoter', 'artist')
  );
$$;

-- 3. RÉÉCRITURE DES POLITIQUES RLS AVEC (SELECT auth.uid()) & (SELECT public.is_admin())

-- 3.1 EVENTS (Suppression des doublons + sous-requêtes cachées)
DROP POLICY IF EXISTS "Events delete promoter or admin" ON public.events;
DROP POLICY IF EXISTS "Events insert" ON public.events;
DROP POLICY IF EXISTS "Events insert promoter or admin" ON public.events;
DROP POLICY IF EXISTS "Events read approved" ON public.events;
DROP POLICY IF EXISTS "Events select" ON public.events;
DROP POLICY IF EXISTS "Events select promoter or admin or public" ON public.events;
DROP POLICY IF EXISTS "Events update" ON public.events;
DROP POLICY IF EXISTS "Events update promoter or admin" ON public.events;

CREATE POLICY "Events select public approved or owner"
  ON public.events FOR SELECT
  USING (status = 'approved' OR promoter_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

CREATE POLICY "Events insert promoter or admin"
  ON public.events FOR INSERT
  WITH CHECK (promoter_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

CREATE POLICY "Events update promoter or admin"
  ON public.events FOR UPDATE
  USING (promoter_id = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  WITH CHECK (promoter_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

CREATE POLICY "Events delete promoter or admin"
  ON public.events FOR DELETE
  USING (promoter_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

-- 3.2 PROFILES
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Coproducers can view partner profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone or owner" ON public.profiles;
DROP POLICY IF EXISTS "Profiles lecture publique" ON public.profiles;
DROP POLICY IF EXISTS "Profiles màj propriétaire" ON public.profiles;
DROP POLICY IF EXISTS "Profiles select" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile or admins can update any" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Profiles select public"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Profiles insert self or admin"
  ON public.profiles FOR INSERT
  WITH CHECK (id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

CREATE POLICY "Profiles update self or admin"
  ON public.profiles FOR UPDATE
  USING (id = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  WITH CHECK (id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

-- 3.3 ORDERS
DROP POLICY IF EXISTS "Orders admin update" ON public.orders;
DROP POLICY IF EXISTS "Orders client insert" ON public.orders;
DROP POLICY IF EXISTS "Orders client read" ON public.orders;
DROP POLICY IF EXISTS "Orders insertion" ON public.orders;
DROP POLICY IF EXISTS "Orders lecture propriétaire ou admin" ON public.orders;
DROP POLICY IF EXISTS "Orders modif admin uniquement" ON public.orders;
DROP POLICY IF EXISTS "Users can insert own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;

CREATE POLICY "Orders select owner or admin"
  ON public.orders FOR SELECT
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

CREATE POLICY "Orders insert client or guest"
  ON public.orders FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()) OR user_id IS NULL OR (SELECT public.is_admin()));

CREATE POLICY "Orders update owner or admin"
  ON public.orders FOR UPDATE
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  WITH CHECK (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

-- 3.4 TICKETS (Index + Security Definer + Cache (SELECT auth.uid()))
DROP POLICY IF EXISTS "Promoters and admins manage tickets" ON public.tickets;
DROP POLICY IF EXISTS "Promoters update event tickets" ON public.tickets;
DROP POLICY IF EXISTS "Sales agents update assigned tickets" ON public.tickets;
DROP POLICY IF EXISTS "Tickets insert owner or admin" ON public.tickets;
DROP POLICY IF EXISTS "Tickets read owner or admin" ON public.tickets;
DROP POLICY IF EXISTS "Tickets select" ON public.tickets;
DROP POLICY IF EXISTS "Tickets update owner or admin" ON public.tickets;

CREATE POLICY "Tickets select authorized"
  ON public.tickets FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    OR assigned_to_profile_id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
    OR (SELECT public.is_event_owner(event_id))
    OR (agent_id IS NOT NULL AND (SELECT public.is_sales_agent_member(agent_id)))
  );

CREATE POLICY "Tickets insert authorized"
  ON public.tickets FOR INSERT
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
    OR (SELECT public.is_event_owner(event_id))
  );

CREATE POLICY "Tickets update promoter or owner or admin"
  ON public.tickets FOR UPDATE
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
    OR (SELECT public.is_event_owner(event_id))
  );

CREATE POLICY "Sales agents update assigned tickets"
  ON public.tickets FOR UPDATE
  USING (
    status IN ('printed_not_sold', 'physical_printed', 'physical_allocated')
    AND (
      agent_id = (SELECT auth.uid())
      OR (agent_id IS NOT NULL AND (SELECT public.is_sales_agent_user(agent_id)))
    )
  )
  WITH CHECK (
    status = 'sold_valid'
    AND length(btrim(COALESCE(holder_name, ''))) > 0
    AND length(btrim(COALESCE(holder_phone, ''))) > 0
  );

CREATE POLICY "Tickets delete promoter or admin"
  ON public.tickets FOR DELETE
  USING ((SELECT public.is_admin()) OR (SELECT public.is_event_owner(event_id)));

-- 3.5 SALES_AGENTS
DROP POLICY IF EXISTS "Promoters and admins manage sales_agents" ON public.sales_agents;
DROP POLICY IF EXISTS "Promoters and admins select sales_agents" ON public.sales_agents;

CREATE POLICY "Sales agents select authorized"
  ON public.sales_agents FOR SELECT
  USING (
    (SELECT public.is_admin())
    OR user_id = (SELECT auth.uid())
    OR promoter_id = ((SELECT auth.uid()))::text
    OR (SELECT public.is_event_owner(event_id))
  );

CREATE POLICY "Sales agents manage authorized"
  ON public.sales_agents FOR ALL
  USING (
    (SELECT public.is_admin())
    OR user_id = (SELECT auth.uid())
    OR promoter_id = ((SELECT auth.uid()))::text
    OR (SELECT public.is_event_owner(event_id))
  )
  WITH CHECK (
    (SELECT public.is_admin())
    OR user_id = (SELECT auth.uid())
    OR promoter_id = ((SELECT auth.uid()))::text
    OR (SELECT public.is_event_owner(event_id))
  );

-- 3.6 TICKET_ALLOCATIONS
DROP POLICY IF EXISTS "Ticket allocations insert promoter or admin" ON public.ticket_allocations;
DROP POLICY IF EXISTS "Ticket allocations read promoter or admin" ON public.ticket_allocations;
DROP POLICY IF EXISTS "Ticket allocations update promoter or admin" ON public.ticket_allocations;

CREATE POLICY "Ticket allocations select authorized"
  ON public.ticket_allocations FOR SELECT
  USING (
    (SELECT public.is_admin())
    OR (SELECT public.is_event_owner(event_id))
    OR (SELECT public.is_sales_agent_member(agent_id))
  );

CREATE POLICY "Ticket allocations insert authorized"
  ON public.ticket_allocations FOR INSERT
  WITH CHECK (
    (SELECT public.is_admin())
    OR (SELECT public.is_event_owner(event_id))
    OR (SELECT public.is_sales_agent_member(agent_id))
  );

CREATE POLICY "Ticket allocations update authorized"
  ON public.ticket_allocations FOR UPDATE
  USING ((SELECT public.is_admin()) OR (SELECT public.is_event_owner(event_id)));

-- 3.7 ACCREDITATIONS
DROP POLICY IF EXISTS "Accreditations delete policy" ON public.accreditations;
DROP POLICY IF EXISTS "Accreditations insert policy" ON public.accreditations;
DROP POLICY IF EXISTS "Accreditations select policy" ON public.accreditations;
DROP POLICY IF EXISTS "Accreditations update policy" ON public.accreditations;

CREATE POLICY "Accreditations select policy"
  ON public.accreditations FOR SELECT
  USING (true);

CREATE POLICY "Accreditations insert policy"
  ON public.accreditations FOR INSERT
  WITH CHECK (
    created_by = (SELECT auth.uid())
    OR (SELECT public.is_admin())
    OR (SELECT auth.uid()) IS NOT NULL
  );

CREATE POLICY "Accreditations update policy"
  ON public.accreditations FOR UPDATE
  USING (
    created_by = (SELECT auth.uid())
    OR (SELECT public.is_event_owner(event_id))
    OR (SELECT public.is_admin())
  );

CREATE POLICY "Accreditations delete policy"
  ON public.accreditations FOR DELETE
  USING (
    created_by = (SELECT auth.uid())
    OR (SELECT public.is_event_owner(event_id))
    OR (SELECT public.is_admin())
  );

-- 3.8 SCAN_STATIONS
DROP POLICY IF EXISTS "Gestion des postes par promoteur ou admin" ON public.scan_stations;
DROP POLICY IF EXISTS "Lecture des postes par access_code" ON public.scan_stations;
DROP POLICY IF EXISTS "Scan stations manage policy" ON public.scan_stations;
DROP POLICY IF EXISTS "Scan stations select policy" ON public.scan_stations;

CREATE POLICY "Scan stations select policy"
  ON public.scan_stations FOR SELECT
  USING (true);

CREATE POLICY "Scan stations manage policy"
  ON public.scan_stations FOR ALL
  USING (
    created_by = (SELECT auth.uid())
    OR (SELECT public.is_event_owner(event_id))
    OR (SELECT public.is_admin())
  )
  WITH CHECK (
    created_by = (SELECT auth.uid())
    OR (SELECT public.is_event_owner(event_id))
    OR (SELECT public.is_admin())
  );

-- 3.9 EVENT_COPRODUCERS, TRANSACTIONS, USER_NOTIFICATIONS, PUSH_SUBSCRIPTIONS, TABLES ANNEXES
DROP POLICY IF EXISTS "Coproducers manage policy" ON public.event_coproducers;
DROP POLICY IF EXISTS "Coproducers read policy" ON public.event_coproducers;

CREATE POLICY "Coproducers read policy"
  ON public.event_coproducers FOR SELECT
  USING (user_id = (SELECT auth.uid()) OR promoter_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

CREATE POLICY "Coproducers manage policy"
  ON public.event_coproducers FOR ALL
  USING (promoter_id = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  WITH CHECK (promoter_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "Transactions read promoter or admin" ON public.transactions;
CREATE POLICY "Transactions read promoter or admin"
  ON public.transactions FOR SELECT
  USING (promoter_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "Users read own notifications" ON public.user_notifications;
DROP POLICY IF EXISTS "Users update own notifications" ON public.user_notifications;
CREATE POLICY "Users read own notifications"
  ON public.user_notifications FOR SELECT
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users update own notifications"
  ON public.user_notifications FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users manage own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users manage own push subscriptions"
  ON public.push_subscriptions FOR ALL
  USING ((SELECT auth.uid()) = user_id AND (SELECT public.is_push_role_allowed()))
  WITH CHECK ((SELECT auth.uid()) = user_id AND (SELECT public.is_push_role_allowed()));

DROP POLICY IF EXISTS "Settings lecture publique" ON public.platform_settings;
DROP POLICY IF EXISTS "Settings modif admin" ON public.platform_settings;
DROP POLICY IF EXISTS "Settings read public" ON public.platform_settings;
DROP POLICY IF EXISTS "Settings update admin only" ON public.platform_settings;
CREATE POLICY "Settings read public" ON public.platform_settings FOR SELECT USING (true);
CREATE POLICY "Settings update admin only" ON public.platform_settings FOR ALL
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "Admins can read email_logs" ON public.email_logs;
CREATE POLICY "Admins can read email_logs" ON public.email_logs FOR SELECT
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "Admins consultent l'historique des connexions" ON public.login_history;
CREATE POLICY "Admins consultent l'historique des connexions" ON public.login_history FOR SELECT
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "Lecture des pre-inscriptions par promoteurs et admins" ON public.event_pre_registrations;
CREATE POLICY "Lecture des pre-inscriptions par promoteurs et admins" ON public.event_pre_registrations FOR SELECT
  USING (
    (SELECT public.is_event_owner(event_id))
    OR (((SELECT auth.jwt()) ->> 'role') = 'service_role')
    OR (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS "Admins gèrent les sessions vigiles" ON public.vigile_sessions;
CREATE POLICY "Admins gèrent les sessions vigiles" ON public.vigile_sessions FOR ALL
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

-- 4. MISSION 4 : VALIDATION SERVEUR RENFORCÉE DES SCANS & VENTES POS

CREATE OR REPLACE FUNCTION public.verify_pos_ticket_for_sale(
  p_agent_id uuid,
  p_ticket_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_agent public.sales_agents%ROWTYPE;
  v_ticket public.tickets%ROWTYPE;
  v_clean_code text;
BEGIN
  v_clean_code := upper(btrim(coalesce(p_ticket_code, '')));
  IF v_clean_code = '' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'empty_code', 'message', 'Code billet vide.');
  END IF;

  SELECT * INTO v_agent FROM public.sales_agents WHERE id = p_agent_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'agent_not_found', 'message', 'Point de vente introuvable.');
  END IF;

  IF NOT (
    public.is_admin()
    OR v_agent.user_id = (SELECT auth.uid())
    OR v_agent.promoter_id = ((SELECT auth.uid()))::text
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'forbidden', 'message', 'Accès non autorisé à ce point de vente.');
  END IF;

  IF coalesce(v_agent.status, 'active') <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'agent_suspended', 'message', 'Ce point de vente est actuellement suspendu.');
  END IF;

  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE upper(btrim(qr_code)) = v_clean_code
     OR id::text = btrim(p_ticket_code)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_found', 'message', 'Billet introuvable sur le serveur.');
  END IF;

  IF v_ticket.agent_id IS DISTINCT FROM p_agent_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'wrong_agent', 'message', 'Ce billet n''appartient pas à votre caisse.');
  END IF;

  IF v_ticket.status IN ('sold_valid', 'physical_sold', 'valid') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_sold', 'message', 'Ce billet a déjà été vendu.');
  END IF;

  IF v_ticket.status IN ('scanned', 'used') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_scanned', 'message', 'Ce billet a déjà été scanné à l''entrée.');
  END IF;

  IF v_ticket.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'cancelled', 'message', 'Ce billet a été annulé par l''organisation.');
  END IF;

  IF v_ticket.status NOT IN ('printed_not_sold', 'physical_printed', 'physical_allocated') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_status', 'message', 'Statut de billet incompatible avec une vente guichet.');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'reason', 'ready_for_sale',
    'message', 'Billet authentifié côté serveur et prêt pour la vente.',
    'ticket', jsonb_build_object(
      'id', v_ticket.id,
      'qr_code', v_ticket.qr_code,
      'event_id', v_ticket.event_id,
      'event_title', v_ticket.event_title,
      'tier_name', v_ticket.tier_name,
      'price', v_ticket.price,
      'status', v_ticket.status,
      'agent_id', v_ticket.agent_id,
      'serial_number', v_ticket.serial_number
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_physical_ticket_sale(
  p_agent_id uuid,
  p_ticket_code text,
  p_holder_name text,
  p_holder_phone text,
  p_holder_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_agent public.sales_agents%ROWTYPE;
  v_ticket public.tickets%ROWTYPE;
  v_clean_code text;
BEGIN
  IF length(btrim(coalesce(p_holder_name, ''))) = 0 OR length(btrim(coalesce(p_holder_phone, ''))) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Le nom et le téléphone du client sont obligatoires pour activer le billet.');
  END IF;

  SELECT * INTO v_agent FROM public.sales_agents WHERE id = p_agent_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Point de vente introuvable.');
  END IF;

  IF NOT (
    public.is_admin()
    OR v_agent.user_id = (SELECT auth.uid())
    OR v_agent.promoter_id = ((SELECT auth.uid()))::text
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Action non autorisée pour ce point de vente.');
  END IF;

  IF coalesce(v_agent.status, 'active') <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ce point de vente est suspendu.');
  END IF;

  v_clean_code := upper(btrim(coalesce(p_ticket_code, '')));

  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE upper(btrim(qr_code)) = v_clean_code
     OR id::text = btrim(p_ticket_code)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Billet introuvable.');
  END IF;

  IF v_ticket.agent_id IS NOT NULL AND v_ticket.agent_id <> p_agent_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ce billet est alloué à un autre point de vente.');
  END IF;

  IF v_ticket.status IN ('sold_valid', 'physical_sold', 'valid') THEN
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
      holder_name = btrim(p_holder_name),
      holder_phone = btrim(p_holder_phone),
      holder_email = nullif(btrim(coalesce(p_holder_email, '')), '')
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

CREATE OR REPLACE FUNCTION public.scan_ticket(p_qr_code text, p_station_code text, p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_station public.scan_stations%ROWTYPE;
  v_ticket public.tickets%ROWTYPE;
  v_agent_status text;
  v_expected_event_id uuid;
  v_clean_code text;
  v_clean_station text;
  v_previous_scan_time text;
BEGIN
  v_clean_code := upper(btrim(p_qr_code));
  v_clean_station := upper(btrim(p_station_code));

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
  WHERE upper(btrim(access_code)) = v_clean_station
    AND is_active = true;

  IF NOT FOUND THEN
    IF NOT (public.is_admin() OR v_clean_station IN ('ADMIN-CHECKIN', 'STA-ADMIN-MASTER')) THEN
      RETURN jsonb_build_object(
        'success', false,
        'reason', 'invalid_station',
        'message', 'POSTE DE CONTRÔLE INVALIDE OU DÉSACTIVÉ'
      );
    END IF;
  ELSE
    IF v_station.event_id IS NOT NULL AND p_event_id IS NOT NULL AND v_station.event_id::text <> p_event_id::text THEN
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
  WHERE upper(btrim(qr_code)) = v_clean_code OR id::text = btrim(p_qr_code)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'not_found',
      'message', 'BILLET INTROUVABLE OU FAUX'
    );
  END IF;

  -- ÉTAPE C : Contrôle strict d'appartenance à l'événement (paramètre ou poste assigné)
  v_expected_event_id := COALESCE(p_event_id, v_station.event_id);
  IF v_expected_event_id IS NOT NULL AND (v_ticket.event_id IS NULL OR v_ticket.event_id::text <> v_expected_event_id::text) THEN
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

  -- ÉTAPE C2 : Vérification de l'état de l'agent revendeur si billet physique rattaché
  IF v_ticket.agent_id IS NOT NULL THEN
    SELECT status INTO v_agent_status FROM public.sales_agents WHERE id = v_ticket.agent_id;
    IF v_agent_status IS NOT NULL AND v_agent_status IN ('suspended', 'blocked', 'revoked') THEN
      RETURN jsonb_build_object(
        'success', false,
        'reason', 'agent_suspended',
        'message', 'BILLET ISSU D''UN POINT DE VENTE SUSPENDU',
        'ticket', jsonb_build_object(
          'id', v_ticket.id,
          'holder_name', coalesce(nullif(btrim(v_ticket.holder_name), ''), 'Nom non renseigné'),
          'holder_phone', coalesce(nullif(btrim(v_ticket.holder_phone), ''), 'Téléphone non renseigné'),
          'qr_code', v_ticket.qr_code,
          'event_title', v_ticket.event_title,
          'tier_name', v_ticket.tier_name,
          'status', v_ticket.status,
          'is_physical', coalesce(v_ticket.is_physical, false)
        )
      );
    END IF;
  END IF;

  -- ÉTAPE D : Billet physique non vendu (ACCÈS REFUSÉ)
  IF v_ticket.status IN ('printed_not_sold', 'physical_printed', 'physical_allocated') THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'printed_not_sold',
      'message', 'BILLET NON DÉCLARÉ VENDU (ACTIVATION GUICHET REQUISE)',
      'ticket', jsonb_build_object(
        'id', v_ticket.id,
        'holder_name', coalesce(nullif(btrim(v_ticket.holder_name), ''), 'Nom non renseigné'),
        'holder_phone', coalesce(nullif(btrim(v_ticket.holder_phone), ''), 'Téléphone non renseigné'),
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
        'holder_name', coalesce(nullif(btrim(v_ticket.holder_name), ''), 'Nom non renseigné'),
        'holder_phone', coalesce(nullif(btrim(v_ticket.holder_phone), ''), 'Téléphone non renseigné'),
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
        'holder_name', coalesce(nullif(btrim(v_ticket.holder_name), ''), 'Nom non renseigné'),
        'holder_phone', coalesce(nullif(btrim(v_ticket.holder_phone), ''), 'Téléphone non renseigné'),
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
  SET status = 'scanned',
      used_at = timezone('utc'::text, now()),
      validated_by = (SELECT auth.uid()),
      validated_station_id = v_clean_station,
      validated_station_name = coalesce(v_station.name, v_clean_station)
  WHERE id = v_ticket.id;

  IF v_station.id IS NOT NULL THEN
    UPDATE public.scan_stations
    SET scans_count = coalesce(scans_count, 0) + 1,
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
      'holder_name', coalesce(nullif(btrim(v_ticket.holder_name), ''), 'Nom non renseigné'),
      'holder_phone', coalesce(nullif(btrim(v_ticket.holder_phone), ''), 'Téléphone non renseigné'),
      'qr_code', v_ticket.qr_code,
      'event_title', v_ticket.event_title,
      'tier_name', v_ticket.tier_name,
      'status', 'scanned',
      'is_physical', coalesce(v_ticket.is_physical, false)
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.scan_ticket(p_qr_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ticket public.tickets%ROWTYPE;
  v_agent_status text;
BEGIN
  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE upper(btrim(qr_code)) = upper(btrim(p_qr_code))
     OR id::text = btrim(p_qr_code)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Billet introuvable ou faux');
  END IF;

  IF v_ticket.agent_id IS NOT NULL THEN
    SELECT status INTO v_agent_status FROM public.sales_agents WHERE id = v_ticket.agent_id;
    IF v_agent_status IS NOT NULL AND v_agent_status IN ('suspended', 'blocked', 'revoked') THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', 'Billet issu d''un point de vente suspendu.',
        'ticket', row_to_json(v_ticket)
      );
    END IF;
  END IF;

  IF v_ticket.status IN ('printed_not_sold', 'physical_printed', 'physical_allocated') THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Ce billet n''a pas été déclaré comme vendu. Contactez le promoteur.',
      'ticket', row_to_json(v_ticket)
    );
  END IF;

  IF v_ticket.status IN ('scanned', 'used') THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Billet déjà utilisé. Double entrée interdite.',
      'ticket', row_to_json(v_ticket)
    );
  END IF;

  IF v_ticket.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Ce billet a été désactivé ou annulé par l''organisation.',
      'ticket', row_to_json(v_ticket)
    );
  END IF;

  UPDATE public.tickets
  SET status = 'scanned',
      used_at = now(),
      validated_by = (SELECT auth.uid())
  WHERE id = v_ticket.id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Accès Autorisé : ' || v_ticket.tier_name,
    'ticket', jsonb_build_object(
      'id', v_ticket.id,
      'holder_name', coalesce(nullif(btrim(v_ticket.holder_name), ''), 'Nom non renseigné'),
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

GRANT EXECUTE ON FUNCTION public.verify_pos_ticket_for_sale(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_physical_ticket_sale(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.scan_ticket(text, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scan_ticket(text) TO authenticated;
