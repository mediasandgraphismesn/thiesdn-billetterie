-- ==============================================================================
-- MIGRATION SUPABASE : SYSTÈME MARKETING (COUNTDOWN, PRÉ-INSCRIPTION) & SPOTIFY WOW
-- Plateforme : Thiès Days and Nights (Thièsdn Billetterie)
-- ==============================================================================

-- 1. Ajout des colonnes marketing & multimédia dans la table 'events'
ALTER TABLE public.events 
  ADD COLUMN IF NOT EXISTS sales_open_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS spotify_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS video_spot_url TEXT DEFAULT NULL;

COMMENT ON COLUMN public.events.sales_open_at IS 'Date et heure officielles d''ouverture des réservations Wave (NULL = ouvert immédiatement)';
COMMENT ON COLUMN public.events.spotify_url IS 'URL album/track/playlist Spotify pour le lecteur vinyle interactif';
COMMENT ON COLUMN public.events.video_spot_url IS 'URL teaser ou aftermovie YouTube (format standard ou court youtu.be)';

-- 2. Création de la table des pré-inscriptions (Leads marketing avant ouverture des ventes)
CREATE TABLE IF NOT EXISTS public.event_pre_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_event_pre_registration_phone UNIQUE(event_id, phone)
);

-- Index pour accélérer les requêtes de notification
CREATE INDEX IF NOT EXISTS idx_pre_reg_event_id ON public.event_pre_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_pre_reg_created_at ON public.event_pre_registrations(created_at DESC);

-- 3. Activation de Row Level Security (RLS)
ALTER TABLE public.event_pre_registrations ENABLE ROW LEVEL SECURITY;

-- Politique A : N'importe quel internaute (connecté ou anonyme) peut se pré-inscrire
DROP POLICY IF EXISTS "Permettre l'insertion publique des pre-inscriptions" ON public.event_pre_registrations;
CREATE POLICY "Permettre l'insertion publique des pre-inscriptions"
  ON public.event_pre_registrations
  FOR INSERT
  WITH CHECK (true);

-- Politique B : Seuls les admins et le promoteur de l'événement peuvent consulter la liste
DROP POLICY IF EXISTS "Lecture des pre-inscriptions par promoteurs et admins" ON public.event_pre_registrations;
CREATE POLICY "Lecture des pre-inscriptions par promoteurs et admins"
  ON public.event_pre_registrations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_pre_registrations.event_id
        AND (e.promoter_id = auth.uid() OR auth.jwt() ->> 'role' = 'service_role')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (p.role = 'admin' OR p.role = 'super_admin')
    )
  );

-- Accorder les droits d'accès Supabase API
GRANT SELECT, INSERT ON public.event_pre_registrations TO anon, authenticated, service_role;
