import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Briefcase,
  CalendarClock,
  Loader2,
  Plus,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useRoles, useSession } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/recruitment")({
  head: () => ({
    meta: [
      { title: "Recruitment — Nexus HR" },
      {
        name: "description",
        content: "Post job openings, track candidates through the hiring pipeline and schedule interviews.",
      },
      { property: "og:title", content: "Recruitment — Nexus HR" },
      {
        property: "og:description",
        content: "Post job openings, track candidates through the hiring pipeline and schedule interviews.",
      },
    ],
  }),
  component: RecruitmentPage,
});

const STAGES = [
  { key: "applied", label: "Applied" },
  { key: "screening", label: "Screening" },
  { key: "interview", label: "Interview" },
  { key: "offer", label: "Offer" },
  { key: "hired", label: "Hired" },
  { key: "rejected", label: "Rejected" },
] as const;

type Stage = (typeof STAGES)[number]["key"];

type Job = {
  id: string;
  title: string;
  location: string | null;
  employment_type: string;
  status: string;
  openings: number;
  min_salary: number | null;
  max_salary: number | null;
  description: string | null;
  posted_on: string;
  department_id: string | null;
};

type Candidate = {
  id: string;
  job_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  location: string | null;
  source: string | null;
  experience_years: number | null;
  expected_salary: number | null;
  stage: Stage;
  applied_on: string;
};

type Interview = {
  id: string;
  candidate_id: string;
  scheduled_at: string;
  round_name: string;
  mode: string;
  status: string;
};

