CREATE TYPE public.job_status AS ENUM ('draft','open','on_hold','closed');
CREATE TYPE public.candidate_stage AS ENUM ('applied','screening','interview','offer','hired','rejected');

CREATE TABLE public.job_openings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  location text,
  employment_type text NOT NULL DEFAULT 'full_time',
  status public.job_status NOT NULL DEFAULT 'open',
  openings int NOT NULL DEFAULT 1,
  min_salary numeric,
  max_salary numeric,
  description text,
  requirements text,
  posted_on date NOT NULL DEFAULT current_date,
  closes_on date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.job_openings(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  location text,
  source text,
  resume_url text,
  resume_text text,
  skills text[] NOT NULL DEFAULT '{}',
  experience_years numeric,
  expected_salary numeric,
  stage public.candidate_stage NOT NULL DEFAULT 'applied',
  rating int,
  ai_summary text,
  notes text,
  applied_on date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  duration_minutes int NOT NULL DEFAULT 45,
  mode text NOT NULL DEFAULT 'video',
  interviewer_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  round_name text NOT NULL DEFAULT 'Screening',
  feedback text,
  score int,
  status text NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_candidates_job ON public.candidates(job_id);
CREATE INDEX idx_interviews_candidate ON public.interviews(candidate_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_openings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interviews TO authenticated;
GRANT ALL ON public.job_openings TO service_role;
GRANT ALL ON public.candidates TO service_role;
GRANT ALL ON public.interviews TO service_role;

ALTER TABLE public.job_openings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view jobs" ON public.job_openings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage jobs" ON public.job_openings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));

CREATE POLICY "Staff view candidates" ON public.candidates FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
CREATE POLICY "Staff manage candidates" ON public.candidates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));

CREATE POLICY "Staff view interviews" ON public.interviews FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
CREATE POLICY "Staff manage interviews" ON public.interviews FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));

CREATE TRIGGER trg_job_openings_updated BEFORE UPDATE ON public.job_openings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_candidates_updated BEFORE UPDATE ON public.candidates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_interviews_updated BEFORE UPDATE ON public.interviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
