-- ==============================================================================
-- THIÈSDN BILLETTERIE — SÉCURITÉ CRITIQUE RLS, IS_ADMIN & TRIGGER D'INSCRIPTION
-- 1. Fonction is_admin() en PL/PGSQL SECURITY DEFINER (non-récursive)
-- 2. Trigger handle_new_user() en SECURITY DEFINER pour insertion automatique profil
-- 3. Politiques RLS hermétiques sur public.profiles (SELECT, UPDATE, INSERT)
-- ==============================================================================

-- 1. FONCTION HELPER is_admin() SÉCURISÉE EN PL/PGSQL
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT role INTO v_role
  FROM public.profiles
  WHERE id::text = auth.uid()::text
  LIMIT 1;

  RETURN COALESCE(v_role = 'admin', FALSE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

-- 2. TRIGGER CRÉATION DE PROFIL À L'INSCRIPTION
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_role TEXT;
  v_phone TEXT;
BEGIN
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1),
    'Utilisateur'
  );
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'user');
  v_phone := NEW.raw_user_meta_data->>'phone';

  INSERT INTO public.profiles (id, name, email, phone, role, created_at, updated_at)
  VALUES (
    NEW.id,
    v_name,
    LOWER(TRIM(NEW.email)),
    v_phone,
    v_role,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    name = COALESCE(public.profiles.name, EXCLUDED.name),
    phone = COALESCE(public.profiles.phone, EXCLUDED.phone),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. POLITIQUES RLS SUR public.profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- SELECT : Lecture propre, administrateur ou co-producteurs
DROP POLICY IF EXISTS "Profiles select policy" ON public.profiles;
CREATE POLICY "Profiles select policy" ON public.profiles FOR SELECT
USING (
  auth.uid()::text = id::text 
  OR public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.event_coproducers 
    WHERE user_id::text = auth.uid()::text 
      AND promoter_id::text = profiles.id::text
  )
);

-- UPDATE : Modification du profil personnel ou administrateur
DROP POLICY IF EXISTS "Profiles update policy" ON public.profiles;
DROP POLICY IF EXISTS "Admin update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;

CREATE POLICY "Admin update all profiles" ON public.profiles
FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Users update own profile" ON public.profiles
FOR UPDATE
USING (auth.uid()::text = id::text)
WITH CHECK (
  auth.uid()::text = id::text 
  AND (
    role IS NULL 
    OR role = (SELECT p.role FROM public.profiles p WHERE p.id::text = auth.uid()::text)
    OR public.is_admin()
  )
);

-- INSERT : Création de profil (autorisé pour le propriétaire ou admin)
DROP POLICY IF EXISTS "Profiles insert policy" ON public.profiles;
CREATE POLICY "Profiles insert policy" ON public.profiles FOR INSERT
WITH CHECK (
  auth.uid()::text = id::text 
  OR public.is_admin()
);
