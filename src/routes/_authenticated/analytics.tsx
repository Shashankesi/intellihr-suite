import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoles, useSession } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics · Nexus HR" },
      { name: "description", content: "Org-wide KPIs and workforce analytics for Nexus HR." },
      { property: "og:title", content: "Analytics · Nexus HR" },
      { property: "og:description", content: "Headcount, attendance, leave and payroll insights." },
    ],
  }),
  component: AnalyticsPage,
});

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function useAnalytics(enabled: boolean) {
  return useQuery({
    queryKey: ["analytics-overview"],
    enabled,
    queryFn: async () => {
      const [
        { data: employees },
        { data: departments },
        { data: attendance },
        { data: leaveRequests },
        { data: payroll },
        { data: reviews },
      ] = await Promise.all([
        supabase.from("employees").select("id, status, employment_type, department_id, base_salary"),
        supabase.from("departments").select("id, name"),
        supabase
          .from("attendance")
          .select("status, work_date")
          .gte("work_date", new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)),
        supabase.from("leave_requests").select("id, status, created_at"),
        supabase
          .from("payroll")
          .select("net_pay, period_month, period_year")
          .eq("period_month", new Date().getMonth() + 1)
          .eq("period_year", new Date().getFullYear()),
        supabase.from("performance_reviews").select("rating"),
      ]);

      const emp = employees ?? [];
      const depts = departments ?? [];
      const att = attendance ?? [];
      const leaves = leaveRequests ?? [];
      const pay = payroll ?? [];
      const rev = reviews ?? [];

      const headcount = emp.filter((e) => e.status === "active").length;
      const onLeave = emp.filter((e) => e.status === "on_leave").length;
      const terminated = emp.filter((e) => e.status === "terminated").length;
      const attritionRate = emp.length ? (terminated / emp.length) * 100 : 0;

      const presentLike = att.filter((a) => a.status === "present" || a.status === "remote" || a.status === "late").length;
      const avgAttendance = att.length ? (presentLike / att.length) * 100 : 0;

      const pendingLeave = leaves.filter((l) => l.status === "pending").length;
      const payrollCost = pay.reduce((sum, p) => sum + Number(p.net_pay ?? 0), 0);
      const avgRating = rev.length ? rev.reduce((sum, r) => sum + Number(r.rating ?? 0), 0) / rev.length : 0;

      const deptNameById = new Map(depts.map((d) => [d.id, d.name]));
      const headcountByDept: Record<string, number> = {};
      for (const e of emp) {
        const name = e.department_id ? deptNameById.get(e.department_id) ?? "Unassigned" : "Unassigned";
        headcountByDept[name] = (headcountByDept[name] ?? 0) + 1;
      }

      const employmentTypeSplit: Record<string, number> = {};
      for (const e of emp) {
        employmentTypeSplit[e.employment_type] = (employmentTypeSplit[e.employment_type] ?? 0) + 1;
      }

      const leaveByMonth: Record<string, number> = {};
      for (const l of leaves) {
        const d = new Date(l.created_at);
        const key = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
        leaveByMonth[key] = (leaveByMonth[key] ?? 0) + 1;
      }

      const attendanceDistribution: Record<string, number> = {};
      for (const a of att) {
        attendanceDistribution[a.status] = (attendanceDistribution[a.status] ?? 0) + 1;
      }

      return {
        headcount,
        onLeave,
        attritionRate,
        avgAttendance,
        pendingLeave,
        payrollCost,
        avgRating,
        headcountByDept: Object.entries(headcountByDept).map(([name, value]) => ({ name, value })),
        employmentTypeSplit: Object.entries(employmentTypeSplit).map(([name, value]) => ({ name, value })),
        leaveByMonth: Object.entries(leaveByMonth).map(([month, count]) => ({ month, count })),
        attendanceDistribution: Object.entries(attendanceDistribution).map(([status, value]) => ({ status, value })),
      };
    },
  });
}

const barConfig = { value: { label: "Employees", color: "hsl(var(--chart-1))" } } satisfies ChartConfig;
const lineConfig = { count: { label: "Leave requests", color: "hsl(var(--chart-2))" } } satisfies ChartConfig;
const pieColors = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

function AnalyticsPage() {
  const { user } = useSession();
  const { isStaff, isLoading } = useRoles(user?.id);
  const { data, isLoading: dataLoading } = useAnalytics(isStaff);

  if (!isLoading && !isStaff) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="surface-card max-w-md text-center">
          <CardHeader>
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-muted">
              <Lock className="size-5 text-muted-foreground" />
            </div>
            <CardTitle>Access restricted</CardTitle>
            <CardDescription>
              Analytics is available to HR and admin roles. Contact your HR team if you need access.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const kpis = [
    { label: "Active headcount", value: data?.headcount ?? 0 },
    { label: "On leave", value: data?.onLeave ?? 0 },
    { label: "Attrition rate", value: `${(data?.attritionRate ?? 0).toFixed(1)}%` },
    { label: "Avg attendance (30d)", value: `${(data?.avgAttendance ?? 0).toFixed(1)}%` },
    { label: "Pending leave", value: data?.pendingLeave ?? 0 },
    { label: "Payroll cost (this month)", value: `$${(data?.payrollCost ?? 0).toLocaleString()}` },
    { label: "Avg performance rating", value: (data?.avgRating ?? 0).toFixed(2) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">Org-wide KPIs and workforce trends.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {(dataLoading ? Array.from({ length: 7 }) : kpis).map((kpi: any, i) => (
          <Card key={i} className="surface-card">
            <CardContent className="p-4">
              {dataLoading ? (
                <>
                  <Skeleton className="mb-2 h-3 w-20" />
                  <Skeleton className="h-6 w-16" />
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p className="mt-1 text-2xl font-bold tracking-tight">{kpi.value}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="surface-card">
          <CardHeader>
            <CardTitle className="text-base">Headcount by department</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={barConfig} className="aspect-auto h-64 w-full">
              <BarChart data={data?.headcountByDept ?? []}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="value" fill="var(--color-value)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="surface-card">
          <CardHeader>
            <CardTitle className="text-base">Employment type split</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={barConfig} className="mx-auto aspect-square h-64 w-full max-w-[280px]">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie data={data?.employmentTypeSplit ?? []} dataKey="value" nameKey="name" innerRadius={50}>
                  {(data?.employmentTypeSplit ?? []).map((_, i) => (
                    <Cell key={i} fill={pieColors[i % pieColors.length]} />
                  ))}
                </Pie>
                <ChartLegend content={<ChartLegendContent />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="surface-card">
          <CardHeader>
            <CardTitle className="text-base">Leave requests by month</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={lineConfig} className="aspect-auto h-64 w-full">
              <AreaChart data={data?.leaveByMonth ?? []}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area dataKey="count" type="monotone" fill="var(--color-count)" fillOpacity={0.2} stroke="var(--color-count)" />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="surface-card">
          <CardHeader>
            <CardTitle className="text-base">Attendance status distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={barConfig} className="mx-auto aspect-square h-64 w-full max-w-[280px]">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie data={data?.attendanceDistribution ?? []} dataKey="value" nameKey="status" innerRadius={50}>
                  {(data?.attendanceDistribution ?? []).map((_, i) => (
                    <Cell key={i} fill={pieColors[i % pieColors.length]} />
                  ))}
                </Pie>
                <ChartLegend content={<ChartLegendContent />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
