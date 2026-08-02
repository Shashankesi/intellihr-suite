import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Award,
  Briefcase,
  Building2,
  Cake,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Shield,
  ShieldAlert,
  Sparkles,
  Star,
  Target,
  Trophy,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmployeeFormDialog } from "@/components/hr/employee-form-dialog";
import {
  currency,
  formatLabel,
  fullName,
  initials,
  statusBadgeVariant,
  type EmployeeWithRelations,
} from "@/components/hr/types";
import { useCurrentEmployee, useRoles, useSession } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { generateEmployeeInsights } from "@/lib/employee-ai.functions";
import { cn } from "@/lib/utils";

type Attendance = Database["public"]["Tables"]["attendance"]["Row"];
type LeaveBalance = Database["public"]["Tables"]["leave_balances"]["Row"];
type LeaveRequest = Database["public"]["Tables"]["leave_requests"]["Row"];
type Payroll = Database["public"]["Tables"]["payroll"]["Row"];
type Goal = Database["public"]["Tables"]["goals"]["Row"];
type Review = Database["public"]["Tables"]["performance_reviews"]["Row"];
type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
type ActivityEvent = Database["public"]["Tables"]["activity_events"]["Row"];

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export const Route = createFileRoute("/_authenticated/employees/$employeeId")({
  head: ({ params }) => ({
    meta: [
      { title: "Employee profile — Nexus HR" },
      { name: "description", content: "Deep profile view with attendance, leave, payroll, performance and documents." },
      { property: "og:title", content: "Employee profile — Nexus HR" },
      { property: "og:description", content: `Full profile for employee ${params.employeeId}.` },
    ],
  }),
  component: EmployeeProfilePage,
});

function EmployeeProfilePage() {
  const { employeeId } = Route.useParams();
  const { user } = useSession();
  const { isStaff, isLoading: rolesLoading } = useRoles(user?.id);
  const { data: currentEmployee, isLoading: currentEmployeeLoading } = useCurrentEmployee(user?.id);

  const { data: employee, isLoading, isError } = useQuery({
    queryKey: ["employee-profile", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*, departments(id, name, code), manager:manager_id(id, first_name, last_name)")
        .eq("id", employeeId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as EmployeeWithRelations | null;
    },
  });

  const [editOpen, setEditOpen] = useState(false);

  if (rolesLoading || currentEmployeeLoading || isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !employee) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Card className="surface-card flex flex-col items-center gap-2 p-12 text-center">
          <UserRound className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">Employee not found</p>
          <p className="text-[13px] text-muted-foreground">This record may have been removed.</p>
        </Card>
      </div>
    );
  }

  const isSelf = Boolean(currentEmployee?.id && currentEmployee.id === employee.id);
  const canView = isStaff || isSelf;

  if (!canView) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Card className="surface-card flex flex-col items-center gap-2 p-12 text-center">
          <ShieldAlert className="size-8 text-destructive" />
          <p className="text-sm font-medium">Access denied</p>
          <p className="text-[13px] text-muted-foreground">
            You don't have permission to view this employee's profile.
          </p>
        </Card>
      </div>
    );
  }

  const canViewSalary = isStaff || isSelf;

  return (
    <div className="space-y-6">
      <BackLink />

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="surface-card p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <Avatar className="size-16">
                {employee.avatar_url && <img src={employee.avatar_url} alt={fullName(employee)} className="size-full rounded-full object-cover" />}
                <AvatarFallback className="text-lg">{initials(employee)}</AvatarFallback>
              </Avatar>
              <div className="space-y-1.5">
                <h1 className="text-2xl font-bold tracking-tight">{fullName(employee)}</h1>
                <p className="text-[13px] text-muted-foreground">
                  {employee.designation} · {employee.departments?.name ?? "No department"}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant={statusBadgeVariant(employee.status)}>{formatLabel(employee.status)}</Badge>
                  <Badge variant="outline">{formatLabel(employee.employment_type)}</Badge>
                  <Badge variant="secondary">{employee.employee_code}</Badge>
                </div>
              </div>
            </div>
            {(isStaff || isSelf) && (
              <div className="flex shrink-0 gap-2">
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditOpen(true)}>
                  <Pencil className="size-4" /> Edit
                </Button>
              </div>
            )}
          </div>
        </Card>
      </motion.div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="leaves">Leaves</TabsTrigger>
          {canViewSalary && <TabsTrigger value="payroll">Payroll</TabsTrigger>}
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="ai">AI Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab employee={employee} canViewSalary={canViewSalary} />
        </TabsContent>
        <TabsContent value="attendance">
          <AttendanceTab employeeId={employee.id} />
        </TabsContent>
        <TabsContent value="leaves">
          <LeavesTab employeeId={employee.id} />
        </TabsContent>
        {canViewSalary && (
          <TabsContent value="payroll">
            <PayrollTab employee={employee} />
          </TabsContent>
        )}
        <TabsContent value="performance">
          <PerformanceTab employeeId={employee.id} />
        </TabsContent>
        <TabsContent value="documents">
          <DocumentsTab employeeId={employee.id} />
        </TabsContent>
        <TabsContent value="timeline">
          <TimelineTab employeeId={employee.id} />
        </TabsContent>
        <TabsContent value="ai">
          <AiInsightsTab employeeId={employee.id} />
        </TabsContent>
      </Tabs>

      <EmployeeFormDialog open={editOpen} onOpenChange={setEditOpen} employee={employee} />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/employees"
      className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-3.5" /> Back to directory
    </Link>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: typeof Users; title: string; description: string }) {
  return (
    <Card className="surface-card flex flex-col items-center gap-2 p-10 text-center">
      <Icon className="size-8 text-muted-foreground" />
      <p className="text-sm font-medium">{title}</p>
      <p className="text-[13px] text-muted-foreground">{description}</p>
    </Card>
  );
}

