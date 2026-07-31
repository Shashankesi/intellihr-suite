-- ============================================================
-- NEXUS HR — core schema
-- ============================================================

CREATE TYPE public.app_role AS ENUM ('admin', 'hr', 'employee');
CREATE TYPE public.employment_status AS ENUM ('active', 'probation', 'notice', 'terminated', 'on_leave');
CREATE TYPE public.employment_type AS ENUM ('full_time', 'part_time', 'contract', 'intern');
CREATE TYPE public.attendance_status AS ENUM ('present', 'late', 'absent', 'half_day', 'remote', 'holiday');
CREATE TYPE public.leave_type AS ENUM ('casual', 'sick', 'earned', 'unpaid', 'maternity', 'paternity', 'bereavement');
CREATE TYPE public.leave_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
CREATE TYPE public.payroll_status AS ENUM ('draft', 'processed', 'paid');

-- shared updated_at trigger fn
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ---------- profiles ----------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  phone TEXT,
  job_title TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  locale TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ---------- roles ----------
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','hr')
  );
$$;

-- ---------- departments ----------
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  head_employee_id UUID,
  budget NUMERIC(14,2) NOT NULL DEFAULT 0,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- ---------- employees ----------
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE,
  employee_code TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  avatar_url TEXT,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  manager_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  designation TEXT NOT NULL DEFAULT '',
  employment_type public.employment_type NOT NULL DEFAULT 'full_time',
  status public.employment_status NOT NULL DEFAULT 'active',
  date_of_joining DATE NOT NULL DEFAULT CURRENT_DATE,
  date_of_birth DATE,
  gender TEXT,
  location TEXT,
  skills TEXT[] NOT NULL DEFAULT '{}',
  base_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  address TEXT,
  emergency_contact TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX employees_department_idx ON public.employees(department_id);
CREATE INDEX employees_status_idx ON public.employees(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.departments
  ADD CONSTRAINT departments_head_fk FOREIGN KEY (head_employee_id)
  REFERENCES public.employees(id) ON DELETE SET NULL;

-- helper: current user's employee row
CREATE OR REPLACE FUNCTION public.current_employee_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ---------- attendance ----------
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL DEFAULT CURRENT_DATE,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  worked_minutes INTEGER NOT NULL DEFAULT 0,
  status public.attendance_status NOT NULL DEFAULT 'present',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, work_date)
);
CREATE INDEX attendance_date_idx ON public.attendance(work_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- ---------- leave ----------
CREATE TABLE public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type public.leave_type NOT NULL DEFAULT 'casual',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days NUMERIC(5,1) NOT NULL DEFAULT 1,
  reason TEXT NOT NULL DEFAULT '',
  status public.leave_status NOT NULL DEFAULT 'pending',
  reviewer_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  review_note TEXT,
  reviewed_at TIMESTAMPTZ,
  ai_classification TEXT,
  ai_recommendation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX leave_requests_employee_idx ON public.leave_requests(employee_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_requests TO authenticated;
GRANT ALL ON public.leave_requests TO service_role;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type public.leave_type NOT NULL,
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  entitled NUMERIC(5,1) NOT NULL DEFAULT 0,
  used NUMERIC(5,1) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, leave_type, year)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_balances TO authenticated;
GRANT ALL ON public.leave_balances TO service_role;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

-- ---------- payroll ----------
CREATE TABLE public.payroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  period_month INTEGER NOT NULL,
  period_year INTEGER NOT NULL,
  basic NUMERIC(12,2) NOT NULL DEFAULT 0,
  hra NUMERIC(12,2) NOT NULL DEFAULT 0,
  allowances NUMERIC(12,2) NOT NULL DEFAULT 0,
  bonus NUMERIC(12,2) NOT NULL DEFAULT 0,
  deductions NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_pay NUMERIC(12,2) NOT NULL DEFAULT 0,
  status public.payroll_status NOT NULL DEFAULT 'draft',
  paid_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, period_month, period_year)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll TO authenticated;
GRANT ALL ON public.payroll TO service_role;
ALTER TABLE public.payroll ENABLE ROW LEVEL SECURITY;

-- ---------- performance ----------
CREATE TABLE public.performance_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  period TEXT NOT NULL,
  rating NUMERIC(3,1) NOT NULL DEFAULT 0,
  strengths TEXT,
  improvements TEXT,
  summary TEXT,
  ai_generated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_reviews TO authenticated;
