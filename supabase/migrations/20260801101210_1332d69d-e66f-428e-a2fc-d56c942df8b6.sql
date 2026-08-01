-- 1. Workspace invite codes
CREATE TABLE public.workspace_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  role public.app_role NOT NULL DEFAULT 'employee',
  email text,
  note text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  used_at timestamptz,
  used_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_invites TO authenticated;
GRANT ALL ON public.workspace_invites TO service_role;

ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_invites_select_staff ON public.workspace_invites
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY workspace_invites_insert_admin ON public.workspace_invites
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND created_by = auth.uid());
CREATE POLICY workspace_invites_update_admin ON public.workspace_invites
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY workspace_invites_delete_admin ON public.workspace_invites
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER workspace_invites_updated_at BEFORE UPDATE ON public.workspace_invites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Redeem an invite code for the calling user
CREATE OR REPLACE FUNCTION public.redeem_invite_code(_code text)
RETURNS public.app_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.workspace_invites%ROWTYPE;
  uid uuid := auth.uid();
  uemail text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO inv FROM public.workspace_invites
   WHERE upper(code) = upper(trim(_code)) FOR UPDATE;

  IF inv.id IS NULL THEN
    RAISE EXCEPTION 'Invalid access code';
  END IF;
  IF inv.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'This access code has already been used';
  END IF;
  IF inv.expires_at < now() THEN
    RAISE EXCEPTION 'This access code has expired';
  END IF;

  SELECT email INTO uemail FROM public.profiles WHERE id = uid;
  IF inv.email IS NOT NULL AND lower(inv.email) <> lower(coalesce(uemail, '')) THEN
    RAISE EXCEPTION 'This access code is reserved for a different email address';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (uid, inv.role)
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.workspace_invites
     SET used_at = now(), used_by = uid
   WHERE id = inv.id;

  RETURN inv.role;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_invite_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_invite_code(text) TO authenticated;

-- 3. Admins manage roles
CREATE POLICY user_roles_insert_admin ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY user_roles_delete_admin ON public.user_roles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') AND user_id <> auth.uid());

-- 4. Notifications + audit writes
CREATE POLICY notifications_insert ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE POLICY audit_insert_authenticated ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());