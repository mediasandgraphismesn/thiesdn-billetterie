-- ==============================================================================
-- MISSION 2 : RESET TOTAL TRANSACTIONNEL - "BIRTHDAY KMOU JANGO"
-- Projet : Thièsdn Billetterie (Production)
-- Date   : 2026-11-05
-- Cible  : event_id = 'e8f9e7a8-713c-4aa1-9fc3-6fc24e5eddd5'
-- ⚠️ ATTENTION : À N'EXÉCUTER QU'APRÈS VALIDATION DU BACKUP DE SÉCURITÉ
-- ==============================================================================

BEGIN;

-- 1. Sécurité préalable : Vérifier l'existence des tables de backup avant tout effacement
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'backup_kmou_jango_tickets') THEN
    RAISE EXCEPTION 'ERREUR CRITIQUE DE SÉCURITÉ : La table backup_kmou_jango_tickets est absente ! Exécutez le script de backup d''abord.';
  END IF;
END $$;

-- 2. Suppression de tous les billets de test (physiques et digitaux) pour Kmou Jango
DELETE FROM public.tickets
WHERE event_id = 'e8f9e7a8-713c-4aa1-9fc3-6fc24e5eddd5';

-- 3. Suppression de toutes les commandes de test pour Kmou Jango
DELETE FROM public.orders
WHERE event_id = 'e8f9e7a8-713c-4aa1-9fc3-6fc24e5eddd5';

-- 4. Suppression de toutes les allocations de billets physiques pour Kmou Jango
DELETE FROM public.ticket_allocations
WHERE event_id = 'e8f9e7a8-713c-4aa1-9fc3-6fc24e5eddd5';

-- 5. Suppression des transactions financières de test associées
DELETE FROM public.transactions
WHERE event_id = 'e8f9e7a8-713c-4aa1-9fc3-6fc24e5eddd5';

-- 6. Remise à zéro des compteurs des collaborateurs / points de vente (sans supprimer leurs fiches)
UPDATE public.sales_agents
SET 
  allocated_count = 0,
  sold_count = 0,
  cash_collected = 0
WHERE event_id = 'e8f9e7a8-713c-4aa1-9fc3-6fc24e5eddd5';

-- 7. Vérification des résultats post-reset
SELECT 
  'tickets_restants' AS check_item, count(*) AS count FROM public.tickets WHERE event_id = 'e8f9e7a8-713c-4aa1-9fc3-6fc24e5eddd5'
UNION ALL
SELECT 
  'orders_restants' AS check_item, count(*) AS count FROM public.orders WHERE event_id = 'e8f9e7a8-713c-4aa1-9fc3-6fc24e5eddd5'
UNION ALL
SELECT 
  'allocations_restantes' AS check_item, count(*) AS count FROM public.ticket_allocations WHERE event_id = 'e8f9e7a8-713c-4aa1-9fc3-6fc24e5eddd5'
UNION ALL
SELECT 
  'agents_reinitialises' AS check_item, count(*) AS count FROM public.sales_agents WHERE event_id = 'e8f9e7a8-713c-4aa1-9fc3-6fc24e5eddd5' AND allocated_count = 0 AND sold_count = 0 AND cash_collected = 0;

-- Décommenter COMMIT si vous validez définitivement la transaction
COMMIT;