/* ------------------------------------------------------------------ Overview ------------------------------------------------------------------ */

function Info({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-[13px]">{value}</p>
      </div>
    </div>
  );
}

function tenureLabel(dateOfJoining: string) {
  const start = new Date(dateOfJoining);
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  const parts = [];
  if (years > 0) parts.push(`${years}y`);
  parts.push(`${months}m`);
  return parts.join(" ");
}

function OverviewTab({ employee, canViewSalary }: { employee: EmployeeWithRelations; canViewSalary: boolean }) {
  const { data: reports, isLoading } = useQuery({
    queryKey: ["direct-reports", employee.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name, designation, avatar_url")
        .eq("manager_id", employee.id)
        .order("first_name");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="surface-card space-y-4 p-5 lg:col-span-2">
        <p className="text-sm font-semibold">Contact & personal details</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Info icon={Mail} label="Email" value={employee.email} />
          <Info icon={Phone} label="Phone" value={employee.phone ?? "—"} />
          <Info icon={MapPin} label="Location" value={employee.location ?? "—"} />
          <Info icon={Building2} label="Department" value={employee.departments?.name ?? "—"} />
          <Info
            icon={CalendarDays}
            label="Joined"
            value={`${new Date(employee.date_of_joining).toLocaleDateString()} (${tenureLabel(employee.date_of_joining)} tenure)`}
          />
          <Info icon={Cake} label="Date of birth" value={employee.date_of_birth ? new Date(employee.date_of_birth).toLocaleDateString() : "—"} />
          {canViewSalary && <Info icon={Wallet} label="Base salary" value={currency(employee.base_salary)} />}
          <Info
            icon={Briefcase}
            label="Manager"
            value={employee.manager ? fullName(employee.manager) : "—"}
          />
        </div>
        <Separator />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Info icon={MapPin} label="Address" value={employee.address ?? "—"} />
          <Info icon={Shield} label="Emergency contact" value={employee.emergency_contact ?? "—"} />
        </div>
        {employee.manager && (
          <div className="pt-1">
            <Link
              to="/employees/$employeeId"
              params={{ employeeId: employee.manager.id }}
              className="text-[13px] font-medium text-primary hover:underline"
            >
              View manager's profile →
            </Link>
          </div>
        )}
        {employee.skills?.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">Skills</p>
            <div className="flex flex-wrap gap-1.5">
              {employee.skills.map((s) => (
                <Badge key={s} variant="secondary">
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card className="surface-card space-y-3 p-5">
        <p className="text-sm font-semibold">Direct reports</p>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !reports?.length ? (
          <p className="text-[13px] text-muted-foreground">No direct reports.</p>
        ) : (
          <div className="space-y-2">
            {reports.map((r) => (
              <Link
                key={r.id}
                to="/employees/$employeeId"
                params={{ employeeId: r.id }}
                className="flex items-center gap-2.5 rounded-lg border border-border p-2 text-[13px] transition hover:bg-accent"
              >
                <Avatar className="size-8">
                  <AvatarFallback className="text-[11px]">{initials(r)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium leading-tight">{fullName(r)}</p>
                  <p className="text-[12px] text-muted-foreground">{r.designation}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ Attendance ------------------------------------------------------------------ */

function AttendanceTab({ employeeId }: { employeeId: string }) {
  const { data: records, isLoading } = useQuery({
    queryKey: ["employee-attendance", employeeId],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 60);
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("employee_id", employeeId)
        .gte("work_date", since.toISOString().slice(0, 10))
        .order("work_date", { ascending: false });
      if (error) throw error;
      return data as Attendance[];
    },
  });

  const summary = useMemo(() => {
    const list = records ?? [];
    const counts: Record<string, number> = {};
    let totalMinutes = 0;
    for (const r of list) {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
      totalMinutes += r.worked_minutes ?? 0;
    }
    return {
      present: counts["present"] ?? 0,
      late: counts["late"] ?? 0,
      absent: counts["absent"] ?? 0,
      remote: counts["remote"] ?? 0,
      avgHours: list.length ? totalMinutes / list.length / 60 : 0,
    };
  }, [records]);

  const chartData = useMemo(() => {
    return (records ?? [])
      .slice()
      .reverse()
      .map((r) => ({
        date: new Date(r.work_date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        hours: Math.round(((r.worked_minutes ?? 0) / 60) * 10) / 10,
      }));
  }, [records]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!records?.length) {
    return <EmptyState icon={Clock} title="No attendance records" description="No records in the last 60 days." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2.5">
        <StatChip icon={CheckCircle2} label="Present" value={summary.present} />
        <StatChip icon={Clock} label="Late" value={summary.late} />
        <StatChip icon={AlertTriangle} label="Absent" value={summary.absent} />
        <StatChip icon={LogIn} label="Remote" value={summary.remote} />
        <StatChip icon={Activity} label="Avg hrs/day" value={Number(summary.avgHours.toFixed(1))} />
      </div>

      <Card className="surface-card p-5">
        <p className="mb-3 text-sm font-semibold">Daily worked hours</p>
        <ChartContainer config={{ hours: { label: "Hours", color: "hsl(var(--primary))" } }} className="aspect-auto h-64 w-full">
          <AreaChart data={chartData}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area type="monotone" dataKey="hours" stroke="var(--color-hours)" fill="var(--color-hours)" fillOpacity={0.2} />
          </AreaChart>
        </ChartContainer>
      </Card>

      <Card className="surface-card overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Clock in</TableHead>
              <TableHead>Clock out</TableHead>
              <TableHead className="text-right">Worked hours</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.slice(0, 20).map((r) => (
              <TableRow key={r.id}>
                <TableCell>{new Date(r.work_date).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Badge variant="outline">{formatLabel(r.status)}</Badge>
                </TableCell>
                <TableCell className="text-[13px]">{r.clock_in ? new Date(r.clock_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</TableCell>
                <TableCell className="text-[13px]">{r.clock_out ? new Date(r.clock_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</TableCell>
                <TableCell className="text-right text-[13px]">{((r.worked_minutes ?? 0) / 60).toFixed(1)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function StatChip({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <div className="surface-card flex items-center gap-2.5 rounded-xl px-3.5 py-2">
      <Icon className="size-4 text-primary" />
      <div>
        <p className="text-[15px] font-semibold leading-none">{value}</p>
        <p className="text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Leaves ------------------------------------------------------------------ */

function leaveStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "approved":
      return "default";
    case "pending":
      return "secondary";
    case "rejected":
      return "destructive";
    default:
      return "outline";
  }
}

function LeavesTab({ employeeId }: { employeeId: string }) {
  const year = new Date().getFullYear();

  const { data: balances, isLoading: balancesLoading } = useQuery({
    queryKey: ["employee-leave-balances", employeeId, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_balances")
        .select("*")
        .eq("employee_id", employeeId)
        .eq("year", year);
      if (error) throw error;
      return data as LeaveBalance[];
    },
  });

  const { data: requests, isLoading: requestsLoading } = useQuery({
    queryKey: ["employee-leave-requests", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as LeaveRequest[];
    },
  });

  const isLoading = balancesLoading || requestsLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="surface-card p-5">
        <p className="mb-3 text-sm font-semibold">Leave balances — {year}</p>
        {!balances?.length ? (
          <p className="text-[13px] text-muted-foreground">No leave balances configured for this year.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {balances.map((b) => (
              <div key={b.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="font-medium">{formatLabel(b.leave_type)}</span>
                  <span className="text-muted-foreground">
                    {b.used} / {b.entitled} used
                  </span>
                </div>
                <Progress value={b.entitled > 0 ? (b.used / b.entitled) * 100 : 0} />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="surface-card overflow-hidden p-0">
        <div className="border-b border-border p-4">
          <p className="text-sm font-semibold">Leave request history</p>
        </div>
        {!requests?.length ? (
          <EmptyState icon={CalendarClock} title="No leave requests" description="No leave requests have been filed." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{formatLabel(r.leave_type)}</TableCell>
                  <TableCell className="text-[13px]">
                    {new Date(r.start_date).toLocaleDateString()} – {new Date(r.end_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-[13px]">{r.days}</TableCell>
                  <TableCell>
                    <Badge variant={leaveStatusVariant(r.status)}>{formatLabel(r.status)}</Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-[13px] text-muted-foreground">{r.reason}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ Payroll ------------------------------------------------------------------ */

function payrollStatusVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "paid") return "default";
  if (status === "processed") return "secondary";
  return "outline";
}

function buildPayslipHtml(employee: EmployeeWithRelations, row: Payroll) {
  const period = `${MONTHS[row.period_month - 1]} ${row.period_year}`;
  const gross = row.basic + row.allowances + row.hra + row.bonus;
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Payslip — ${fullName(employee)} — ${period}</title>
<style>
  body { font-family: -apple-system, Segoe UI, sans-serif; padding: 40px; color: #111; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .muted { color: #666; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-top: 24px; }
  td, th { padding: 8px 4px; border-bottom: 1px solid #e5e5e5; text-align: left; font-size: 13px; }
  th { color: #666; font-weight: 600; }
  .total { font-weight: 700; font-size: 15px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 16px; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Payslip</h1>
      <p class="muted">Pay period: ${period}</p>
    </div>
    <div style="text-align:right">
      <p><strong>${fullName(employee)}</strong></p>
      <p class="muted">${employee.designation}</p>
      <p class="muted">Employee code: ${employee.employee_code}</p>
    </div>
  </div>
  <table>
    <tr><th>Component</th><th style="text-align:right">Amount</th></tr>
    <tr><td>Basic</td><td style="text-align:right">${currency(row.basic)}</td></tr>
    <tr><td>HRA</td><td style="text-align:right">${currency(row.hra)}</td></tr>
    <tr><td>Allowances</td><td style="text-align:right">${currency(row.allowances)}</td></tr>
    <tr><td>Bonus</td><td style="text-align:right">${currency(row.bonus)}</td></tr>
    <tr><td>Gross pay</td><td style="text-align:right">${currency(gross)}</td></tr>
    <tr><td>Deductions</td><td style="text-align:right">-${currency(row.deductions)}</td></tr>
    <tr><td>Tax</td><td style="text-align:right">-${currency(row.tax)}</td></tr>
    <tr class="total"><td>Net pay</td><td style="text-align:right">${currency(row.net_pay)}</td></tr>
  </table>
  <p class="muted" style="margin-top: 24px;">Status: ${formatLabel(row.status)}${row.paid_on ? ` · Paid on ${new Date(row.paid_on).toLocaleDateString()}` : ""}</p>
</body>
</html>`;
}

function PayrollTab({ employee }: { employee: EmployeeWithRelations }) {
  const { data: rows, isLoading } = useQuery({
    queryKey: ["employee-payroll", employee.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll")
        .select("*")
        .eq("employee_id", employee.id)
        .order("period_year", { ascending: false })
        .order("period_month", { ascending: false });
      if (error) throw error;
      return data as Payroll[];
    },
  });

  const chartData = useMemo(() => {
    return (rows ?? [])
      .slice()
      .reverse()
      .map((r) => ({ period: `${MONTHS[r.period_month - 1]} '${String(r.period_year).slice(2)}`, net: r.net_pay }));
  }, [rows]);

  const handleDownload = (row: Payroll) => {
    const html = buildPayslipHtml(employee, row);
    const win = window.open("", "_blank", "width=800,height=1000");
    if (!win) {
      toast.error("Pop-up blocked. Please allow pop-ups to download payslips.");
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!rows?.length) {
    return <EmptyState icon={Wallet} title="No payroll history" description="No payroll records exist for this employee yet." />;
  }

  return (
    <div className="space-y-4">
      <Card className="surface-card p-5">
        <p className="mb-3 text-sm font-semibold">Net pay over time</p>
        <ChartContainer config={{ net: { label: "Net pay", color: "hsl(var(--primary))" } }} className="aspect-auto h-64 w-full">
          <LineChart data={chartData}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="period" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line type="monotone" dataKey="net" stroke="var(--color-net)" strokeWidth={2} dot={false} />
          </LineChart>
        </ChartContainer>
      </Card>

      <Card className="surface-card overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Basic</TableHead>
              <TableHead className="text-right">Allowances</TableHead>
              <TableHead className="text-right">Deductions</TableHead>
              <TableHead className="text-right">Tax</TableHead>
              <TableHead className="text-right">Net pay</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Payslip</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{MONTHS[r.period_month - 1]} {r.period_year}</TableCell>
                <TableCell className="text-right text-[13px]">{currency(r.basic)}</TableCell>
                <TableCell className="text-right text-[13px]">{currency(r.allowances)}</TableCell>
                <TableCell className="text-right text-[13px]">{currency(r.deductions)}</TableCell>
                <TableCell className="text-right text-[13px]">{currency(r.tax)}</TableCell>
                <TableCell className="text-right text-[13px] font-medium">{currency(r.net_pay)}</TableCell>
                <TableCell>
                  <Badge variant={payrollStatusVariant(r.status)}>{formatLabel(r.status)}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => handleDownload(r)}>
                    <Download className="size-3.5" /> Download
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ Performance ------------------------------------------------------------------ */

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={cn("size-4", i < Math.round(rating) ? "fill-primary text-primary" : "text-muted-foreground/30")} />
      ))}
      <span className="ml-1.5 text-xs text-muted-foreground">{rating.toFixed(1)}</span>
    </div>
  );
}

function PerformanceTab({ employeeId }: { employeeId: string }) {
  const { data: goals, isLoading: goalsLoading } = useQuery({
    queryKey: ["employee-goals", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Goal[];
    },
  });

  const { data: reviews, isLoading: reviewsLoading } = useQuery({
    queryKey: ["employee-reviews", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("performance_reviews")
        .select("*")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Review[];
    },
  });

  const isLoading = goalsLoading || reviewsLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="surface-card space-y-4 p-5">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Target className="size-4 text-primary" /> Goals
        </p>
        {!goals?.length ? (
          <p className="text-[13px] text-muted-foreground">No goals set.</p>
        ) : (
          <div className="space-y-3">
            {goals.map((g) => (
              <div key={g.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="font-medium">{g.title}</span>
                  <Badge variant="outline">{formatLabel(g.status)}</Badge>
                </div>
                <Progress value={g.progress} />
                <p className="text-[12px] text-muted-foreground">{g.progress}% complete{g.target_date ? ` · Target: ${new Date(g.target_date).toLocaleDateString()}` : ""}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="surface-card space-y-4 p-5">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Trophy className="size-4 text-primary" /> Performance reviews
        </p>
        {!reviews?.length ? (
          <p className="text-[13px] text-muted-foreground">No performance reviews on record.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {reviews.map((r) => (
              <Card key={r.id} className="surface-card space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-semibold">{r.period}</p>
                  <StarRating rating={r.rating} />
                </div>
                {r.summary && <p className="text-[13px] text-muted-foreground">{r.summary}</p>}
                {r.strengths && (
                  <p className="text-[12px]">
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">Strengths: </span>
                    {r.strengths}
                  </p>
                )}
                {r.improvements && (
                  <p className="text-[12px]">
                    <span className="font-medium text-amber-600 dark:text-amber-400">Improvements: </span>
                    {r.improvements}
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ Documents ------------------------------------------------------------------ */

function DocumentsTab({ employeeId }: { employeeId: string }) {
  const { data: documents, isLoading } = useQuery({
    queryKey: ["employee-documents", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DocumentRow[];
    },
  });

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (doc: DocumentRow) => {
    if (!doc.storage_path) {
      toast.error("No file attached to this document.");
      return;
    }
    setDownloadingId(doc.id);
    try {
      const { data, error } = await supabase.storage.from("hr-documents").createSignedUrl(doc.storage_path, 60);
      if (error) throw error;
      if (!data?.signedUrl) throw new Error("Could not generate download link.");
      window.open(data.signedUrl, "_blank");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate download link");
    } finally {
      setDownloadingId(null);
    }
  };

  if (isLoading) {
    return <Skeleton className="h-64 w-full rounded-xl" />;
  }

  if (!documents?.length) {
    return <EmptyState icon={FileText} title="No documents" description="No documents have been uploaded for this employee." />;
  }

  return (
    <Card className="surface-card overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>File</TableHead>
            <TableHead>Uploaded</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((d) => (
            <TableRow key={d.id}>
              <TableCell className="font-medium">{d.title}</TableCell>
              <TableCell>
                <Badge variant="outline">{formatLabel(d.category)}</Badge>
              </TableCell>
              <TableCell className="text-[13px] text-muted-foreground">{d.file_name ?? "—"}</TableCell>
              <TableCell className="text-[13px]">{new Date(d.created_at).toLocaleDateString()}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  disabled={!d.storage_path || downloadingId === d.id}
                  onClick={() => handleDownload(d)}
                >
                  <Download className="size-3.5" /> Download
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

/* ------------------------------------------------------------------ Timeline ------------------------------------------------------------------ */

function timelineIcon(kind: string) {
  switch (kind) {
    case "leave":
      return CalendarClock;
    case "payroll":
      return Wallet;
    case "performance":
      return Trophy;
    case "attendance":
      return Clock;
    case "document":
      return FileText;
    case "employee":
      return UserRound;
    default:
      return Activity;
  }
}

function TimelineTab({ employeeId }: { employeeId: string }) {
  const { data: events, isLoading } = useQuery({
    queryKey: ["employee-timeline", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_events")
        .select("*")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as ActivityEvent[];
    },
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full rounded-xl" />;
  }

  if (!events?.length) {
    return <EmptyState icon={Activity} title="No activity yet" description="Nothing has been recorded for this employee." />;
  }

  return (
    <Card className="surface-card p-5">
      <div className="space-y-0">
        {events.map((e, idx) => {
          const Icon = timelineIcon(e.kind);
          return (
            <div key={e.id} className="relative flex gap-3 pb-6 last:pb-0">
              {idx !== events.length - 1 && (
                <span className="absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-px bg-border" />
              )}
              <div className="z-10 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Icon className="size-4 text-primary" />
              </div>
              <div className="flex-1 space-y-0.5 pt-1">
                <p className="text-[13px] font-medium">{e.title}</p>
                {e.description && <p className="text-[13px] text-muted-foreground">{e.description}</p>}
                <p className="text-[11px] text-muted-foreground">
                  {e.actor_name ? `${e.actor_name} · ` : ""}
                  {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ AI Insights ------------------------------------------------------------------ */

function AiInsightsTab({ employeeId }: { employeeId: string }) {
  const generate = useServerFn(generateEmployeeInsights);
  const [insights, setInsights] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const result = await generate({ data: { employeeId } });
      return result.insights;
    },
    onSuccess: (data) => setInsights(data),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to generate insights"),
  });

  return (
    <Card className="surface-card space-y-4 p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" /> AI Insight Brief
          </p>
          <p className="text-[13px] text-muted-foreground">
            Generates a performance, attendance and risk summary from this employee's live data.
          </p>
        </div>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="gap-2">
          {mutation.isPending && <Award className="size-4 animate-spin" />}
          {mutation.isPending ? "Generating..." : insights ? "Regenerate" : "Generate insights"}
        </Button>
      </div>

      {mutation.isPending && !insights && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      )}

      {mutation.isError && !mutation.isPending && (
        <p className="text-[13px] text-destructive">
          {mutation.error instanceof Error ? mutation.error.message : "Something went wrong."}
        </p>
      )}

      {insights && (
        <div className="whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-4 text-[13px] leading-relaxed">
          {insights}
        </div>
      )}

      {!insights && !mutation.isPending && !mutation.isError && (
        <p className="text-[13px] text-muted-foreground">
          No insights generated yet. Click "Generate insights" to get an AI-powered brief.
        </p>
      )}
    </Card>
  );
}
