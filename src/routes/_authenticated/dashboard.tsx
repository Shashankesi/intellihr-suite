import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Bot,
  Building2,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  Clock,
  FileText,
  Gauge,
  LogIn,
  LogOut,
  Megaphone,
  Pin,
  Plus,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useMemo } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { currency, fullName, initials, formatLabel } from "@/components/hr/types";
import { useCurrentEmployee, useProfile, useRoles, useSession } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Nexus HR" },
      {
        name: "description",
        content: "Live workforce overview: headcount, attendance, leave, payroll and announcements.",
      },
      { property: "og:title", content: "Dashboard — Nexus HR" },
      {
        property: "og:description",
        content: "Live workforce overview: headcount, attendance, leave, payroll and announcements.",
      },
    ],
  }),
  component: DashboardPage,
});

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

const PIE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

function DashboardPage() {
  const { user } = useSession();
  const { data: profile } = useProfile(user?.id);
  const { isStaff, primaryRole, isLoading: rolesLoading } = useRoles(user?.id);
  const { data: employee, isLoading: employeeLoading } = useCurrentEmployee(user?.id);

  const firstName = (profile?.full_name || user?.email || "there").split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  if (rolesLoading || employeeLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting}, {firstName}
          </h1>
          <p className="text-[13px] text-muted-foreground">
            {isStaff
              ? "Your organization at a glance — live from your HR workspace."
              : "Your personal workspace — attendance, leave, pay and goals."}
          </p>
        </div>
        <Badge variant="outline" className="w-fit capitalize">
          {formatLabel(primaryRole)} workspace
        </Badge>
      </header>

      {isStaff ? <StaffDashboard /> : <EmployeeDashboard employeeId={employee?.id ?? null} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Staff (admin / HR) dashboard                                        */
/* ------------------------------------------------------------------ */

function useStaffOverview() {
  return useQuery({
    queryKey: ["dashboard-staff"],
    queryFn: async () => {
      const now = new Date();
      const [employees, departments, attendance, leaves, payroll, reviews] = await Promise.all([
        supabase.from("employees").select("id, first_name, last_name, designation, status, department_id, date_of_joining, avatar_url, created_at"),
        supabase.from("departments").select("id, name, code"),
        supabase.from("attendance").select("id, employee_id, work_date, status, worked_minutes").gte("work_date", daysAgo(29)),
        supabase.from("leave_requests").select("id, employee_id, status, start_date, end_date, leave_type, created_at"),
        supabase
          .from("payroll")
          .select("net_pay, status")
          .eq("period_month", now.getMonth() + 1)
          .eq("period_year", now.getFullYear()),
        supabase.from("performance_reviews").select("rating, created_at"),
      ]);

      const err =
        employees.error || departments.error || attendance.error || leaves.error || payroll.error || reviews.error;
      if (err) throw err;

      return {
        employees: employees.data ?? [],
        departments: departments.data ?? [],
        attendance: attendance.data ?? [],
        leaves: leaves.data ?? [],
        payroll: payroll.data ?? [],
        reviews: reviews.data ?? [],
      };
    },
  });
}

function StaffDashboard() {
  const { data, isLoading, isError, refetch } = useStaffOverview();

  const derived = useMemo(() => {
    if (!data) return null;
    const t = today();
    const todaysAttendance = data.attendance.filter((a) => a.work_date === t);
    const present = todaysAttendance.filter((a) => a.status === "present" || a.status === "remote").length;
    const late = todaysAttendance.filter((a) => a.status === "late").length;
    const onLeaveToday = data.leaves.filter(
      (l) => l.status === "approved" && l.start_date <= t && l.end_date >= t,
    ).length;
    const pending = data.leaves.filter((l) => l.status === "pending").length;
    const monthlyPayroll = data.payroll.reduce((sum, p) => sum + Number(p.net_pay ?? 0), 0);
    const avgRating =
      data.reviews.length > 0
        ? data.reviews.reduce((s, r) => s + Number(r.rating ?? 0), 0) / data.reviews.length
        : 0;

    // 14-day attendance trend
    const trend = Array.from({ length: 14 }).map((_, idx) => {
      const date = daysAgo(13 - idx);
      const rows = data.attendance.filter((a) => a.work_date === date);
      return {
        date: new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        present: rows.filter((r) => r.status === "present" || r.status === "remote").length,
        late: rows.filter((r) => r.status === "late").length,
        absent: rows.filter((r) => r.status === "absent").length,
      };
    });

    const byDepartment = data.departments
      .map((d) => ({
        name: d.name,
        value: data.employees.filter((e) => e.department_id === d.id).length,
      }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);

    const distribution = ["active", "probation", "notice", "on_leave", "terminated"].map((status) => ({
      status: formatLabel(status),
      count: data.employees.filter((e) => e.status === status).length,
    }));

    const recentHires = [...data.employees]
      .sort((a, b) => (a.date_of_joining < b.date_of_joining ? 1 : -1))
      .slice(0, 5);

    return {
      present,
      late,
      onLeaveToday,
      pending,
      monthlyPayroll,
      avgRating,
      trend,
      byDepartment,
      distribution,
      recentHires,
      total: data.employees.length,
      departments: data.departments.length,
    };
  }, [data]);

  if (isLoading) return <DashboardSkeleton />;
  if (isError || !derived)
    return (
      <Card className="surface-card flex flex-col items-center gap-3 p-12 text-center">
        <p className="text-sm font-medium">Couldn&apos;t load your workspace data</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Try again
        </Button>
      </Card>
    );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={Users} label="Total employees" value={derived.total} to="/employees" />
        <StatCard icon={Building2} label="Departments" value={derived.departments} to="/departments" />
        <StatCard
          icon={CalendarClock}
          label="Present today"
          value={derived.present}
          hint={derived.late > 0 ? `${derived.late} late` : undefined}
          to="/attendance"
        />
        <StatCard icon={ClipboardList} label="On leave today" value={derived.onLeaveToday} to="/leave" />
        <StatCard
          icon={Wallet}
          label="Payroll this month"
          value={currency(derived.monthlyPayroll)}
          to="/payroll"
        />
        <StatCard icon={Gauge} label="Pending requests" value={derived.pending} to="/leave" />
      </div>

      <QuickActions staff />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="surface-card space-y-4 p-5 lg:col-span-2">
          <SectionHeading
            icon={TrendingUp}
            title="Attendance trends"
            subtitle="Daily presence across the last 14 days"
          />
          {derived.trend.every((d) => d.present + d.late + d.absent === 0) ? (
            <EmptyBlock text="No attendance recorded in the last two weeks." />
          ) : (
            <ChartContainer
              config={
                {
                  present: { label: "Present", color: "hsl(var(--chart-1))" },
                  late: { label: "Late", color: "hsl(var(--chart-4))" },
                  absent: { label: "Absent", color: "hsl(var(--chart-5))" },
                } satisfies ChartConfig
              }
              className="h-[240px] w-full"
            >
              <AreaChart data={derived.trend}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} width={28} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area dataKey="present" stackId="a" stroke="var(--color-present)" fill="var(--color-present)" fillOpacity={0.22} />
                <Area dataKey="late" stackId="a" stroke="var(--color-late)" fill="var(--color-late)" fillOpacity={0.22} />
                <Area dataKey="absent" stackId="a" stroke="var(--color-absent)" fill="var(--color-absent)" fillOpacity={0.22} />
              </AreaChart>
            </ChartContainer>
          )}
        </Card>

        <Card className="surface-card space-y-4 p-5">
          <SectionHeading icon={Building2} title="Employee distribution" subtitle="Headcount by department" />
          {derived.byDepartment.length === 0 ? (
            <EmptyBlock text="No departments with employees yet." />
          ) : (
            <ChartContainer config={{ value: { label: "Employees" } }} className="h-[240px] w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                <Pie data={derived.byDepartment} dataKey="value" nameKey="name" innerRadius={48} outerRadius={82} paddingAngle={2}>
                  {derived.byDepartment.map((entry, i) => (
                    <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="surface-card space-y-4 p-5">
          <SectionHeading icon={Users} title="Workforce status" subtitle="Employees by employment status" />
          <ChartContainer
            config={{ count: { label: "Employees", color: "hsl(var(--chart-2))" } }}
            className="h-[200px] w-full"
          >
            <BarChart data={derived.distribution}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="status" tickLine={false} axisLine={false} fontSize={10} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} width={24} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </Card>

        <AnnouncementsPanel />
        <HolidaysPanel />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ActivityPanel />
        <Card className="surface-card space-y-4 p-5">
          <SectionHeading icon={Users} title="Recent employees" subtitle="Latest people to join" />
          {derived.recentHires.length === 0 ? (
            <EmptyBlock text="No employees added yet." />
          ) : (
            <ul className="space-y-2.5">
              {derived.recentHires.map((e) => (
                <li key={e.id}>
                  <Link
                    to="/employees/$employeeId"
                    params={{ employeeId: e.id }}
                    className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/60"
                  >
                    <Avatar className="size-8">
                      <AvatarFallback className="text-[11px]">{initials(e)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{fullName(e)}</p>
                      <p className="truncate text-[12px] text-muted-foreground">{e.designation || "—"}</p>
                    </div>
                    <span className="shrink-0 text-[12px] text-muted-foreground">
                      {new Date(e.date_of_joining).toLocaleDateString()}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Employee dashboard                                                  */
/* ------------------------------------------------------------------ */

function EmployeeDashboard({ employeeId }: { employeeId: string | null }) {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard-employee", employeeId],
    enabled: Boolean(employeeId),
    queryFn: async () => {
      const now = new Date();
      const [attendance, balances, leaves, goals, payroll] = await Promise.all([
        supabase
          .from("attendance")
          .select("id, work_date, status, worked_minutes, clock_in, clock_out")
          .eq("employee_id", employeeId!)
          .gte("work_date", daysAgo(29))
          .order("work_date", { ascending: false }),
        supabase.from("leave_balances").select("*").eq("employee_id", employeeId!).eq("year", now.getFullYear()),
        supabase
          .from("leave_requests")
          .select("id, leave_type, status, start_date, end_date, days")
          .eq("employee_id", employeeId!)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase.from("goals").select("*").eq("employee_id", employeeId!).order("target_date"),
        supabase
          .from("payroll")
          .select("net_pay, period_month, period_year, status")
          .eq("employee_id", employeeId!)
          .order("period_year", { ascending: false })
          .order("period_month", { ascending: false })
          .limit(6),
      ]);
      const err = attendance.error || balances.error || leaves.error || goals.error || payroll.error;
      if (err) throw err;
      return {
        attendance: attendance.data ?? [],
        balances: balances.data ?? [],
        leaves: leaves.data ?? [],
        goals: goals.data ?? [],
        payroll: payroll.data ?? [],
      };
    },
  });

  const todayRecord = data?.attendance.find((a) => a.work_date === today()) ?? null;

  const clock = useMutation({
    mutationFn: async (action: "in" | "out") => {
      if (!employeeId) throw new Error("No employee record linked to your account");
      const nowIso = new Date().toISOString();
      if (action === "in") {
        if (todayRecord) throw new Error("You have already clocked in today");
        const { error } = await supabase.from("attendance").insert({
          employee_id: employeeId,
          work_date: today(),
          clock_in: nowIso,
          status: new Date().getHours() >= 10 ? "late" : "present",
        });
        if (error) throw error;
      } else {
        if (!todayRecord?.clock_in) throw new Error("Clock in first");
        const worked = Math.max(
          0,
          Math.round((Date.now() - new Date(todayRecord.clock_in).getTime()) / 60000),
        );
        const { error } = await supabase
          .from("attendance")
          .update({ clock_out: nowIso, worked_minutes: worked })
          .eq("id", todayRecord.id);
        if (error) throw error;
      }
    },
    onSuccess: (_r, action) => {
      toast.success(action === "in" ? "Clocked in — have a great day" : "Clocked out. See you tomorrow!");
      queryClient.invalidateQueries({ queryKey: ["dashboard-employee"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Something went wrong"),
  });

  if (!employeeId) {
    return (
      <Card className="surface-card flex flex-col items-center gap-2 p-12 text-center">
        <Users className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium">No employee record linked yet</p>
        <p className="text-[13px] text-muted-foreground">
          Ask your HR admin to link your account to an employee profile to unlock attendance, leave and payroll.
        </p>
      </Card>
    );
  }

  if (isLoading) return <DashboardSkeleton />;
  if (isError || !data)
    return (
      <Card className="surface-card flex flex-col items-center gap-3 p-12 text-center">
        <p className="text-sm font-medium">Couldn&apos;t load your data</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Try again
        </Button>
      </Card>
    );

  const monthMinutes = data.attendance.reduce((s, a) => s + (a.worked_minutes ?? 0), 0);
  const presentDays = data.attendance.filter((a) => a.status !== "absent").length;
  const pendingLeaves = data.leaves.filter((l) => l.status === "pending").length;
  const latestPay = data.payroll[0];

  const hoursTrend = [...data.attendance]
    .slice(0, 14)
    .reverse()
    .map((a) => ({
      date: new Date(a.work_date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      hours: Number(((a.worked_minutes ?? 0) / 60).toFixed(2)),
    }));

  return (
    <div className="space-y-6">
      <Card className="surface-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5">
            <Clock className="size-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">
              {todayRecord?.clock_out
                ? "Day complete"
                : todayRecord
                  ? "You're clocked in"
                  : "You haven't clocked in yet"}
            </p>
            <p className="text-[13px] text-muted-foreground">
              {todayRecord?.clock_in
                ? `Started at ${new Date(todayRecord.clock_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              {todayRecord?.clock_out
                ? ` · ${(todayRecord.worked_minutes / 60).toFixed(1)}h logged`
                : ""}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => clock.mutate("in")}
            disabled={Boolean(todayRecord) || clock.isPending}
            className="gap-2"
          >
            <LogIn className="size-4" /> Clock in
          </Button>
          <Button
            variant="outline"
            onClick={() => clock.mutate("out")}
            disabled={!todayRecord || Boolean(todayRecord.clock_out) || clock.isPending}
            className="gap-2"
          >
            <LogOut className="size-4" /> Clock out
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={CalendarClock} label="Days present (30d)" value={presentDays} to="/attendance" />
        <StatCard icon={Clock} label="Hours logged (30d)" value={`${(monthMinutes / 60).toFixed(1)}h`} to="/attendance" />
        <StatCard icon={ClipboardList} label="Pending leave" value={pendingLeaves} to="/leave" />
        <StatCard
          icon={Wallet}
          label="Latest net pay"
          value={latestPay ? currency(Number(latestPay.net_pay)) : "—"}
          to="/payroll"
        />
      </div>

      <QuickActions />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="surface-card space-y-4 p-5 lg:col-span-2">
          <SectionHeading icon={TrendingUp} title="Your working hours" subtitle="Last 14 recorded days" />
          {hoursTrend.length === 0 ? (
            <EmptyBlock text="No attendance recorded yet. Clock in to start tracking." />
          ) : (
            <ChartContainer
              config={{ hours: { label: "Hours", color: "hsl(var(--chart-1))" } }}
              className="h-[220px] w-full"
            >
              <BarChart data={hoursTrend}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} width={28} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="hours" fill="var(--color-hours)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </Card>

        <Card className="surface-card space-y-4 p-5">
          <SectionHeading icon={ClipboardList} title="Leave balance" subtitle={`${new Date().getFullYear()} entitlements`} />
          {data.balances.length === 0 ? (
            <EmptyBlock text="No leave balances allocated yet." />
          ) : (
            <div className="space-y-3">
              {data.balances.map((b) => {
                const entitled = Number(b.entitled) || 0;
                const used = Number(b.used) || 0;
                const pct = entitled > 0 ? Math.min(100, (used / entitled) * 100) : 0;
                return (
                  <div key={b.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-[13px]">
                      <span>{formatLabel(b.leave_type)}</span>
                      <span className="text-muted-foreground">
                        {used} / {entitled}
                      </span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="surface-card space-y-4 p-5">
          <SectionHeading icon={Gauge} title="Your goals" subtitle="Progress toward targets" />
          {data.goals.length === 0 ? (
            <EmptyBlock text="No goals assigned yet." />
          ) : (
            <div className="space-y-3">
              {data.goals.slice(0, 5).map((g) => (
                <div key={g.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="truncate">{g.title}</span>
                    <span className="shrink-0 text-muted-foreground">{g.progress}%</span>
                  </div>
                  <Progress value={g.progress} className="h-1.5" />
                </div>
              ))}
            </div>
          )}
        </Card>
        <AnnouncementsPanel />
        <HolidaysPanel />
      </div>

      <Card className="surface-card space-y-4 p-5">
        <SectionHeading icon={ClipboardList} title="Recent leave requests" subtitle="Your latest submissions" />
        {data.leaves.length === 0 ? (
          <EmptyBlock text="You haven't requested any leave yet." />
        ) : (
          <ul className="divide-y divide-border">
            {data.leaves.map((l) => (
              <li key={l.id} className="flex items-center justify-between py-2.5 text-[13px]">
                <div>
                  <p className="font-medium">{formatLabel(l.leave_type)}</p>
                  <p className="text-[12px] text-muted-foreground">
                    {new Date(l.start_date).toLocaleDateString()} → {new Date(l.end_date).toLocaleDateString()} ·{" "}
                    {l.days} day(s)
                  </p>
                </div>
                <Badge
                  variant={
                    l.status === "approved"
                      ? "default"
                      : l.status === "rejected"
                        ? "destructive"
                        : l.status === "cancelled"
                          ? "outline"
                          : "secondary"
                  }
                >
                  {formatLabel(l.status)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared panels                                                       */
/* ------------------------------------------------------------------ */

function AnnouncementsPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("id, title, body, priority, pinned, publish_at")
        .eq("published", true)
        .lte("publish_at", new Date().toISOString())
        .order("pinned", { ascending: false })
        .order("publish_at", { ascending: false })
        .limit(4);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Card className="surface-card space-y-4 p-5">
      <SectionHeading icon={Megaphone} title="Announcements" subtitle="Latest company news" to="/announcements" />
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyBlock text="No announcements yet." />
      ) : (
        <ul className="space-y-3">
          {data.map((a) => (
            <li key={a.id} className="space-y-1">
              <div className="flex items-center gap-1.5">
                {a.pinned && <Pin className="size-3 text-primary" />}
                <p className="truncate text-[13px] font-medium">{a.title}</p>
                {a.priority !== "normal" && (
                  <Badge variant={a.priority === "urgent" ? "destructive" : "secondary"} className="text-[10px]">
                    {formatLabel(a.priority)}
                  </Badge>
                )}
              </div>
              <p className="line-clamp-2 text-[12px] text-muted-foreground">{a.body}</p>
              <p className="text-[11px] text-muted-foreground">
                {formatDistanceToNow(new Date(a.publish_at), { addSuffix: true })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function HolidaysPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-holidays"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("holidays")
        .select("id, name, holiday_date, type")
        .gte("holiday_date", today())
        .order("holiday_date")
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Card className="surface-card space-y-4 p-5">
      <SectionHeading icon={CalendarDays} title="Upcoming holidays" subtitle="Company calendar" to="/announcements" />
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyBlock text="No upcoming holidays scheduled." />
      ) : (
        <ul className="space-y-2.5">
          {data.map((h) => {
            const date = new Date(h.holiday_date);
            return (
              <li key={h.id} className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 flex-col items-center justify-center rounded-lg border border-border bg-muted/40">
                  <span className="text-[10px] uppercase text-muted-foreground">
                    {date.toLocaleDateString(undefined, { month: "short" })}
                  </span>
                  <span className="text-[13px] font-semibold leading-none">{date.getDate()}</span>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium">{h.name}</p>
                  <p className="text-[11px] text-muted-foreground">{formatLabel(h.type)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function ActivityPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-activity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_events")
        .select("id, title, description, kind, actor_name, created_at")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Card className="surface-card space-y-4 p-5">
      <SectionHeading icon={Activity} title="Recent activity" subtitle="What's happening across the org" />
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyBlock text="No activity recorded yet. Actions across the workspace will appear here." />
      ) : (
        <ul className="space-y-3">
          {data.map((e) => (
            <li key={e.id} className="flex gap-3">
              <div className="mt-0.5 rounded-lg bg-muted p-1.5">
                <FileText className="size-3.5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-medium">{e.title}</p>
                {e.description && <p className="truncate text-[12px] text-muted-foreground">{e.description}</p>}
                <p className="text-[11px] text-muted-foreground">
                  {e.actor_name ? `${e.actor_name} · ` : ""}
                  {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  to,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  hint?: string;
  to?: string;
}) {
  const body = (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("surface-card h-full space-y-2 p-4", to && "hover-lift cursor-pointer")}
    >
      <div className="flex items-center justify-between">
        <Icon className="size-4 text-primary" />
        {to && <ArrowRight className="size-3.5 text-muted-foreground" />}
      </div>
      <div>
        <p className="text-xl font-semibold leading-none">{value}</p>
        <p className="mt-1 text-[12px] text-muted-foreground">{label}</p>
        {hint && <p className="mt-0.5 text-[11px] text-amber-500">{hint}</p>}
      </div>
    </motion.div>
  );
  return to ? (
    <Link to={to} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

function QuickActions({ staff = false }: { staff?: boolean }) {
  const actions = staff
    ? [
        { label: "Add employee", to: "/employees", icon: Plus },
        { label: "Review leave", to: "/leave", icon: ClipboardList },
        { label: "Run payroll", to: "/payroll", icon: Wallet },
        { label: "Post announcement", to: "/announcements", icon: Megaphone },
        { label: "AI toolkit", to: "/ai-tools", icon: Bot },
        { label: "Analytics", to: "/analytics", icon: TrendingUp },
      ]
    : [
        { label: "Request leave", to: "/leave", icon: ClipboardList },
        { label: "My attendance", to: "/attendance", icon: CalendarClock },
        { label: "My payslips", to: "/payroll", icon: Wallet },
        { label: "My documents", to: "/documents", icon: FileText },
        { label: "AI toolkit", to: "/ai-tools", icon: Bot },
      ];

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <Button key={a.label} asChild variant="outline" size="sm" className="gap-2">
          <Link to={a.to}>
            <a.icon className="size-3.5" />
            {a.label}
          </Link>
        </Button>
      ))}
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  subtitle,
  to,
}: {
  icon: typeof Users;
  title: string;
  subtitle?: string;
  to?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <div>
          <p className="text-sm font-semibold leading-none">{title}</p>
          {subtitle && <p className="mt-1 text-[12px] text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {to && (
        <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-[12px]">
          <Link to={to}>View all</Link>
        </Button>
      )}
    </div>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-border p-6 text-center text-[12px] text-muted-foreground">
      {text}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-9 w-full max-w-lg rounded-lg" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}
