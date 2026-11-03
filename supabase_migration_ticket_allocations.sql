-- ============================================================================
-- MIGRATION : Table ticket_allocations (Historique des remises de billets)
-- Projet : Thièsdn Billetterie
-- Date : 2026-11-03 (Corrigé avec cast explicite ::text pour compatibilité UUID/TEXT)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ticket_allocations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES public.sales_agents(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  ticket_type TEXT NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  allocated_by TEXT,
  notes TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index de performance
CREATE INDEX IF NOT EXISTS idx_ticket_allocations_agent ON public.ticket_allocations(agent_id);
CREATE INDEX IF NOT EXISTS idx_ticket_allocations_event ON public.ticket_allocations(event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_allocations_created_at ON public.ticket_allocations(created_at DESC);

-- Sécurité RLS
ALTER TABLE public.ticket_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ticket allocations read promoter or admin" ON public.ticket_allocations;
CREATE POLICY "Ticket allocations read promoter or admin" ON public.ticket_allocations FOR SELECT
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = ticket_allocations.event_id
      AND events.promoter_id::text = auth.uid()::text
  )
  OR EXISTS (
    SELECT 1 FROM public.sales_agents
    WHERE sales_agents.id = ticket_allocations.agent_id
      AND (
        sales_agents.user_id::text = auth.uid()::text 
        OR sales_agents.promoter_id::text = auth.uid()::text
      )
  )
);

DROP POLICY IF EXISTS "Ticket allocations insert promoter or admin" ON public.ticket_allocations;
CREATE POLICY "Ticket allocations insert promoter or admin" ON public.ticket_allocations FOR INSERT
WITH CHECK (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = ticket_allocations.event_id
      AND events.promoter_id::text = auth.uid()::text
  )
  OR EXISTS (
    SELECT 1 FROM public.sales_agents
    WHERE sales_agents.id = ticket_allocations.agent_id
      AND sales_agents.promoter_id::text = auth.uid()::text
  )
);

DROP POLICY IF EXISTS "Ticket allocations update promoter or admin" ON public.ticket_allocations;
CREATE POLICY "Ticket allocations update promoter or admin" ON public.ticket_allocations FOR UPDATE
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.events
    WHERE events.id = ticket_allocations.event_id
      AND events.promoter_id::text = auth.uid()::text
  )
);
