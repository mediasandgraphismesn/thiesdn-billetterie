-- ==============================================================================
-- FIX CRITIQUE SUPABASE : RLS INFINITE RECURSION SUR LA TABLE "profiles"
-- Erreur résolue : "infinite recursion detected in policy for relation profiles"
-- ==============================================================================

-- 1. Fonction sécurisée SECURITY DEFINER pour tester si l'utilisateur est admin
--    Le mot-clé SECURITY DEFINER exécute la fonction avec les droits du propriétaire
--    et BYPASSE les politiques RLS sur la table profiles, ce qui élimine la boucle infinie.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
$$;

-- Accorder les droits d'exécution aux utilisateurs authentifiés et anonymes
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon, service_role;

-- 2. Nettoyage de TOUTES les anciennes politiques potentiellement récursives sur profiles
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for admins" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are updatable by users or admins" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update policy" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone or owner" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile or admins can update any" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- 3. Activation du RLS sur profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Politique SELECT : Consultation des profils
--    Chaque utilisateur peut lire les profils (nécessaire pour afficher les noms de promoteurs et l'annuaire admin)
CREATE POLICY "Profiles are viewable by everyone or owner"
ON public.profiles
FOR SELECT
TO authenticated, anon
USING (true);

-- 5. Politique UPDATE : Modification des profils
--    Un utilisateur peut modifier son propre profil (id = auth.uid())
--    OU un administrateur peut modifier n'importe quel profil (public.is_admin())
--    ZÉRO RÉCURSION grâce à public.is_admin() en SECURITY DEFINER !
CREATE POLICY "Users can update own profile or admins can update any"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  id = auth.uid() OR public.is_admin()
)
WITH CHECK (
  id = auth.uid() OR public.is_admin()
);

-- 6. Politique INSERT : Création de profil
--    Permet à un nouvel utilisateur de créer son propre profil lors du SignUp
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  id = auth.uid()
);

-- 7. Vérification finale
SELECT
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename = 'profiles';
