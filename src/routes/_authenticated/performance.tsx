import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Plus, Sparkles, Star, Target, Trophy } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentEmployee, useRoles, useSession } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/performance")({
  head: () => ({
    meta: [
      { title: "Performance | Nexus HR" },
      { name: "description", content: "Track goals, reviews, and performance ratings across the organization." },
      { property: "og:title", content: "Performance | Nexus HR" },
      { property: "og:description", content: "Track goals, reviews, and performance ratings across the organization." },
    ],
  }),
  component: PerformancePage,
});

type Goal = Database["public"]["Tables"]["goals"]["Row"];
type Review = Database["public"]["Tables"]["performance_reviews"]["Row"];
type EmployeeLite = Pick<
  Database["public"]["Tables"]["employees"]["Row"],
  "id" | "first_name" | "last_name" | "employee_code" | "designation" | "avatar_url"
>;

const GOAL_STATUSES = ["not_started", "in_progress", "completed", "at_risk"] as const;

function initials(first: string, last: string) {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase();
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-4 w-4",
            i < Math.round(rating) ? "fill-primary text-primary" : "text-muted-foreground/30",
          )}
        />
      ))}
      <span className="ml-1.5 text-xs text-muted-foreground">{rating.toFixed(1)}</span>
    </div>
  );
}

function PerformancePage() {
  const { user } = useSession();
  const { isStaff, isLoading: rolesLoading } = useRoles(user?.id);
  const { data: employee, isLoading: employeeLoading } = useCurrentEmployee(user?.id);

  if (rolesLoading || employeeLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-gradient">Performance</h1>
        <p className="text-sm text-muted-foreground">
          {isStaff
            ? "Manage goals and reviews across the organization."
            : "Track your goals and review history."}
        </p>
      </div>

      {isStaff ? (
        <Tabs defaultValue="org-goals" className="space-y-4">
          <TabsList>
            <TabsTrigger value="org-goals">Org goals</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
            <TabsTrigger value="mine">My performance</TabsTrigger>
          </TabsList>
          <TabsContent value="org-goals">
            <OrgGoalsTab />
          </TabsContent>
          <TabsContent value="reviews">
            <OrgReviewsTab />
          </TabsContent>
          <TabsContent value="mine">
            <EmployeePerformanceView employee={employee ?? null} />
          </TabsContent>
        </Tabs>
      ) : (
        <EmployeePerformanceView employee={employee ?? null} />
      )}
    </div>
  );
}

/* --------------------------------------- Employee view --------------------------------------- */

