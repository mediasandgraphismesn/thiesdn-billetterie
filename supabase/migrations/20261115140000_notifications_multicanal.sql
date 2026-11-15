-- ============================================================================
-- MIGRATION : Système de Notifications Multi-Canal Temps Réel & Web Push
-- Projet : Thièsdn Billetterie (Production)
-- Date : 2026-11-15
-- Exécution : Copier-coller et exécuter dans Supabase > SQL Editor
-- ============================================================================

-- ============================================================================
-- 0. EXTENSION pg_net (requise pour appeler l'Edge Function depuis PostgreSQL)
-- ============================================================================
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- ============================================================================
-- 1. TABLE public.notifications (Mission 1)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'info', 'warning')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  action_url TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  dedupe_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_user_dedupe
  ON public.notifications (user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

-- ============================================================================
-- 2. POLITIQUES RLS HERMÉTIQUES SUR public.notifications
-- Chaque utilisateur ne voit et ne modifie QUE ses propres notifications.
-- ============================================================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users select own notifications" ON public.notifications;
CREATE POLICY "Users select own notifications"
  ON public.notifications
  FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications"
  ON public.notifications
  FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users delete own notifications" ON public.notifications;
CREATE POLICY "Users delete own notifications"
  ON public.notifications
  FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- Aucun INSERT client direct : création strictement via triggers SECURITY DEFINER ou service_role.

-- ============================================================================
-- 3. ACTIVATION SUPABASE REALTIME SUR public.notifications
-- ============================================================================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

-- ============================================================================
-- 4. TABLE public.push_subscriptions : RLS élargie (POS + Clients Opt-In + Admin/Promoteur)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON public.push_subscriptions(endpoint);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Autoriser tous les utilisateurs authentifiés (admin, promoter, artist, sales_agent, user)
-- à gérer UNIQUEMENT leurs propres abonnements push.
CREATE OR REPLACE FUNCTION public.is_push_role_allowed()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL;
$$;

DROP POLICY IF EXISTS "Admins manage own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users manage own push subscriptions" ON public.push_subscriptions;

CREATE POLICY "Users manage own push subscriptions"
  ON public.push_subscriptions
  FOR ALL
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- RPC atomique pour enregistrer ou réassocier un appareil sans collision RLS sur endpoint UNIQUE
-- (utile si un utilisateur passe d'un compte Admin à un compte POS sur le même téléphone)
CREATE OR REPLACE FUNCTION public.register_push_subscription(
  p_endpoint TEXT,
  p_p256dh TEXT,
  p_auth TEXT,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_sub_id UUID;
BEGIN
  v_uid := (SELECT auth.uid());
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Authentification requise.');
  END IF;

  IF length(btrim(coalesce(p_endpoint, ''))) = 0
     OR length(btrim(coalesce(p_p256dh, ''))) = 0
     OR length(btrim(coalesce(p_auth, ''))) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Données d''abonnement push incomplètes.');
  END IF;

  INSERT INTO public.push_subscriptions (
    user_id, endpoint, p256dh, auth, user_agent, last_seen_at
  ) VALUES (
    v_uid,
    btrim(p_endpoint),
    btrim(p_p256dh),
    btrim(p_auth),
    left(coalesce(p_user_agent, ''), 255),
    timezone('utc'::text, now())
  )
  ON CONFLICT (endpoint) DO UPDATE SET
    user_id = v_uid,
    p256dh = EXCLUDED.p256dh,
    auth = EXCLUDED.auth,
    user_agent = EXCLUDED.user_agent,
    last_seen_at = timezone('utc'::text, now())
  RETURNING id INTO v_sub_id;

  RETURN jsonb_build_object('success', true, 'id', v_sub_id, 'user_id', v_uid);
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_push_subscription(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- 5. HELPER pg_net : Appel sécurisé vers l'Edge Function send-push-notification
-- Lit le secret 'push_webhook_secret' dans Supabase Vault (zéro secret en clair dans le SQL).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.dispatch_web_push(
  p_user_ids UUID[],
  p_title TEXT,
  p_body TEXT,
  p_action_url TEXT DEFAULT '/',
  p_type TEXT DEFAULT 'info',
  p_tag TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_project_url TEXT;
  v_webhook_secret TEXT;
  v_clean_ids UUID[];
BEGIN
  IF p_user_ids IS NULL OR array_length(p_user_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  SELECT array_agg(DISTINCT u) INTO v_clean_ids
  FROM unnest(p_user_ids) AS u
  WHERE u IS NOT NULL;

  IF v_clean_ids IS NULL OR array_length(v_clean_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Lecture sécurisée depuis Supabase Vault (vault.decrypted_secrets)
  BEGIN
    SELECT decrypted_secret INTO v_project_url
    FROM vault.decrypted_secrets
    WHERE name = 'supabase_url'
    LIMIT 1;

    SELECT decrypted_secret INTO v_webhook_secret
    FROM vault.decrypted_secrets
    WHERE name IN ('push_webhook_secret', 'WEBHOOK_SECRET')
    ORDER BY CASE WHEN name = 'push_webhook_secret' THEN 0 ELSE 1 END
    LIMIT 1;
  EXCEPTION
    WHEN OTHERS THEN
      v_project_url := NULL;
      v_webhook_secret := NULL;
  END;

  v_project_url := COALESCE(NULLIF(btrim(v_project_url), ''), 'https://jgvuzlchemqcfygsylln.supabase.co');

  IF v_webhook_secret IS NULL OR length(btrim(v_webhook_secret)) = 0 THEN
    RAISE WARNING 'dispatch_web_push: secret Vault "push_webhook_secret" non configuré — push ignoré (notification In-App créée).';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := v_project_url || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', v_webhook_secret
    ),
    body := jsonb_build_object(
      'user_ids', to_jsonb(v_clean_ids),
      'title', p_title,
      'body', p_body,
      'action_url', COALESCE(p_action_url, '/'),
      'url', COALESCE(p_action_url, '/'),
      'type', COALESCE(p_type, 'info'),
      'tag', COALESCE(p_tag, 'thiesdn-' || extract(epoch from now())::bigint::text)
    )
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Ne jamais faire échouer une transaction métier (vente / commande) si le push échoue
    RAISE WARNING 'dispatch_web_push non bloquant: %', SQLERRM;
END;
$$;

-- ============================================================================
-- 6. TRIGGER 1 : SUR public.tickets (À chaque billet vendu en ligne ou au POS)
-- Ignore strictement les billets physiques non vendus (printed_not_sold).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notify_on_ticket_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_sold_now BOOLEAN := false;
  v_event_title TEXT;
  v_promoter_id UUID;
  v_order RECORD;
  v_has_order BOOLEAN := false;
  v_qty INTEGER := 1;
  v_amount NUMERIC := 0;
  v_tier TEXT;
  v_canal TEXT;
  v_dedupe_base TEXT;
  v_admin_title TEXT;
  v_admin_body TEXT;
  v_client_id UUID;
  v_client_title TEXT;
  v_client_body TEXT;
  v_inserted_id UUID;
  v_admin_rec RECORD;
  v_admin_push_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  -- Vérifier s'il s'agit réellement d'une vente (et NON d'une création de stock imprimé inactif)
  IF TG_OP = 'INSERT' THEN
    v_is_sold_now := NEW.status IN ('valid', 'sold_valid', 'physical_sold');
  ELSIF TG_OP = 'UPDATE' THEN
    v_is_sold_now :=
      OLD.status IN ('printed_not_sold', 'physical_printed', 'physical_allocated')
      AND NEW.status IN ('sold_valid', 'physical_sold', 'valid');
  END IF;

  IF NOT v_is_sold_now THEN
    RETURN NEW;
  END IF;

  -- Récupérer l'événement et son promoteur
  SELECT title, promoter_id
  INTO v_event_title, v_promoter_id
  FROM public.events
  WHERE id = NEW.event_id;

  v_event_title := COALESCE(
    NULLIF(btrim(v_event_title), ''),
    NULLIF(btrim(NEW.event_title), ''),
    'Événement Thièsdn'
  );

  -- Récupérer les informations de la commande associée si billet en ligne
  IF NEW.order_id IS NOT NULL THEN
    SELECT id, reference, quantity, total_amount, user_id, tier_name
    INTO v_order
    FROM public.orders
    WHERE id = NEW.order_id;
    v_has_order := FOUND;
  END IF;

  v_qty := CASE WHEN v_has_order THEN GREATEST(COALESCE(v_order.quantity, 1), 1) ELSE 1 END;
  v_amount := CASE
    WHEN v_has_order AND COALESCE(v_order.total_amount, 0) > 0 THEN v_order.total_amount
    ELSE COALESCE(NEW.price, 0)
  END;
  v_tier := COALESCE(
    NULLIF(btrim(NEW.tier_name), ''),
    CASE WHEN v_has_order THEN NULLIF(btrim(v_order.tier_name), '') ELSE NULL END,
    'Standard'
  );
  v_canal := CASE WHEN COALESCE(NEW.is_physical, false) THEN 'Guichet POS' ELSE 'En ligne' END;
  v_dedupe_base := CASE
    WHEN NEW.order_id IS NOT NULL THEN 'ticket-order-' || NEW.order_id::text
    ELSE 'ticket-sale-' || NEW.id::text
  END;

  v_admin_title := '🎟️ Nouveau billet vendu !';
  v_admin_body := v_qty || '× ' || v_tier || ' — ' || v_event_title
    || ' (' || trim(to_char(v_amount, 'FM999G999G990')) || ' FCFA • ' || v_canal || ')';

  -- A. Notification + Web Push au PROMOTEUR propriétaire (si profil existant)
  IF v_promoter_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE id = v_promoter_id) THEN
    v_inserted_id := NULL;
    INSERT INTO public.notifications (user_id, type, title, body, action_url, dedupe_key)
    VALUES (
      v_promoter_id,
      'purchase',
      v_admin_title,
      v_admin_body,
      '/?tab=finances',
      v_dedupe_base || '-promoter'
    )
    ON CONFLICT (user_id, dedupe_key) DO NOTHING
    RETURNING id INTO v_inserted_id;

    IF v_inserted_id IS NOT NULL THEN
      PERFORM public.dispatch_web_push(
        ARRAY[v_promoter_id],
        v_admin_title,
        v_admin_body,
        '/?tab=finances',
        'purchase',
        v_dedupe_base || '-promoter'
      );
    END IF;
  END IF;

  -- B. Notification + Web Push aux ADMINS (en excluant v_promoter_id déjà notifié)
  FOR v_admin_rec IN
    SELECT id FROM public.profiles
    WHERE role IN ('admin', 'super_admin')
      AND (v_promoter_id IS NULL OR id <> v_promoter_id)
  LOOP
    v_inserted_id := NULL;
    INSERT INTO public.notifications (user_id, type, title, body, action_url, dedupe_key)
    VALUES (
      v_admin_rec.id,
      'purchase',
      v_admin_title,
      v_admin_body,
      '/?tab=finances',
      v_dedupe_base || '-admin'
    )
    ON CONFLICT (user_id, dedupe_key) DO NOTHING
    RETURNING id INTO v_inserted_id;

    IF v_inserted_id IS NOT NULL THEN
      v_admin_push_ids := array_append(v_admin_push_ids, v_admin_rec.id);
    END IF;
  END LOOP;

  IF array_length(v_admin_push_ids, 1) > 0 THEN
    PERFORM public.dispatch_web_push(
      v_admin_push_ids,
      v_admin_title,
      v_admin_body,
      '/?tab=finances',
      'purchase',
      v_dedupe_base || '-admin'
    );
  END IF;

  -- C. Confirmation au CLIENT (si profil connecté / invité associé existe dans profiles)
  v_client_id := COALESCE(NEW.user_id, CASE WHEN v_has_order THEN v_order.user_id ELSE NULL END);
  IF v_client_id IS NOT NULL
     AND v_client_id IS DISTINCT FROM v_promoter_id
     AND EXISTS (SELECT 1 FROM public.profiles WHERE id = v_client_id) THEN
    v_inserted_id := NULL;
    v_client_title := '🎉 Billet confirmé !';
    v_client_body := 'Votre billet ' || v_tier || ' (' || v_qty || ' place'
      || CASE WHEN v_qty > 1 THEN 's' ELSE '' END
      || ') pour "' || v_event_title || '" est prêt dans Mes Billets.';

    INSERT INTO public.notifications (user_id, type, title, body, action_url, dedupe_key)
    VALUES (
      v_client_id,
      'purchase',
      v_client_title,
      v_client_body,
      '/?tab=tickets',
      v_dedupe_base || '-client'
    )
    ON CONFLICT (user_id, dedupe_key) DO NOTHING
    RETURNING id INTO v_inserted_id;

    IF v_inserted_id IS NOT NULL THEN
      PERFORM public.dispatch_web_push(
        ARRAY[v_client_id],
        v_client_title,
        v_client_body,
        '/?tab=tickets',
        'purchase',
        v_dedupe_base || '-client'
      );
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'notify_on_ticket_sale non bloquant: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_ticket_sale ON public.tickets;
CREATE TRIGGER trg_notify_on_ticket_sale
  AFTER INSERT OR UPDATE OF status ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_ticket_sale();

-- ============================================================================
-- 7. TRIGGER 2 : SUR public.orders (Alerte immédiate dès paiement signalé Wave/OM)
-- Réveille l'Admin (validation) et informe le Promoteur avant même l'émission du billet.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notify_on_order_payment_signaled()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_signaled BOOLEAN := false;
  v_event_title TEXT;
  v_promoter_id UUID;
  v_qty INTEGER;
  v_amount NUMERIC;
  v_tier TEXT;
  v_ref TEXT;
  v_dedupe_base TEXT;
  v_admin_title TEXT;
  v_admin_body TEXT;
  v_promo_title TEXT;
  v_promo_body TEXT;
  v_inserted_id UUID;
  v_admin_rec RECORD;
  v_admin_push_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_is_signaled := (NEW.status = 'payment_signaled');
  ELSIF TG_OP = 'UPDATE' THEN
    v_is_signaled := (NEW.status = 'payment_signaled' AND OLD.status IS DISTINCT FROM 'payment_signaled');
  END IF;

  IF NOT v_is_signaled THEN
    RETURN NEW;
  END IF;

  SELECT title, promoter_id
  INTO v_event_title, v_promoter_id
  FROM public.events
  WHERE id = NEW.event_id;

  v_event_title := COALESCE(
    NULLIF(btrim(v_event_title), ''),
    NULLIF(btrim(NEW.event_title), ''),
    'Événement Thièsdn'
  );
  v_qty := GREATEST(COALESCE(NEW.quantity, 1), 1);
  v_amount := COALESCE(NEW.total_amount, 0);
  v_tier := COALESCE(NULLIF(btrim(NEW.tier_name), ''), 'Standard');
  v_ref := COALESCE(NULLIF(btrim(NEW.reference), ''), left(NEW.id::text, 8));
  v_dedupe_base := 'order-signaled-' || NEW.id::text;

  -- A. Alerte urgente pour chaque ADMIN (à valider dans ?tab=orders)
  v_admin_title := '💰 Paiement Wave/OM à valider !';
  v_admin_body := COALESCE(NEW.customer_name, 'Client') || ' — '
    || trim(to_char(v_amount, 'FM999G999G990')) || ' FCFA — '
    || v_event_title || ' (' || v_tier || ' ×' || v_qty || ') • Réf ' || v_ref;

  FOR v_admin_rec IN
    SELECT id FROM public.profiles WHERE role IN ('admin', 'super_admin')
  LOOP
    v_inserted_id := NULL;
    INSERT INTO public.notifications (user_id, type, title, body, action_url, dedupe_key)
    VALUES (
      v_admin_rec.id,
      'warning',
      v_admin_title,
      v_admin_body,
      '/?tab=orders',
      v_dedupe_base || '-admin'
    )
    ON CONFLICT (user_id, dedupe_key) DO NOTHING
    RETURNING id INTO v_inserted_id;

    IF v_inserted_id IS NOT NULL THEN
      v_admin_push_ids := array_append(v_admin_push_ids, v_admin_rec.id);
    END IF;
  END LOOP;

  IF array_length(v_admin_push_ids, 1) > 0 THEN
    PERFORM public.dispatch_web_push(
      v_admin_push_ids,
      v_admin_title,
      v_admin_body,
      '/?tab=orders',
      'warning',
      v_dedupe_base || '-admin'
    );
  END IF;

  -- B. Information temps réel pour le PROMOTEUR (sans nom ni téléphone client)
  IF v_promoter_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.profiles WHERE id = v_promoter_id AND role NOT IN ('admin', 'super_admin')) THEN
    v_inserted_id := NULL;
    v_promo_title := '🔔 Nouvel achat signalé (Wave/OM)';
    v_promo_body := v_qty || '× ' || v_tier || ' — ' || v_event_title
      || ' (' || trim(to_char(v_amount, 'FM999G999G990')) || ' FCFA) en attente de validation admin.';

    INSERT INTO public.notifications (user_id, type, title, body, action_url, dedupe_key)
    VALUES (
      v_promoter_id,
      'info',
      v_promo_title,
      v_promo_body,
      '/?tab=finances',
      v_dedupe_base || '-promoter'
    )
    ON CONFLICT (user_id, dedupe_key) DO NOTHING
    RETURNING id INTO v_inserted_id;

    IF v_inserted_id IS NOT NULL THEN
      PERFORM public.dispatch_web_push(
        ARRAY[v_promoter_id],
        v_promo_title,
        v_promo_body,
        '/?tab=finances',
        'info',
        v_dedupe_base || '-promoter'
      );
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'notify_on_order_payment_signaled non bloquant: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_order_payment_signaled ON public.orders;
CREATE TRIGGER trg_notify_on_order_payment_signaled
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_order_payment_signaled();

-- ============================================================================
-- 8. VÉRIFICATIONS POST-MIGRATION (Doit renvoyer true / 2 triggers)
-- ============================================================================
SELECT
  to_regclass('public.notifications') IS NOT NULL AS notifications_table_ok,
  EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) AS realtime_enabled_ok;
