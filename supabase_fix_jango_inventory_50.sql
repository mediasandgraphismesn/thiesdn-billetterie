-- ============================================================================
-- MISSION 1 : Réparation inventaire physique & liaison Point de vente Jango
-- Exécuter d'abord l'ÉTAPE 1 (SELECT diagnostic) puis l'ÉTAPE 2 dans Supabase
-- > SQL Editor.
-- ============================================================================

-- ÉTAPE 1 : DIAGNOSTIC PRÉALABLE (Lecture seule)
SELECT
  status,
  agent_id,
  COUNT(*) AS total
FROM public.tickets
WHERE event_id = 'e8f9e7a8-713c-4aa1-9fc3-6fc24e5eddd5'
  AND is_physical = true
GROUP BY status, agent_id
ORDER BY agent_id NULLS FIRST, status;

SELECT
  id,
  point_de_vente,
  user_id,
  allocated_count,
  sold_count,
  cash_collected,
  amount_due
FROM public.sales_agents
WHERE id = '0be35220-c0fc-4c75-92fb-8a238d708b27';

-- ============================================================================
-- ÉTAPE 2 : ATTRIBUTION DES 50 BILLETS PHYSIQUES À JANGO + SYNCHRO COMPTEUR
-- ============================================================================
UPDATE public.tickets
SET
  agent_id = '0be35220-c0fc-4c75-92fb-8a238d708b27',
  agent_name = COALESCE(
    (SELECT point_de_vente FROM public.sales_agents WHERE id = '0be35220-c0fc-4c75-92fb-8a238d708b27'),
    'Point de vente Jango'
  ),
  status = 'printed_not_sold'
WHERE id IN (
  SELECT id
  FROM public.tickets
  WHERE event_id = 'e8f9e7a8-713c-4aa1-9fc3-6fc24e5eddd5'
    AND is_physical = true
    AND agent_id IS NULL
    AND status <> 'cancelled'
  ORDER BY created_at ASC, id ASC
  LIMIT 50
);

UPDATE public.sales_agents
SET allocated_count = (
  SELECT COUNT(*)
  FROM public.tickets
  WHERE agent_id = '0be35220-c0fc-4c75-92fb-8a238d708b27'
    AND status <> 'cancelled'
)
WHERE id = '0be35220-c0fc-4c75-92fb-8a238d708b27';

-- VÉRIFICATION POST-EXÉCUTION
SELECT
  status,
  agent_id,
  COUNT(*) AS total
FROM public.tickets
WHERE event_id = 'e8f9e7a8-713c-4aa1-9fc3-6fc24e5eddd5'
  AND agent_id = '0be35220-c0fc-4c75-92fb-8a238d708b27'
GROUP BY status, agent_id;
