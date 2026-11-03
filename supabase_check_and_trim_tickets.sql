-- ==============================================================================
-- CONTRÔLE ET RÉCONCILIATION DU STOCK DE BILLETS PHYSIQUES
-- Événement : Birthday Kmou Jango (ID: e8f9e7a8-713c-4aa1-9fc3-6fc24e5eddd5)
-- ==============================================================================

-- 1. CONTRÔLE INITIAL DU NOMBRE DE BILLETS
-- Ce décompte affiche exactement la situation actuelle dans Supabase.
SELECT 
  event_title,
  is_physical,
  COUNT(*) AS total_billets,
  COUNT(CASE WHEN agent_id IS NULL THEN 1 END) AS en_reserve_promoteur,
  COUNT(CASE WHEN agent_id IS NOT NULL THEN 1 END) AS distribues_en_boutique,
  COUNT(CASE WHEN status = 'sold_valid' THEN 1 END) AS vendus_declares
FROM public.tickets
WHERE event_id = 'e8f9e7a8-713c-4aa1-9fc3-6fc24e5eddd5'
  AND is_physical = true
GROUP BY event_title, is_physical;

-- 2. SUPPRESSION DU SURPLUS D'ANCIENS TESTS (SI TOTAL > 300)
-- SÉCURITÉ GARANTIE :
-- - Cette requête NE SUPPRIME JAMAIS les billets attribués à DJ CRAZY (agent_id IS NOT NULL).
-- - Elle supprime UNIQUEMENT les 200 billets physiques créés en premier qui n'ont jamais été alloués (agent_id IS NULL).
DELETE FROM public.tickets
WHERE id IN (
  SELECT id FROM public.tickets
  WHERE event_id = 'e8f9e7a8-713c-4aa1-9fc3-6fc24e5eddd5'
    AND is_physical = true
    AND agent_id IS NULL
    AND status = 'printed_not_sold'
  ORDER BY created_at ASC
  LIMIT (
    GREATEST(0, (
      SELECT COUNT(*) - 300 
      FROM public.tickets 
      WHERE event_id = 'e8f9e7a8-713c-4aa1-9fc3-6fc24e5eddd5' 
        AND is_physical = true
    ))
  )
);

-- 3. VÉRIFICATION FINALE (RÉSULTAT ATTENDU : 300 TOTAL, 200 RÉSERVE, 100 DISTRIBUÉS)
SELECT 
  event_title,
  COUNT(*) AS total_physique_300,
  COUNT(CASE WHEN agent_id IS NULL THEN 1 END) AS reserve_promoteur_200,
  COUNT(CASE WHEN agent_id IS NOT NULL THEN 1 END) AS distribues_boutique_100,
  COUNT(CASE WHEN status = 'sold_valid' THEN 1 END) AS vendus_declares
FROM public.tickets
WHERE event_id = 'e8f9e7a8-713c-4aa1-9fc3-6fc24e5eddd5'
  AND is_physical = true
GROUP BY event_title;
