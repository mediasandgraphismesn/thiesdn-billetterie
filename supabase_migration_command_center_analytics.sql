-- ==============================================================================
-- THIÈSDN BILLETTERIE — COMMAND CENTER SÉNÉGAL & ANALYTICS UTM
-- 1. Extension optionnelle GPS de public.sales_agents (adresse, latitude, longitude)
-- 2. Table public.connection_logs (IP, ville, pays, empreinte appareil, logs suspects)
-- 3. Table public.event_analytics (clics, partages, source, device, UTM, ville)
-- 4. Index de performance et politiques RLS strictes (Admin / Promoteur / Tracking)
-- ==============================================================================

-- 1. Colonnes GPS optionnelles pour les points de vente (non bloquantes)
ALTER TABLE public.sales_agents ADD COLUMN IF NOT EXISTS adresse TEXT;
ALTER TABLE public.sales_agents ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.sales_agents ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- 2. Table public.connection_logs
CREATE TABLE IF NOT EXISTS public.connection_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  city TEXT,
  country TEXT,
  device_fingerprint TEXT,
  action TEXT DEFAULT 'login',
  is_suspicious BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.connection_logs ADD COLUMN IF NOT EXISTS device_fingerprint TEXT;
ALTER TABLE public.connection_logs ADD COLUMN IF NOT EXISTS action TEXT DEFAULT 'login';
ALTER TABLE public.connection_logs ADD COLUMN IF NOT EXISTS is_suspicious BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_connection_logs_created_at ON public.connection_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_connection_logs_user_date ON public.connection_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_connection_logs_suspicious ON public.connection_logs (is_suspicious, created_at DESC);

ALTER TABLE public.connection_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins consultent connection_logs" ON public.connection_logs;
CREATE POLICY "Admins consultent connection_logs" ON public.connection_logs
  FOR SELECT
  USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "Insertion publique connection_logs" ON public.connection_logs;
CREATE POLICY "Insertion publique connection_logs" ON public.connection_logs
  FOR INSERT
  WITH CHECK (true);

GRANT SELECT, INSERT ON public.connection_logs TO anon, authenticated, service_role;

-- 3. Table public.event_analytics (Tracking Clics, Partages, UTM & Villes)
CREATE TABLE IF NOT EXISTS public.event_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('click', 'share_whatsapp', 'share_facebook', 'share_twitter', 'share_copy_link')),
  source TEXT NOT NULL DEFAULT 'site' CHECK (source IN ('site', 'social')),
  device TEXT NOT NULL DEFAULT 'desktop' CHECK (device IN ('mobile', 'desktop')),
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  city TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.event_analytics ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE public.event_analytics ADD COLUMN IF NOT EXISTS utm_medium TEXT;
ALTER TABLE public.event_analytics ADD COLUMN IF NOT EXISTS utm_campaign TEXT;
ALTER TABLE public.event_analytics ADD COLUMN IF NOT EXISTS city TEXT;

CREATE INDEX IF NOT EXISTS idx_event_analytics_event_date ON public.event_analytics (event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_analytics_created_at ON public.event_analytics (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_analytics_action ON public.event_analytics (action);
CREATE INDEX IF NOT EXISTS idx_event_analytics_utm_source ON public.event_analytics (utm_source);

ALTER TABLE public.event_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tracking public event_analytics" ON public.event_analytics;
CREATE POLICY "Tracking public event_analytics" ON public.event_analytics
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Lecture event_analytics admin et promoteur" ON public.event_analytics;
CREATE POLICY "Lecture event_analytics admin et promoteur" ON public.event_analytics
  FOR SELECT
  USING (
    (SELECT public.is_admin())
    OR EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_analytics.event_id
        AND e.promoter_id = (SELECT auth.uid())
    )
  );

GRANT SELECT, INSERT ON public.event_analytics TO anon, authenticated, service_role;

-- Rechargement du cache schéma PostgREST
NOTIFY pgrst, 'reload schema';
