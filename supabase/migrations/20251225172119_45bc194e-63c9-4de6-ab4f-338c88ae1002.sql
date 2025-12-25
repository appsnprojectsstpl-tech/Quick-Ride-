-- SECURITY FIX: Remove the dangerous "Users can insert their own role" policy
DROP POLICY IF EXISTS "Users can insert their own role" ON public.user_roles;

-- Create a trigger to auto-assign 'rider' role on signup
-- This ensures users cannot self-assign admin/captain roles
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Auto-assign 'rider' role to new users
  -- Admins must manually promote users to 'captain' or 'admin'
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'rider')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users to assign role on signup
DROP TRIGGER IF EXISTS on_auth_user_created_assign_role ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_default_role();

-- Create function for admin to promote users
CREATE OR REPLACE FUNCTION public.promote_user_to_captain(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow admins to call this
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can promote users to captain';
  END IF;
  
  -- Remove rider role and add captain role
  DELETE FROM public.user_roles WHERE user_id = target_user_id AND role = 'rider';
  INSERT INTO public.user_roles (user_id, role) VALUES (target_user_id, 'captain')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;