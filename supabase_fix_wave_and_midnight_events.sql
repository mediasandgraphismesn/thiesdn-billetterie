-- ==============================================================================
-- MIGRATION CORRECTIVE : PERSISTANCE DES LIENS WAVE & ÉVÉNEMENTS NOCTURNES 24H
-- Plateforme : Thiès Days and Nights (Thièsdn Billetterie)
-- ==============================================================================

-- 1. S'assurer de la présence des colonnes Wave et Fin Estimée dans la table 'events'
ALTER TABLE public.events 
  ADD COLUMN IF NOT EXISTS wave_link_prevente TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS wave_link_jour_j TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS wave_link_vip TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS estimated_end_time TEXT DEFAULT NULL;

COMMENT ON COLUMN public.events.wave_link_prevente IS 'Lien de paiement Wave direct pour le pass prévente';
COMMENT ON COLUMN public.events.wave_link_jour_j IS 'Lien de paiement Wave direct pour le pass standard jour J';
COMMENT ON COLUMN public.events.wave_link_vip IS 'Lien de paiement Wave direct pour le pass VIP';
COMMENT ON COLUMN public.events.estimated_end_time IS 'Heure estimée de fin au format HH:mm (ex: 05:00 le lendemain pour soirée traversant minuit, sinon défaut 6h après début)';

-- 2. Correction stricte des politiques RLS UPDATE sur 'events'
-- Garantit que le promoteur de l'événement ET les administrateurs peuvent modifier les données
DROP POLICY IF EXISTS "Events update promoter or admin" ON public.events;
CREATE POLICY "Events update promoter or admin" ON public.events FOR UPDATE
  USING (promoter_id = auth.uid() OR public.is_admin())
  WITH CHECK (promoter_id = auth.uid() OR public.is_admin());

-- Recharger le cache du schéma PostgREST
NOTIFY pgrst, 'reload schema';
