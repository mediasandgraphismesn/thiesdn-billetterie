-- ==============================================================================
-- MIGRATION DE SÉCURITÉ RLS : GESTION DES POINTS DE VENTE & BILLETS PHYSIQUES
-- Projet : Thièsdn Billetterie
-- Objectif : 
--   1. Permettre aux Admins et Promoteurs de voir TOUS les points de vente (sales_agents)
--      et billets physiques de leurs événements sans restriction RLS.
--   2. Permettre aux vendeurs (sales_agents) d'accéder à leurs billets assignés.
--   3. Éviter les erreurs de conversion de type UUID vs TEXT sur auth.uid().
-- ==============================================================================

-- 1. Activer RLS sur public.sales_agents
ALTER TABLE public.sales_agents ENABLE ROW LEVEL SECURITY;

-- 2. Nettoyage des anciennes policies sur sales_agents
DROP POLICY IF EXISTS "Sales agents select policy" ON public.sales_agents;
DROP POLICY IF EXISTS "Allow select sales_agents" ON public.sales_agents;
DROP POLICY IF EXISTS "Promoters and admins select sales_agents" ON public.sales_agents;
DROP POLICY IF EXISTS "Sales agents manage policy" ON public.sales_agents;
DROP POLICY IF EXISTS "Promoters and admins manage sales_agents" ON public.sales_agents;

-- 3. Policy SELECT sur sales_agents :
--    - Les Admins voient tout
--    - Les Promoteurs voient les points de vente de leurs événements
--    - Les Vendeurs voient leur propre point de vente (user_id = auth.uid())
CREATE POLICY "Promoters and admins select sales_agents"
ON public.sales_agents
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR user_id = auth.uid()
  OR promoter_id::text = auth.uid()::text
  OR EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = sales_agents.event_id
    AND events.promoter_id::text = auth.uid()::text
  )
);

-- 4. Policy INSERT/UPDATE/DELETE sur sales_agents :
CREATE POLICY "Promoters and admins manage sales_agents"
ON public.sales_agents
FOR ALL
TO authenticated
USING (
  public.is_admin()
  OR promoter_id::text = auth.uid()::text
  OR user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = sales_agents.event_id
    AND events.promoter_id::text = auth.uid()::text
  )
)
WITH CHECK (
  public.is_admin()
  OR promoter_id::text = auth.uid()::text
  OR user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = sales_agents.event_id
    AND events.promoter_id::text = auth.uid()::text
  )
);

-- 5. Sécuriser et optimiser la policy SELECT sur tickets
DROP POLICY IF EXISTS "Tickets read owner or admin" ON public.tickets;
CREATE POLICY "Tickets read owner or admin"
ON public.tickets
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.sales_agents
    WHERE sales_agents.id = tickets.agent_id
    AND (sales_agents.user_id = auth.uid() OR sales_agents.promoter_id::text = auth.uid()::text)
  )
  OR EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = tickets.event_id
    AND events.promoter_id::text = auth.uid()::text
  )
);

-- 6. Policy ALL sur tickets pour l'admin et les promoteurs
DROP POLICY IF EXISTS "Promoters and admins manage tickets" ON public.tickets;
CREATE POLICY "Promoters and admins manage tickets"
ON public.tickets
FOR ALL
TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = tickets.event_id
    AND events.promoter_id::text = auth.uid()::text
  )
)
WITH CHECK (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = tickets.event_id
    AND events.promoter_id::text = auth.uid()::text
  )
);
