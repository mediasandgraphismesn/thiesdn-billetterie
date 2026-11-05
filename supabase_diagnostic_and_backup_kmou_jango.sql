-- ==============================================================================
-- MISSION 1 : DIAGNOSTIC & SAUVEGARDE COMPLÈTE - ÉVÉNEMENT "BIRTHDAY KMOU JANGO"
-- Projet : Thièsdn Billetterie (Production)
-- Date   : 2026-11-05
-- Cible  : event_id = 'e8f9e7a8-713c-4aa1-9fc3-6fc24e5eddd5'
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. DIAGNOSTIC COMPLET DES DONNÉES EN PRODUCTION (READ-ONLY)
-- ------------------------------------------------------------------------------

-- A. Vérification de l'événement cible
SELECT 
  id AS event_id,
  title AS event_title,
  promoter_name,
  promoter_id,
  status,
  created_at
FROM public.events
WHERE id = 'e8f9e7a8-713c-4aa1-9fc3-6fc24e5eddd5';

-- B. Comptage global par table
SELECT 
  'tickets' AS table_name, 
  count(*) AS total_lignes,
  count(*) FILTER (WHERE status IN ('printed_not_sold', 'physical_allocated', 'physical_printed', 'sold_valid', 'physical_sold') OR is_physical = true) AS billets_physiques,
  count(*) FILTER (WHERE status NOT IN ('printed_not_sold', 'physical_allocated', 'physical_printed', 'sold_valid', 'physical_sold') AND (is_physical IS NULL OR is_physical = false)) AS billets_digitaux
FROM public.tickets
WHERE event_id = 'e8f9e7a8-713c-4aa1-9fc3-6fc24e5eddd5'

UNION ALL

SELECT 
  'orders' AS table_name, 
  count(*) AS total_lignes,
  0 AS billets_physiques,
  0 AS billets_digitaux
FROM public.orders
WHERE event_id = 'e8f9e7a8-713c-4aa1-9fc3-6fc24e5eddd5'

UNION ALL

SELECT 
  'ticket_allocations' AS table_name, 
  count(*) AS total_lignes,
  0 AS billets_physiques,
  0 AS billets_digitaux
FROM public.ticket_allocations
WHERE event_id = 'e8f9e7a8-713c-4aa1-9fc3-6fc24e5eddd5'

UNION ALL

SELECT 
  'sales_agents' AS table_name, 
  count(*) AS total_lignes,
  0 AS billets_physiques,
  0 AS billets_digitaux
FROM public.sales_agents
WHERE event_id = 'e8f9e7a8-713c-4aa1-9fc3-6fc24e5eddd5'

UNION ALL

SELECT 
  'transactions' AS table_name, 
  count(*) AS total_lignes,
  0 AS billets_physiques,
  0 AS billets_digitaux
FROM public.transactions
WHERE event_id = 'e8f9e7a8-713c-4aa1-9fc3-6fc24e5eddd5';

-- C. Répartition des billets par statut
SELECT 
  status,
  count(*) AS total,
  CASE 
    WHEN status IN ('printed_not_sold', 'physical_allocated', 'physical_printed') THEN 'Physique Inactif (Non vendu)'
    WHEN status IN ('sold_valid', 'physical_sold') THEN 'Physique Vendu Nominatif'
    WHEN status = 'valid' THEN 'Digital Validé'
    WHEN status = 'used' OR status = 'scanned' THEN 'Scanné à l''Entrée'
    WHEN status = 'cancelled' THEN 'Annulé / Désactivé'
    ELSE 'Autre'
  END AS categorie_metier
FROM public.tickets
WHERE event_id = 'e8f9e7a8-713c-4aa1-9fc3-6fc24e5eddd5'
GROUP BY status
ORDER BY total DESC;

-- D. Détail des collaborateurs et compteurs actuels
SELECT 
  id AS agent_id,
  point_de_vente,
  gerant_name,
  telephone,
  allocated_count,
  sold_count,
  cash_collected
FROM public.sales_agents
WHERE event_id = 'e8f9e7a8-713c-4aa1-9fc3-6fc24e5eddd5';

-- ------------------------------------------------------------------------------
-- 2. BACKUP DE SÉCURITÉ : TABLES D'ARCHIVAGE DANS SUPABASE
-- Permet de restaurer instantanément les données en 1 seconde en cas de besoin
-- ------------------------------------------------------------------------------

-- Sauvegarde des billets
DROP TABLE IF EXISTS public.backup_kmou_jango_tickets;
CREATE TABLE public.backup_kmou_jango_tickets AS
SELECT * FROM public.tickets
WHERE event_id = 'e8f9e7a8-713c-4aa1-9fc3-6fc24e5eddd5';

-- Sauvegarde des commandes
DROP TABLE IF EXISTS public.backup_kmou_jango_orders;
CREATE TABLE public.backup_kmou_jango_orders AS
SELECT * FROM public.orders
WHERE event_id = 'e8f9e7a8-713c-4aa1-9fc3-6fc24e5eddd5';

-- Sauvegarde des allocations
DROP TABLE IF EXISTS public.backup_kmou_jango_allocations;
CREATE TABLE public.backup_kmou_jango_allocations AS
SELECT * FROM public.ticket_allocations
WHERE event_id = 'e8f9e7a8-713c-4aa1-9fc3-6fc24e5eddd5';

-- Sauvegarde des collaborateurs
DROP TABLE IF EXISTS public.backup_kmou_jango_sales_agents;
CREATE TABLE public.backup_kmou_jango_sales_agents AS
SELECT * FROM public.sales_agents
WHERE event_id = 'e8f9e7a8-713c-4aa1-9fc3-6fc24e5eddd5';

-- Sauvegarde des transactions
DROP TABLE IF EXISTS public.backup_kmou_jango_transactions;
CREATE TABLE public.backup_kmou_jango_transactions AS
SELECT * FROM public.transactions
WHERE event_id = 'e8f9e7a8-713c-4aa1-9fc3-6fc24e5eddd5';

-- ------------------------------------------------------------------------------
-- 3. EXPORT JSON INTÉGRAL (Prêt pour téléchargement / conservation locale)
-- ------------------------------------------------------------------------------
SELECT json_build_object(
  'exported_at', now(),
  'event_id', 'e8f9e7a8-713c-4aa1-9fc3-6fc24e5eddd5',
  'event_title', 'BIRTHDAY KMOU JANGO',
  'tickets', (SELECT json_agg(t) FROM public.backup_kmou_jango_tickets t),
  'orders', (SELECT json_agg(o) FROM public.backup_kmou_jango_orders o),
  'allocations', (SELECT json_agg(a) FROM public.backup_kmou_jango_allocations a),
  'sales_agents', (SELECT json_agg(s) FROM public.backup_kmou_jango_sales_agents s),
  'transactions', (SELECT json_agg(x) FROM public.backup_kmou_jango_transactions x)
) AS kmou_jango_full_backup_json;
