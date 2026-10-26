-- ==============================================================================
-- MIGRATION SUPABASE : PERSISTANCE COMPLETE DES CHAMPS RESEAUX SOCIAUX & MEDIA
-- Plateforme : Thiès Days and Nights (Thièsdn Billetterie)
-- ==============================================================================

-- 1. Ajout de toutes les colonnes multimédias, sociales et marketing dans la table 'events'
ALTER TABLE public.events 
  ADD COLUMN IF NOT EXISTS spotify_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS video_spot_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS youtube_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS social_facebook TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS social_instagram TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS social_tiktok TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS social_youtube TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS website_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sales_open_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS estimated_end_time TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS wave_link_prevente TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS wave_link_jour_j TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS wave_link_vip TEXT DEFAULT NULL;

COMMENT ON COLUMN public.events.spotify_url IS 'URL album, track ou playlist Spotify pour le lecteur vinyle interactif';
COMMENT ON COLUMN public.events.video_spot_url IS 'URL officielle du teaser ou aftermovie YouTube (standard ou youtu.be)';
COMMENT ON COLUMN public.events.youtube_url IS 'Alias rétro-compatible pour la vidéo YouTube de l''événement';
COMMENT ON COLUMN public.events.social_facebook IS 'URL de la page ou du groupe Facebook officiel de l''événement';
COMMENT ON COLUMN public.events.social_instagram IS 'URL du profil Instagram officiel de l''événement';
COMMENT ON COLUMN public.events.social_tiktok IS 'URL du compte TikTok officiel de l''événement';
COMMENT ON COLUMN public.events.social_youtube IS 'URL de la chaîne YouTube ou du teaser vidéo';
COMMENT ON COLUMN public.events.website_url IS 'URL du site web officiel de l''événement ou de l''organisateur';
COMMENT ON COLUMN public.events.sales_open_at IS 'Date et heure d''ouverture des réservations (compte à rebours si futur)';
COMMENT ON COLUMN public.events.estimated_end_time IS 'Heure estimée de clôture au format HH:mm pour les événements traversant minuit';

-- 2. Mise à jour de la politique de mise à jour RLS pour les promoteurs et administrateurs
DROP POLICY IF EXISTS "Events update promoter or admin" ON public.events;
CREATE POLICY "Events update promoter or admin" ON public.events FOR UPDATE
  USING (promoter_id = auth.uid() OR public.is_admin())
  WITH CHECK (promoter_id = auth.uid() OR public.is_admin());

-- 3. Rechargement immédiat du cache de schéma PostgREST
NOTIFY pgrst, 'reload schema';