function RecruitmentPage() {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { isStaff } = useRoles(user?.id);

  const [jobOpen, setJobOpen] = useState(false);
  const [candidateOpen, setCandidateOpen] = useState(false);
  const [interviewFor, setInterviewFor] = useState<Candidate | null>(null);
  const [jobFilter, setJobFilter] = useState<string>("all");

  const jobsQuery = useQuery({
    queryKey: ["job_openings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_openings")
        .select("*")
        .order("posted_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Job[];
    },
  });

  const candidatesQuery = useQuery({
    queryKey: ["candidates"],
    enabled: isStaff,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select("*")
        .order("applied_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Candidate[];
    },
  });

  const interviewsQuery = useQuery({
    queryKey: ["interviews"],
    enabled: isStaff,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interviews")
        .select("*")
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Interview[];
    },
  });

  const departmentsQuery = useQuery({
    queryKey: ["departments-lite"],
    queryFn: async () => {
      const { data, error } = await supabase.from("departments").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const jobs = jobsQuery.data ?? [];
  const candidates = useMemo(
    () =>
      (candidatesQuery.data ?? []).filter((c) => jobFilter === "all" || c.job_id === jobFilter),
    [candidatesQuery.data, jobFilter],
  );

  const stats = {
    openRoles: jobs.filter((j) => j.status === "open").length,
    candidates: candidatesQuery.data?.length ?? 0,
    interviews: (interviewsQuery.data ?? []).filter(
      (i) => new Date(i.scheduled_at) >= new Date() && i.status === "scheduled",
    ).length,
    hired: (candidatesQuery.data ?? []).filter((c) => c.stage === "hired").length,
  };

  const createJob = useMutation({
    mutationFn: async (form: FormData) => {
      const payload = {
        title: String(form.get("title") ?? "").trim(),
        department_id: (form.get("department_id") as string) || null,
        location: (form.get("location") as string) || null,
        employment_type: String(form.get("employment_type") ?? "full_time"),
        status: String(form.get("status") ?? "open"),
        openings: Number(form.get("openings") ?? 1),
        min_salary: form.get("min_salary") ? Number(form.get("min_salary")) : null,
        max_salary: form.get("max_salary") ? Number(form.get("max_salary")) : null,
        description: (form.get("description") as string) || null,
        created_by: user?.id ?? null,
      };
      if (!payload.title) throw new Error("Job title is required");
      const { error } = await supabase.from("job_openings").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Job opening published");
      setJobOpen(false);
      queryClient.invalidateQueries({ queryKey: ["job_openings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createCandidate = useMutation({
    mutationFn: async (form: FormData) => {
      const payload = {
        job_id: String(form.get("job_id") ?? ""),
        full_name: String(form.get("full_name") ?? "").trim(),
        email: String(form.get("email") ?? "").trim(),
        phone: (form.get("phone") as string) || null,
        location: (form.get("location") as string) || null,
        source: (form.get("source") as string) || null,
        experience_years: form.get("experience_years") ? Number(form.get("experience_years")) : null,
        expected_salary: form.get("expected_salary") ? Number(form.get("expected_salary")) : null,
      };
      if (!payload.job_id) throw new Error("Pick a job opening");
      if (!payload.full_name || !payload.email) throw new Error("Name and email are required");
      const { error } = await supabase.from("candidates").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Candidate added to the pipeline");
      setCandidateOpen(false);
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const moveStage = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: Stage }) => {
      const { error } = await supabase.from("candidates").update({ stage } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["candidates"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const removeCandidate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("candidates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Candidate removed");
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const scheduleInterview = useMutation({
    mutationFn: async ({ candidate, form }: { candidate: Candidate; form: FormData }) => {
      const when = String(form.get("scheduled_at") ?? "");
      if (!when) throw new Error("Pick a date and time");
      const { error } = await supabase.from("interviews").insert({
        candidate_id: candidate.id,
        scheduled_at: new Date(when).toISOString(),
        round_name: String(form.get("round_name") ?? "Screening"),
        mode: String(form.get("mode") ?? "video"),
        duration_minutes: Number(form.get("duration_minutes") ?? 45),
      } as never);
      if (error) throw error;
      await supabase.from("candidates").update({ stage: "interview" } as never).eq("id", candidate.id);
    },
    onSuccess: () => {
      toast.success("Interview scheduled");
      setInterviewFor(null);
      queryClient.invalidateQueries({ queryKey: ["interviews"] });
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isStaff) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <Card className="p-6">
          <h2 className="text-sm font-semibold">Open roles</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Internal openings you can refer people to.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {jobs
              .filter((j) => j.status === "open")
              .map((job) => (
                <div key={job.id} className="rounded-xl border border-border p-4">
                  <p className="text-sm font-semibold">{job.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {job.location ?? "Remote"} · {job.employment_type.replace("_", " ")}
                  </p>
                </div>
              ))}
            {jobs.length === 0 && (
              <p className="text-sm text-muted-foreground">No openings published yet.</p>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader />
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCandidateOpen(true)}>
            <UserPlus className="size-4" /> Add candidate
          </Button>
          <Button onClick={() => setJobOpen(true)}>
            <Plus className="size-4" /> New job
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Briefcase} label="Open roles" value={stats.openRoles} />
        <StatCard icon={Users} label="Candidates" value={stats.candidates} />
        <StatCard icon={CalendarClock} label="Upcoming interviews" value={stats.interviews} />
        <StatCard icon={UserPlus} label="Hired" value={stats.hired} />
      </div>

      <Tabs defaultValue="pipeline">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="jobs">Job openings</TabsTrigger>
          <TabsTrigger value="interviews">Interviews</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Filter by role</Label>
            <Select value={jobFilter} onValueChange={setJobFilter}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {jobs.map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {candidatesQuery.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              {STAGES.map((stage) => {
                const items = candidates.filter((c) => c.stage === stage.key);
                return (
                  <div key={stage.key} className="rounded-xl border border-border bg-surface/60 p-2.5">
                    <div className="mb-2 flex items-center justify-between px-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {stage.label}
                      </p>
                      <Badge variant="secondary" className="text-[10px]">
                        {items.length}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {items.map((c) => (
                        <motion.div
                          key={c.id}
                          layout
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="rounded-lg border border-border bg-card p-2.5"
                        >
                          <p className="truncate text-[13px] font-medium">{c.full_name}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{c.email}</p>
                          <p className="mt-1 truncate text-[11px] text-muted-foreground">
                            {jobs.find((j) => j.id === c.job_id)?.title ?? "—"}
                          </p>
                          <Select
                            value={c.stage}
                            onValueChange={(v) => moveStage.mutate({ id: c.id, stage: v as Stage })}
                          >
                            <SelectTrigger className="mt-2 h-7 text-[11px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STAGES.map((s) => (
                                <SelectItem key={s.key} value={s.key}>
                                  {s.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="mt-1.5 flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 flex-1 text-[11px]"
                              onClick={() => setInterviewFor(c)}
                            >
                              <CalendarClock className="size-3.5" /> Interview
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7 text-destructive"
                              onClick={() => removeCandidate.mutate(c.id)}
                              aria-label="Remove candidate"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                      {items.length === 0 && (
                        <p className="px-1 py-3 text-[11px] text-muted-foreground">Empty</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="jobs" className="mt-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {jobsQuery.isLoading && <Skeleton className="h-32 w-full" />}
            {jobs.map((job) => (
              <Card key={job.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{job.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {job.location ?? "Remote"} · {job.employment_type.replace("_", " ")}
                    </p>
                  </div>
                  <Badge
                    className={cn(
                      "capitalize",
                      job.status === "open" && "bg-success text-success-foreground",
                    )}
                    variant={job.status === "open" ? "default" : "secondary"}
                  >
                    {job.status.replace("_", " ")}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {job.openings} opening{job.openings === 1 ? "" : "s"} ·{" "}
                  {(candidatesQuery.data ?? []).filter((c) => c.job_id === job.id).length} candidates
                </p>
                {(job.min_salary || job.max_salary) && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Budget: {job.min_salary ?? "—"} – {job.max_salary ?? "—"}
                  </p>
                )}
              </Card>
            ))}
            {!jobsQuery.isLoading && jobs.length === 0 && (
              <p className="text-sm text-muted-foreground">No job openings yet.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="interviews" className="mt-4">
          <Card className="divide-y divide-border">
            {(interviewsQuery.data ?? []).map((iv) => {
              const c = (candidatesQuery.data ?? []).find((x) => x.id === iv.candidate_id);
              return (
                <div key={iv.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <div>
                    <p className="text-sm font-medium">{c?.full_name ?? "Candidate"}</p>
                    <p className="text-xs text-muted-foreground">
                      {iv.round_name} · {iv.mode}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(iv.scheduled_at).toLocaleString()}
                  </p>
                </div>
              );
            })}
            {(interviewsQuery.data ?? []).length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">No interviews scheduled.</p>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* New job dialog */}
      <Dialog open={jobOpen} onOpenChange={setJobOpen}>
        <DialogContent className="max-w-lg">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createJob.mutate(new FormData(e.currentTarget));
            }}
          >
            <DialogHeader>
              <DialogTitle>New job opening</DialogTitle>
              <DialogDescription>Publish a role and start collecting candidates.</DialogDescription>
            </DialogHeader>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Title" className="sm:col-span-2">
                <Input name="title" placeholder="Senior Backend Engineer" required />
              </Field>
              <Field label="Department">
                <Select name="department_id">
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {(departmentsQuery.data ?? []).map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Location">
                <Input name="location" placeholder="Bengaluru / Remote" />
              </Field>
              <Field label="Employment type">
                <Select name="employment_type" defaultValue="full_time">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Full time</SelectItem>
                    <SelectItem value="part_time">Part time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="intern">Intern</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Status">
                <Select name="status" defaultValue="open">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="on_hold">On hold</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Openings">
                <Input name="openings" type="number" min={1} defaultValue={1} />
              </Field>
              <Field label="Salary range">
                <div className="flex gap-2">
                  <Input name="min_salary" type="number" placeholder="Min" />
                  <Input name="max_salary" type="number" placeholder="Max" />
                </div>
              </Field>
              <Field label="Description" className="sm:col-span-2">
                <Textarea name="description" rows={3} placeholder="Role summary and responsibilities" />
              </Field>
            </div>
            <DialogFooter className="mt-5">
              <Button type="submit" disabled={createJob.isPending}>
                {createJob.isPending && <Loader2 className="size-4 animate-spin" />} Publish
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add candidate dialog */}
      <Dialog open={candidateOpen} onOpenChange={setCandidateOpen}>
        <DialogContent className="max-w-lg">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createCandidate.mutate(new FormData(e.currentTarget));
            }}
          >
            <DialogHeader>
              <DialogTitle>Add candidate</DialogTitle>
              <DialogDescription>Add an applicant to a job pipeline.</DialogDescription>
            </DialogHeader>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Job opening" className="sm:col-span-2">
                <Select name="job_id">
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobs.map((j) => (
                      <SelectItem key={j.id} value={j.id}>
                        {j.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Full name">
                <Input name="full_name" required />
              </Field>
              <Field label="Email">
                <Input name="email" type="email" required />
              </Field>
              <Field label="Phone">
                <Input name="phone" />
              </Field>
              <Field label="Location">
                <Input name="location" />
              </Field>
              <Field label="Source">
                <Input name="source" placeholder="LinkedIn, referral…" />
              </Field>
              <Field label="Experience (years)">
                <Input name="experience_years" type="number" step="0.5" min={0} />
              </Field>
              <Field label="Expected salary" className="sm:col-span-2">
                <Input name="expected_salary" type="number" />
              </Field>
            </div>
            <DialogFooter className="mt-5">
              <Button type="submit" disabled={createCandidate.isPending}>
                {createCandidate.isPending && <Loader2 className="size-4 animate-spin" />} Add
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Schedule interview dialog */}
      <Dialog open={!!interviewFor} onOpenChange={(o) => !o && setInterviewFor(null)}>
        <DialogContent className="max-w-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (interviewFor)
                scheduleInterview.mutate({ candidate: interviewFor, form: new FormData(e.currentTarget) });
            }}
          >
            <DialogHeader>
              <DialogTitle>Schedule interview</DialogTitle>
              <DialogDescription>{interviewFor?.full_name}</DialogDescription>
            </DialogHeader>
            <div className="mt-4 grid gap-3">
              <Field label="Date & time">
                <Input name="scheduled_at" type="datetime-local" required />
              </Field>
              <Field label="Round">
                <Input name="round_name" defaultValue="Screening" />
              </Field>
              <Field label="Mode">
                <Select name="mode" defaultValue="video">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="onsite">Onsite</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Duration (minutes)">
                <Input name="duration_minutes" type="number" defaultValue={45} min={15} />
              </Field>
            </div>
            <DialogFooter className="mt-5">
              <Button type="submit" disabled={scheduleInterview.isPending}>
                {scheduleInterview.isPending && <Loader2 className="size-4 animate-spin" />} Schedule
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PageHeader() {
  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Recruitment</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Job openings, candidate pipeline and interview scheduling.
      </p>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Briefcase;
  label: string;
  value: number;
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
        <Icon className="size-4" />
      </span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold">{value}</p>
      </div>
    </Card>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
