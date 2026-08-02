-- =============== ANNOUNCEMENTS ===============
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  audience text NOT NULL DEFAULT 'all',
  priority text NOT NULL DEFAULT 'normal',
  pinned boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT true,
  publish_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  author_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY announcements_select ON public.announcements FOR SELECT TO authenticated
  USING (published OR public.is_staff(auth.uid()));
CREATE POLICY announcements_write_staff ON public.announcements FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER announcements_set_updated_at BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX announcements_publish_idx ON public.announcements (pinned DESC, publish_at DESC);

-- =============== HOLIDAYS ===============
CREATE TABLE public.holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  holiday_date date NOT NULL,
  type text NOT NULL DEFAULT 'public',
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, holiday_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.holidays TO authenticated;
GRANT ALL ON public.holidays TO service_role;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY holidays_select ON public.holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY holidays_write_staff ON public.holidays FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER holidays_set_updated_at BEFORE UPDATE ON public.holidays
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============== COMPANY SETTINGS ===============
CREATE TABLE public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  company_name text NOT NULL DEFAULT 'Nexus HR',
  legal_name text,
  logo_url text,
  website text,
  support_email text,
  phone text,
  address text,
  timezone text NOT NULL DEFAULT 'UTC',
  currency text NOT NULL DEFAULT 'USD',
  fiscal_year_start integer NOT NULL DEFAULT 1,
  work_days integer[] NOT NULL DEFAULT '{1,2,3,4,5}',
  work_start time NOT NULL DEFAULT '09:00',
  work_end time NOT NULL DEFAULT '18:00',
  late_grace_minutes integer NOT NULL DEFAULT 15,
  default_casual_leave numeric NOT NULL DEFAULT 12,
  default_sick_leave numeric NOT NULL DEFAULT 8,
  default_earned_leave numeric NOT NULL DEFAULT 15,
  require_leave_approval boolean NOT NULL DEFAULT true,
  allow_self_attendance boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY company_settings_select ON public.company_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY company_settings_write_admin ON public.company_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER company_settings_set_updated_at BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.company_settings (singleton) VALUES (true);

-- =============== ACTIVITY EVENTS ===============
CREATE TABLE public.activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_name text,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'general',
  title text NOT NULL,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.activity_events TO authenticated;
GRANT ALL ON public.activity_events TO service_role;
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY activity_select ON public.activity_events FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR employee_id = public.current_employee_id() OR actor_id = auth.uid());
CREATE POLICY activity_insert ON public.activity_events FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());
CREATE INDEX activity_events_created_idx ON public.activity_events (created_at DESC);
CREATE INDEX activity_events_employee_idx ON public.activity_events (employee_id, created_at DESC);

-- =============== DOCUMENTS EXTRAS ===============
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS file_size bigint,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER documents_set_updated_at BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY documents_update ON public.documents FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_staff(auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR public.is_staff(auth.uid()));

-- =============== STORAGE POLICIES ===============
CREATE POLICY "avatars_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');
CREATE POLICY "avatars_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_staff(auth.uid())));
CREATE POLICY "avatars_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_staff(auth.uid())));
CREATE POLICY "avatars_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_staff(auth.uid())));

CREATE POLICY "hrdocs_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'hr-documents' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_staff(auth.uid())));
CREATE POLICY "hrdocs_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'hr-documents' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_staff(auth.uid())));
CREATE POLICY "hrdocs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'hr-documents' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_staff(auth.uid())));