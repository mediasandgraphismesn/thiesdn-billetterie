-- ==============================================================================
-- THIÈSDN BILLETTERIE — CORRECTION RLS DONNÉES PERSONNELLES (PROFILES)
-- 1. Verrouillage strict de public.profiles (email & téléphone protégés)
-- 2. Création de la vue publique public_profiles (id, name, username, avatar, role)
-- ==============================================================================

-- 1. S'assurer de l'activation RLS sur profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- S'assurer de la présence de la table event_coproducers
CREATE TABLE IF NOT EXISTS public.event_coproducers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  promoter_id TEXT NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT,
  role_type TEXT DEFAULT 'staff_artiste',
  revenue_share NUMERIC DEFAULT 0,
  guest_tickets_allocated INT DEFAULT 0,
  guest_tickets_used INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Remplacement de la politique permissive par la politique hermétique
DROP POLICY IF EXISTS "Profiles select policy" ON public.profiles;
CREATE POLICY "Profiles select policy" ON public.profiles FOR SELECT
  USING (
    auth.uid() = id 
    OR public.is_admin() 
    OR EXISTS (
      SELECT 1 FROM public.event_coproducers 
      WHERE user_id = auth.uid() AND promoter_id = profiles.id::text
    )
  );

-- 3. Création de la vue publique sanitisée (sans email ni téléphone privé)
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles 
WITH (security_invoker = false)
AS
  SELECT id, name, username, avatar, role
  FROM public.profiles;

-- 4. Accorder l'accès en lecture à la vue publique pour anon et authenticated
GRANT SELECT ON public.public_profiles TO anon, authenticated, service_role;

-- 5. Recharger le schéma PostgREST
NOTIFY pgrst, 'reload schema';
