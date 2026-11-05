-- ==============================================================================
-- MIGRATION SUPABASE : AUTORISATION DU TRANSFERT DE PROPRIÉTÉ D'ÉVÉNEMENT (RLS)
-- Permet à un administrateur d'assigner ou réassigner un événement à un promoteur.
-- ==============================================================================

-- 1. S'assurer que la fonction sécurisée is_admin() existe sans récursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
    AND role = 'admin'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 2. Activer le RLS sur events si ce n'est pas déjà fait
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- 3. Politique UPDATE : Autorise les administrateurs ET les promoteurs propriétaires
DROP POLICY IF EXISTS "Events update promoter or admin" ON public.events;
DROP POLICY IF EXISTS "Admins and promoters can update events" ON public.events;

CREATE POLICY "Events update promoter or admin"
ON public.events
FOR UPDATE
TO authenticated
USING (
  promoter_id = auth.uid() 
  OR (SELECT public.is_admin())
)
WITH CHECK (
  promoter_id = auth.uid() 
  OR (SELECT public.is_admin())
);

-- 4. Politique SELECT : Tout le monde peut voir les événements approuvés, les promoteurs voient leurs événements et les admins voient tout
DROP POLICY IF EXISTS "Events select promoter or admin or public" ON public.events;
CREATE POLICY "Events select promoter or admin or public"
ON public.events
FOR SELECT
TO authenticated, anon
USING (
  status = 'approved'
  OR promoter_id = auth.uid()
  OR (SELECT public.is_admin())
);

-- 5. Rechargement du cache de schéma PostgREST
NOTIFY pgrst, 'reload schema';
