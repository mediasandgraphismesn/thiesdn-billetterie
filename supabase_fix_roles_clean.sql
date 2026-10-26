CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id::text = auth.uid()::text AND role = 'admin'
  );
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

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

-- Vue publique sanitisée (sans email ni téléphone)
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles 
WITH (security_invoker = false)
AS
  SELECT id, name, username, avatar, role
  FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated, service_role;

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
  AND (role IS NULL OR role = (SELECT p.role FROM public.profiles p WHERE p.id::text = auth.uid()::text))
);
