-- ==============================================================================
-- THIÈSDN BILLETTERIE — TRAÇABILITÉ DES CONNEXIONS (LOGIN HISTORY)
-- 1. Table public.login_history
-- 2. Index de performance (user_id, created_at, email)
-- 3. Sécurité RLS stricte (seul l'administrateur peut auditer les accès)
-- ==============================================================================

-- 1. Création de la table de journalisation des connexions
CREATE TABLE IF NOT EXISTS public.login_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  country TEXT,
  city TEXT,
  action TEXT DEFAULT 'login',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Index optimisés pour les requêtes de recherche et d'audit
CREATE INDEX IF NOT EXISTS idx_login_history_user_date ON public.login_history (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_history_email ON public.login_history (lower(trim(email)));
CREATE INDEX IF NOT EXISTS idx_login_history_date ON public.login_history (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_history_country ON public.login_history (country);

-- 3. Activation du Row Level Security (RLS)
ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;

-- Seuls les administrateurs ont le droit de consulter l'historique complet
DROP POLICY IF EXISTS "Admins consultent l'historique des connexions" ON public.login_history;
CREATE POLICY "Admins consultent l'historique des connexions" ON public.login_history
  FOR SELECT
  USING (public.is_admin());

-- Insertion permise pour enregistrer les événements de connexion
DROP POLICY IF EXISTS "Enregistrement des logs de connexion" ON public.login_history;
CREATE POLICY "Enregistrement des logs de connexion" ON public.login_history
  FOR INSERT
  WITH CHECK (true);

-- Droits PostgREST
GRANT SELECT, INSERT ON public.login_history TO anon, authenticated, service_role;

-- Notification schéma
NOTIFY pgrst, 'reload schema';