function EmployeePerformanceView({ employee }: { employee: EmployeeLite | null }) {
  const queryClient = useQueryClient();

  const { data: goals, isLoading: goalsLoading } = useQuery({
    queryKey: ["goals", "self", employee?.id],
    enabled: Boolean(employee?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("employee_id", employee!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Goal[];
    },
  });

  const { data: reviews, isLoading: reviewsLoading } = useQuery({
    queryKey: ["performance_reviews", "self", employee?.id],
    enabled: Boolean(employee?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("performance_reviews")
        .select("*")
        .eq("employee_id", employee!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Review[];
    },
  });

  const updateProgress = useMutation({
    mutationFn: async ({ id, progress }: { id: string; progress: number }) => {
      const status = progress >= 100 ? "completed" : progress === 0 ? "not_started" : "in_progress";
      const { error } = await supabase.from("goals").update({ progress, status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals", "self", employee?.id] });
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Failed to update goal"),
  });

  if (!employee) {
    return (
      <Card className="surface-card">
        <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <Target className="h-10 w-10 text-muted-foreground" />
          <p className="font-medium">No linked employee profile</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Your account isn't linked to an employee record yet, so goals and reviews can't be shown.
            Contact HR to get your profile linked.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="surface-card">
        <CardHeader>
          <CardTitle className="text-base">My goals</CardTitle>
          <CardDescription>Drag the slider to update your progress</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {goalsLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : !goals || goals.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No goals assigned yet.</p>
          ) : (
            goals.map((g) => (
              <div key={g.id} className="space-y-2 rounded-xl border border-border/60 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium leading-tight">{g.title}</p>
                    {g.description && <p className="text-xs text-muted-foreground">{g.description}</p>}
                  </div>
                  <Badge variant="outline" className="shrink-0 capitalize">{g.status.replace("_", " ")}</Badge>
                </div>
                <Slider
                  value={[g.progress]}
                  max={100}
                  step={5}
                  onValueChange={(v) =>
                    queryClient.setQueryData<Goal[]>(["goals", "self", employee.id], (old) =>
                      old?.map((og) => (og.id === g.id ? { ...og, progress: v[0] } : og)),
                    )
                  }
                  onValueCommit={(v) => updateProgress.mutate({ id: g.id, progress: v[0] })}
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{g.progress}% complete</span>
                  {g.target_date && <span>Due {format(new Date(g.target_date), "dd MMM yyyy")}</span>}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="surface-card">
        <CardHeader>
          <CardTitle className="text-base">Review history</CardTitle>
          <CardDescription>Feedback from your reviewers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {reviewsLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : !reviews || reviews.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No reviews recorded yet.</p>
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="space-y-2 rounded-xl border border-border/60 p-3.5">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{r.period}</p>
                  <StarRating rating={Number(r.rating)} />
                </div>
                {r.summary && <p className="text-sm text-muted-foreground">{r.summary}</p>}
                <div className="grid gap-2 sm:grid-cols-2">
                  {r.strengths && (
                    <div className="rounded-lg bg-muted/40 p-2 text-xs">
                      <p className="mb-1 font-medium text-foreground">Strengths</p>
                      <p className="text-muted-foreground">{r.strengths}</p>
                    </div>
                  )}
                  {r.improvements && (
                    <div className="rounded-lg bg-muted/40 p-2 text-xs">
                      <p className="mb-1 font-medium text-foreground">Areas to improve</p>
                      <p className="text-muted-foreground">{r.improvements}</p>
                    </div>
                  )}
                </div>
                {r.ai_generated && (
                  <Badge variant="outline" className="gap-1"><Sparkles className="h-3 w-3" /> AI-assisted</Badge>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ----------------------------------------- Staff: goals ----------------------------------------- */

function useAllEmployees() {
  return useQuery({
    queryKey: ["employees", "all-lite"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name, employee_code, designation, avatar_url")
        .order("first_name");
      if (error) throw error;
      return data as EmployeeLite[];
    },
  });
}

function OrgGoalsTab() {
  const queryClient = useQueryClient();
  const { data: employees } = useAllEmployees();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ employee_id: "", title: "", description: "", target_date: "" });

  const { data: goals, isLoading } = useQuery({
    queryKey: ["goals", "org"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select("*, employees(first_name, last_name, employee_code)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as (Goal & { employees: { first_name: string; last_name: string; employee_code: string } | null })[];
    },
  });

  const createGoal = useMutation({
    mutationFn: async () => {
      if (!form.employee_id || !form.title) throw new Error("Employee and title are required");
      const { error } = await supabase.from("goals").insert({
        employee_id: form.employee_id,
        title: form.title,
        description: form.description || null,
        target_date: form.target_date || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals", "org"] });
      toast.success("Goal created");
      setOpen(false);
      setForm({ employee_id: "", title: "", description: "", target_date: "" });
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Failed to create goal"),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-1.5 h-4 w-4" /> New goal</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create goal</DialogTitle>
              <DialogDescription>Assign a goal to any employee</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Employee</Label>
                <Select value={form.employee_id} onValueChange={(v) => setForm((f) => ({ ...f, employee_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>
                    {employees?.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.employee_code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Title</Label>
                <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Target date</Label>
                <Input type="date" value={form.target_date} onChange={(e) => setForm((f) => ({ ...f, target_date: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => createGoal.mutate()} disabled={createGoal.isPending}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="surface-card">
        <CardContent className="pt-6">
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : !goals || goals.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No goals created yet.</p>
          ) : (
            <div className="space-y-3">
              {goals.map((g) => (
                <div key={g.id} className="flex items-center gap-4 rounded-xl border border-border/60 p-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{g.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {g.employees ? `${g.employees.first_name} ${g.employees.last_name} · ${g.employees.employee_code}` : "Unknown employee"}
                    </p>
                  </div>
                  <div className="w-32 shrink-0">
                    <Progress value={g.progress} />
                  </div>
                  <Badge variant="outline" className="shrink-0 capitalize">{g.status.replace("_", " ")}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------------------------------- Staff: reviews ---------------------------------------- */

function OrgReviewsTab() {
  const queryClient = useQueryClient();
  const { data: employees } = useAllEmployees();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Review | null>(null);
  const [form, setForm] = useState({
    employee_id: "",
    period: "",
    rating: 3,
    strengths: "",
    improvements: "",
    summary: "",
  });

  const { data: reviews, isLoading } = useQuery({
    queryKey: ["performance_reviews", "org"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("performance_reviews")
        .select("*, employees(first_name, last_name, employee_code)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as (Review & { employees: { first_name: string; last_name: string; employee_code: string } | null })[];
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ employee_id: "", period: "", rating: 3, strengths: "", improvements: "", summary: "" });
    setOpen(true);
  };

  const openEdit = (r: Review) => {
    setEditing(r);
    setForm({
      employee_id: r.employee_id,
      period: r.period,
      rating: Number(r.rating),
      strengths: r.strengths ?? "",
      improvements: r.improvements ?? "",
      summary: r.summary ?? "",
    });
    setOpen(true);
  };

  const saveReview = useMutation({
    mutationFn: async () => {
      if (!form.employee_id || !form.period) throw new Error("Employee and period are required");
      if (editing) {
        const { error } = await supabase
          .from("performance_reviews")
          .update({
            period: form.period,
            rating: form.rating,
            strengths: form.strengths || null,
            improvements: form.improvements || null,
            summary: form.summary || null,
          })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("performance_reviews").insert({
          employee_id: form.employee_id,
          period: form.period,
          rating: form.rating,
          strengths: form.strengths || null,
          improvements: form.improvements || null,
          summary: form.summary || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["performance_reviews", "org"] });
      toast.success(editing ? "Review updated" : "Review created");
      setOpen(false);
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Failed to save review"),
  });

  const distribution = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0, 0];
    (reviews ?? []).forEach((r) => {
      const bucket = Math.min(5, Math.max(0, Math.round(Number(r.rating))));
      buckets[bucket] += 1;
    });
    return buckets.map((count, rating) => ({ rating: `${rating}★`, count }));
  }, [reviews]);

  const topPerformers = useMemo(() => {
    const map = new Map<string, { name: string; code: string; total: number; count: number }>();
    (reviews ?? []).forEach((r) => {
      const key = r.employee_id;
      const name = r.employees ? `${r.employees.first_name} ${r.employees.last_name}` : "Unknown";
      const code = r.employees?.employee_code ?? "";
      const cur = map.get(key) ?? { name, code, total: 0, count: 0 };
      cur.total += Number(r.rating);
      cur.count += 1;
      map.set(key, cur);
    });
    return [...map.values()]
      .map((v) => ({ ...v, avg: v.total / v.count }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5);
  }, [reviews]);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="surface-card">
          <CardHeader>
            <CardTitle className="text-base">Rating distribution</CardTitle>
            <CardDescription>Across all recorded reviews</CardDescription>
          </CardHeader>
          <CardContent>
            {!reviews || reviews.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No reviews yet.</p>
            ) : (
              <ChartContainer config={{ count: { label: "Reviews", color: "hsl(var(--primary))" } }} className="aspect-auto h-56 w-full">
                <BarChart data={distribution}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="rating" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="surface-card">
          <CardHeader>
            <CardTitle className="text-base">Top performers</CardTitle>
            <CardDescription>Highest average rating</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {topPerformers.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Not enough data yet.</p>
            ) : (
              topPerformers.map((p, i) => (
                <div key={p.name + p.code} className="flex items-center gap-3 rounded-lg border border-border/60 p-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {i === 0 ? <Trophy className="h-3.5 w-3.5" /> : i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.code}</p>
                  </div>
                  <StarRating rating={p.avg} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" /> New review</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit review" : "Create review"}</DialogTitle>
              <DialogDescription>Record structured feedback for an employee</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Employee</Label>
                <Select
                  value={form.employee_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, employee_id: v }))}
                  disabled={Boolean(editing)}
                >
                  <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>
                    {employees?.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.employee_code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Period</Label>
                  <Input placeholder="e.g. Q1 2025" value={form.period} onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Rating (0–5)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={5}
                    step={0.5}
                    value={form.rating}
                    onChange={(e) => setForm((f) => ({ ...f, rating: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Strengths</Label>
                <Textarea value={form.strengths} onChange={(e) => setForm((f) => ({ ...f, strengths: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Areas to improve</Label>
                <Textarea value={form.improvements} onChange={(e) => setForm((f) => ({ ...f, improvements: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Summary</Label>
                <Textarea value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => saveReview.mutate()} disabled={saveReview.isPending}>
                {editing ? "Save changes" : "Create review"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="surface-card">
        <CardHeader>
          <CardTitle className="text-base">All reviews</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : !reviews || reviews.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No reviews recorded yet.</p>
          ) : (
            reviews.map((r) => (
              <div
                key={r.id}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/60 p-3.5 hover:bg-muted/30"
                onClick={() => openEdit(r)}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {r.employees ? `${r.employees.first_name} ${r.employees.last_name}` : "Unknown"} · {r.period}
                  </p>
                  {r.summary && <p className="truncate text-xs text-muted-foreground">{r.summary}</p>}
                </div>
                <StarRating rating={Number(r.rating)} />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
