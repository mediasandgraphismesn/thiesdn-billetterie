-- ==============================================================================
-- THIÈSDN BILLETTERIE — SÉCURITÉ & VERROUILLAGE SESSIONS VIGILES (SCANNERS)
-- 1. Table public.vigile_sessions (anti-partage de poste / détection appareil unique)
-- 2. Index de performance
-- 3. Sécurité RLS et révocation en direct
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.vigile_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_code TEXT NOT NULL,
  station_name TEXT,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  event_title TEXT,
  user_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  country TEXT,
  city TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  last_seen_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index pour requêtes rapides de verrouillage par poste
CREATE INDEX IF NOT EXISTS idx_vigile_sessions_station ON public.vigile_sessions (upper(trim(station_code)), is_active);
CREATE INDEX IF NOT EXISTS idx_vigile_sessions_active ON public.vigile_sessions (is_active, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_vigile_sessions_event ON public.vigile_sessions (event_id);

-- Activation RLS
ALTER TABLE public.vigile_sessions ENABLE ROW LEVEL SECURITY;

-- Les administrateurs peuvent tout voir et gérer (notamment révoquer les sessions)
DROP POLICY IF EXISTS "Admins gèrent les sessions vigiles" ON public.vigile_sessions;
CREATE POLICY "Admins gèrent les sessions vigiles" ON public.vigile_sessions
  FOR ALL
  USING (public.is_admin());

-- Lecture permise pour vérifier l'état d'un poste par son access_code
DROP POLICY IF EXISTS "Lecture session par poste" ON public.vigile_sessions;
CREATE POLICY "Lecture session par poste" ON public.vigile_sessions
  FOR SELECT
  USING (true);

-- Création et mise à jour permise pour initialiser et pinguer le statut
DROP POLICY IF EXISTS "Enregistrement session vigile" ON public.vigile_sessions;
CREATE POLICY "Enregistrement session vigile" ON public.vigile_sessions
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Mise à jour ping session vigile" ON public.vigile_sessions;
CREATE POLICY "Mise à jour ping session vigile" ON public.vigile_sessions
  FOR UPDATE
  USING (true);

-- Droits PostgREST
GRANT SELECT, INSERT, UPDATE ON public.vigile_sessions TO anon, authenticated, service_role;

-- Notification schéma
NOTIFY pgrst, 'reload schema';
