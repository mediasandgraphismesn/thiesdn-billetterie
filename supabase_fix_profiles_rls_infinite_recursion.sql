-- ==============================================================================
-- THIÈSDN BILLETTERIE — RÉSOLUTION DU BUG RLS 42P17 (INFINITE RECURSION SUR PROFILES)
-- Ce script corrige la boucle infinie lors des modifications de rôles dans UsersManagementView.
-- ==============================================================================

BEGIN;

-- ÉTAPE 1 : Création de la fonction helper is_admin() en SECURITY DEFINER
-- Le SECURITY DEFINER exécute la requête avec les privilèges postgres (RLS contourné),
-- ce qui casse définitivement la boucle infinie.
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

-- Sécurisation des privilèges d'exécution
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- ÉTAPE 2 : Nettoyage exhaustif des anciennes politiques RLS sur public.profiles
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update policy" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for admins" ON public.profiles;

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles select policy" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Coproducers can view partner profile" ON public.profiles;

DROP POLICY IF EXISTS "Profiles insert policy" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- S'assurer que le RLS est activé sur public.profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ÉTAPE 3 : Politiques SELECT saines (zéro récursion)
-- 3.1 Chaque utilisateur authentifié peut voir son propre profil
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING ( id = (SELECT auth.uid()) );

-- 3.2 Les administrateurs peuvent voir tous les profils (pour UsersManagementView)
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING ( (SELECT public.is_admin()) );

-- 3.3 Co-producteurs partenaires (lecture sanitisée sans sous-requête sur profiles)
CREATE POLICY "Coproducers can view partner profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.event_coproducers
    WHERE user_id = (SELECT auth.uid())
      AND promoter_id = public.profiles.id
  )
);

-- ÉTAPE 4 : Politiques UPDATE saines (zéro récursion)
-- 4.1 Les administrateurs peuvent modifier tous les profils (changement de rôle, VIP, etc.)
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING ( (SELECT public.is_admin()) )
WITH CHECK ( (SELECT public.is_admin()) );

-- 4.2 Les utilisateurs mettent à jour leur propre profil (nom, téléphone, quartier, etc.)
-- Zéro sous-requête récursive sur profiles
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING ( id = (SELECT auth.uid()) )
WITH CHECK ( id = (SELECT auth.uid()) );

-- ÉTAPE 5 : Politiques INSERT
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  id = (SELECT auth.uid())
  OR (SELECT public.is_admin())
);

COMMIT;
