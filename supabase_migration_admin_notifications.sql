-- ============================================================================
-- MIGRATION : Système de Notifications Push & Alertes Paiement Administrateur
-- Projet : Thièsdn Billetterie
-- Date : 2026-11-03
-- REMARQUE : Ne pas appliquer automatiquement - À exécuter dans le SQL Editor Supabase après relecture
-- ============================================================================

-- 1. Table push_subscriptions pour le stockage des abonnements Web Push VAPID
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

-- Index pour optimiser les requêtes par utilisateur
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON public.push_subscriptions(endpoint);

-- 2. Activation de Row Level Security (RLS) sur push_subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Politiques RLS : Un admin lit, insère et supprime SEULEMENT ses propres abonnements.
-- Aucune lecture par anon ou utilisateurs standards (user, promoter, sales_agent).
-- L'Edge Function utilise le service_role (qui contourne la RLS).
DROP POLICY IF EXISTS "Admins manage own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Admins manage own push subscriptions"
ON public.push_subscriptions
FOR ALL
USING (
  auth.uid() = user_id 
  AND public.is_admin()
)
WITH CHECK (
  auth.uid() = user_id 
  AND public.is_admin()
);

-- 3. Colonne admin_notified_at sur la table orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS admin_notified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_admin_notified_at 
ON public.orders(admin_notified_at) 
WHERE admin_notified_at IS NULL;

-- 4. Fonction de protection de la colonne admin_notified_at
-- Rejouable, SET search_path = public, ne bloque pas status/guest_token/email_sent_at
CREATE OR REPLACE FUNCTION public.protect_sensitive_orders_columns()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  -- Seuls les admins ou le service_role peuvent modifier admin_notified_at
  IF NOT (public.is_admin() OR auth.role() = 'service_role') THEN
    IF NEW.admin_notified_at IS DISTINCT FROM OLD.admin_notified_at THEN
      RAISE EXCEPTION 'Modification non autorisée de la colonne admin_notified_at';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_orders_admin_notified_at ON public.orders;
CREATE TRIGGER trg_protect_orders_admin_notified_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.protect_sensitive_orders_columns();

-- 5. Publication Supabase Realtime (Ajout idempotent de la table public.orders)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION 
  WHEN duplicate_object THEN 
    NULL;
END $$;

-- ============================================================================
-- 6. OPTIONNEL (À VALIDER) : Rappel automatique pg_cron pour paiements en attente (> 10 min)
-- Nécessite l'extension pg_cron activée dans votre projet Supabase.
-- Décommentez le bloc ci-dessous si vous souhaitez activer un rappel automatique.
-- ============================================================================
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule(
--   'alert-stale-payment-signaled',
--   '*/10 * * * *',
--   $$
--     -- Réinitialise admin_notified_at à NULL si la commande est restée en payment_signaled depuis plus de 10 min
--     UPDATE public.orders
--     SET admin_notified_at = NULL
--     WHERE status = 'payment_signaled'
--       AND admin_notified_at IS NOT NULL
--       AND updated_at < now() - interval '10 minutes';
--   $$
-- );
