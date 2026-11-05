-- ==============================================================================
-- PROCÉDURE DE RESTAURATION D'URGENCE (ROLLBACK) - "BIRTHDAY KMOU JANGO"
-- Projet : Thièsdn Billetterie
-- Date   : 2026-11-05
-- Permet de réinjecter instantanément les données sauvegardées
-- ==============================================================================

BEGIN;

-- 1. Restaurer les billets
INSERT INTO public.tickets
SELECT * FROM public.backup_kmou_jango_tickets
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  holder_name = EXCLUDED.holder_name,
  holder_phone = EXCLUDED.holder_phone,
  used_at = EXCLUDED.used_at;

-- 2. Restaurer les commandes
INSERT INTO public.orders
SELECT * FROM public.backup_kmou_jango_orders
ON CONFLICT (id) DO NOTHING;

-- 3. Restaurer les allocations
INSERT INTO public.ticket_allocations
SELECT * FROM public.backup_kmou_jango_allocations
ON CONFLICT (id) DO NOTHING;

-- 4. Restaurer les transactions
INSERT INTO public.transactions
SELECT * FROM public.backup_kmou_jango_transactions
ON CONFLICT (id) DO NOTHING;

-- 5. Restaurer les compteurs des agents
UPDATE public.sales_agents a
SET 
  allocated_count = b.allocated_count,
  sold_count = b.sold_count,
  cash_collected = b.cash_collected
FROM public.backup_kmou_jango_sales_agents b
WHERE a.id = b.id;

COMMIT;