GRANT ALL ON public.performance_reviews TO service_role;
ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_date DATE,
  progress INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_progress',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

-- ---------- notifications ----------
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ---------- documents ----------
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  storage_path TEXT,
  content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- ---------- audit ----------
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_created_idx ON public.audit_logs(created_at DESC);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- profiles
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- user_roles (read own or staff; writes are service-role/admin only)
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- departments
CREATE POLICY "departments_select_all" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "departments_write_staff" ON public.departments FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- employees
CREATE POLICY "employees_select" ON public.employees FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "employees_write_staff" ON public.employees FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- attendance
CREATE POLICY "attendance_select" ON public.attendance FOR SELECT TO authenticated
  USING (employee_id = public.current_employee_id() OR public.is_staff(auth.uid()));
CREATE POLICY "attendance_insert_own" ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.current_employee_id() OR public.is_staff(auth.uid()));
CREATE POLICY "attendance_update_own" ON public.attendance FOR UPDATE TO authenticated
  USING (employee_id = public.current_employee_id() OR public.is_staff(auth.uid()))
  WITH CHECK (employee_id = public.current_employee_id() OR public.is_staff(auth.uid()));
CREATE POLICY "attendance_delete_staff" ON public.attendance FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));

-- leave requests
CREATE POLICY "leave_select" ON public.leave_requests FOR SELECT TO authenticated
  USING (employee_id = public.current_employee_id() OR public.is_staff(auth.uid()));
CREATE POLICY "leave_insert_own" ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.current_employee_id() OR public.is_staff(auth.uid()));
CREATE POLICY "leave_update" ON public.leave_requests FOR UPDATE TO authenticated
  USING (
    (employee_id = public.current_employee_id() AND status = 'pending')
    OR public.is_staff(auth.uid())
  )
  WITH CHECK (employee_id = public.current_employee_id() OR public.is_staff(auth.uid()));
CREATE POLICY "leave_delete_staff" ON public.leave_requests FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));

-- leave balances
CREATE POLICY "leave_balances_select" ON public.leave_balances FOR SELECT TO authenticated
  USING (employee_id = public.current_employee_id() OR public.is_staff(auth.uid()));
CREATE POLICY "leave_balances_write_staff" ON public.leave_balances FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- payroll
CREATE POLICY "payroll_select" ON public.payroll FOR SELECT TO authenticated
  USING (employee_id = public.current_employee_id() OR public.is_staff(auth.uid()));
CREATE POLICY "payroll_write_staff" ON public.payroll FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- performance
CREATE POLICY "reviews_select" ON public.performance_reviews FOR SELECT TO authenticated
  USING (employee_id = public.current_employee_id() OR public.is_staff(auth.uid()));
CREATE POLICY "reviews_write_staff" ON public.performance_reviews FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- goals
CREATE POLICY "goals_select" ON public.goals FOR SELECT TO authenticated
  USING (employee_id = public.current_employee_id() OR public.is_staff(auth.uid()));
CREATE POLICY "goals_update_own" ON public.goals FOR UPDATE TO authenticated
  USING (employee_id = public.current_employee_id() OR public.is_staff(auth.uid()))
  WITH CHECK (employee_id = public.current_employee_id() OR public.is_staff(auth.uid()));
CREATE POLICY "goals_write_staff" ON public.goals FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "goals_delete_staff" ON public.goals FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));

-- notifications
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "notifications_delete_own" ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- documents
CREATE POLICY "documents_select" ON public.documents FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "documents_insert_own" ON public.documents FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "documents_delete" ON public.documents FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.is_staff(auth.uid()));

-- audit logs (admins read only; writes via privileged server code)
CREATE POLICY "audit_select_admin" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- Signup handling: profile + default role
-- The very first account becomes the workspace admin; everyone
-- else starts as an employee and must be promoted by an admin.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_first BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN is_first THEN 'admin'::public.app_role ELSE 'employee'::public.app_role END)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at triggers
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_departments_updated BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_employees_updated BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_attendance_updated BEFORE UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_leave_updated BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_leave_bal_updated BEFORE UPDATE ON public.leave_balances FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_payroll_updated BEFORE UPDATE ON public.payroll FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_reviews_updated BEFORE UPDATE ON public.performance_reviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_goals_updated BEFORE UPDATE ON public.goals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
