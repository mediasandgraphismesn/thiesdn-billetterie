-- ============================================================================
-- MIGRATION : Système de Notifications Multi-Canal Promoteurs & Artistes
-- Projet : Thièsdn Billetterie
-- Date : 2026-11-03
-- REMARQUE : Ne pas appliquer automatiquement - À relire et exécuter dans le SQL Editor Supabase
-- ============================================================================

-- 1. Table user_notifications (Historique & Cloche In-App)
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, -- 'event_status', 'sales', 'stock', 'payout', 'decompte'
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  url TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  dedupe_key TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT user_notifications_user_dedupe_key UNIQUE (user_id, dedupe_key)
);

-- Index pour accélérer la lecture des notifications non lues et récentes
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_read 
ON public.user_notifications(user_id, read_at);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_created 
ON public.user_notifications(user_id, created_at DESC);

-- 2. Activation de Row Level Security (RLS) sur user_notifications
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- Politique SELECT : L'utilisateur ne lit QUE ses propres notifications
DROP POLICY IF EXISTS "Users read own notifications" ON public.user_notifications;
CREATE POLICY "Users read own notifications"
ON public.user_notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Politique UPDATE : L'utilisateur met à jour (ex: marquer read_at) QUE ses propres notifications
DROP POLICY IF EXISTS "Users update own notifications" ON public.user_notifications;
CREATE POLICY "Users update own notifications"
ON public.user_notifications
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Aucun INSERT permis depuis le client : réservé au rôle service_role (Edge Functions / Triggers)

-- 3. Colonne notification_prefs sur la table profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS notification_prefs JSONB DEFAULT '{
  "event_status": {"push": true, "email": true},
  "sales": {"push": true, "email": false},
  "stock": {"push": true, "email": false},
  "payout": {"push": true, "email": true},
  "decompte": {"push": true, "email": true}
}'::jsonb;

-- Mettre à jour les profils existants qui n'ont pas encore de notification_prefs
UPDATE public.profiles
SET notification_prefs = '{
  "event_status": {"push": true, "email": true},
  "sales": {"push": true, "email": false},
  "stock": {"push": true, "email": false},
  "payout": {"push": true, "email": true},
  "decompte": {"push": true, "email": true}
}'::jsonb
WHERE notification_prefs IS NULL;

-- 4. Assouplissement de la RLS sur push_subscriptions pour admin, promoter et artist
DROP POLICY IF EXISTS "Admins manage own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users manage own push subscriptions" ON public.push_subscriptions;

CREATE POLICY "Users manage own push subscriptions"
ON public.push_subscriptions
FOR ALL
USING (
  auth.uid() = user_id 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('admin', 'promoter', 'artist')
  )
)
WITH CHECK (
  auth.uid() = user_id 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('admin', 'promoter', 'artist')
  )
);

-- 5. Publication Realtime : user_notifications dans supabase_realtime (sans REPLICA IDENTITY FULL)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
EXCEPTION 
  WHEN duplicate_object THEN 
    NULL;
END $$;
