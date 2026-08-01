import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Download, IndianRupee, Play, ReceiptText, Wallet } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentEmployee, useRoles, useSession } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/payroll")({
  head: () => ({
    meta: [
      { title: "Payroll | Nexus HR" },
      { name: "description", content: "Review payslips, earnings history, and run organization payroll." },
      { property: "og:title", content: "Payroll | Nexus HR" },
      { property: "og:description", content: "Review payslips, earnings history, and run organization payroll." },
    ],
  }),
  component: PayrollPage,
});

type PayrollRow = Database["public"]["Tables"]["payroll"]["Row"];
type EmployeeRow = Database["public"]["Tables"]["employees"]["Row"];
type PayrollStatus = Database["public"]["Enums"]["payroll_status"];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const currency = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

function statusVariant(status: PayrollStatus): "secondary" | "default" | "outline" {
  if (status === "paid") return "default";
  if (status === "processed") return "secondary";
  return "outline";
}

function PayrollPage() {
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
        <h1 className="text-2xl font-bold tracking-tight text-gradient">Payroll</h1>
        <p className="text-sm text-muted-foreground">
          {isStaff
            ? "Review your payslips and run payroll for the organization."
            : "Your payslips, earnings history, and downloadable statements."}
        </p>
      </div>

      {isStaff ? (
        <Tabs defaultValue="run" className="space-y-4">
          <TabsList>
            <TabsTrigger value="run">Run payroll</TabsTrigger>
            <TabsTrigger value="mine">My payslips</TabsTrigger>
          </TabsList>
          <TabsContent value="run">
            <RunPayrollTab />
          </TabsContent>
          <TabsContent value="mine">
            <EmployeePayslips employee={employee ?? null} />
          </TabsContent>
        </Tabs>
      ) : (
        <EmployeePayslips employee={employee ?? null} />
      )}
    </div>
  );
}

/* ---------------------------------- Employee payslip view ---------------------------------- */

function EmployeePayslips({ employee }: { employee: EmployeeRow | null }) {
  const [selected, setSelected] = useState<PayrollRow | null>(null);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["payroll", "self", employee?.id],
    enabled: Boolean(employee?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll")
        .select("*")
        .eq("employee_id", employee!.id)
        .order("period_year", { ascending: false })
        .order("period_month", { ascending: false });
      if (error) throw error;
      return data as PayrollRow[];
    },
  });

  if (!employee) {
    return (
      <Card className="surface-card">
        <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <Wallet className="h-10 w-10 text-muted-foreground" />
          <p className="font-medium">No linked employee profile</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Your account isn't linked to an employee record yet, so we can't show payslips. Contact HR to
            get your profile linked.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const currentYear = new Date().getFullYear();
  const ytd = (rows ?? []).filter((r) => r.period_year === currentYear && r.status !== "draft");
  const ytdNet = ytd.reduce((sum, r) => sum + Number(r.net_pay), 0);
  const ytdTax = ytd.reduce((sum, r) => sum + Number(r.tax), 0);
  const ytdGross = ytd.reduce(
    (sum, r) => sum + Number(r.basic) + Number(r.hra) + Number(r.allowances) + Number(r.bonus),
    0,
  );

  const chartData = useMemo(() => {
    const last12 = [...(rows ?? [])]
      .sort((a, b) => a.period_year - b.period_year || a.period_month - b.period_month)
      .slice(-12)
      .map((r) => ({
        period: `${MONTHS[r.period_month - 1]?.slice(0, 3)} '${String(r.period_year).slice(2)}`,
        net: Number(r.net_pay),
      }));
    return last12;
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="surface-card">
          <CardHeader className="pb-2">
            <CardDescription>YTD gross earnings</CardDescription>
            <CardTitle className="text-2xl">{currency(ytdGross)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="surface-card">
          <CardHeader className="pb-2">
            <CardDescription>YTD net pay</CardDescription>
            <CardTitle className="text-2xl">{currency(ytdNet)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="surface-card">
          <CardHeader className="pb-2">
            <CardDescription>YTD tax deducted</CardDescription>
            <CardTitle className="text-2xl">{currency(ytdTax)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="surface-card">
        <CardHeader>
          <CardTitle className="text-base">Net pay — last 12 months</CardTitle>
          <CardDescription>Trend of your net take-home pay</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No payroll history yet.</p>
          ) : (
            <ChartContainer
              config={{ net: { label: "Net pay", color: "hsl(var(--primary))" } }}
              className="aspect-auto h-64 w-full"
            >
              <LineChart data={chartData}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="period" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="net" stroke="var(--color-net)" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card className="surface-card">
        <CardHeader>
          <CardTitle className="text-base">Payslips</CardTitle>
          <CardDescription>Select a period to view the full breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          {!rows || rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No payslips generated yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Gross</TableHead>
                  <TableHead>Net pay</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const gross = Number(row.basic) + Number(row.hra) + Number(row.allowances) + Number(row.bonus);
                  return (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer"
                      onClick={() => setSelected(row)}
                    >
                      <TableCell className="font-medium">
                        {MONTHS[row.period_month - 1]} {row.period_year}
                      </TableCell>
                      <TableCell>{currency(gross)}</TableCell>
                      <TableCell className="font-semibold">{currency(Number(row.net_pay))}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(row.status)} className="capitalize">
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setSelected(row)}>
                          <ReceiptText className="mr-1 h-4 w-4" /> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PayslipDialog
        row={selected}
        employee={employee}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </div>
  );
}

function PayslipDialog({
  row,
  employee,
  onOpenChange,
}: {
  row: PayrollRow | null;
  employee: EmployeeRow;
  onOpenChange: (open: boolean) => void;
}) {
  if (!row) return null;
  const gross = Number(row.basic) + Number(row.hra) + Number(row.allowances) + Number(row.bonus);
  const totalDeductions = Number(row.deductions) + Number(row.tax);

  const handlePrint = () => {
    const printable = document.getElementById("payslip-print-area");
    if (!printable) return;
    const win = window.open("", "_blank", "width=800,height=900");
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Payslip - ${MONTHS[row.period_month - 1]} ${row.period_year}</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 32px; color: #111; }
            h1 { font-size: 20px; margin-bottom: 4px; }
            .muted { color: #666; font-size: 13px; margin-bottom: 24px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            td, th { padding: 8px 4px; border-bottom: 1px solid #e5e5e5; text-align: left; font-size: 14px; }
            .total { font-weight: 700; font-size: 16px; }
          </style>
        </head>
        <body>${printable.innerHTML}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <Dialog open={Boolean(row)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Payslip — {MONTHS[row.period_month - 1]} {row.period_year}
          </DialogTitle>
          <DialogDescription>Full earnings and deductions breakdown</DialogDescription>
        </DialogHeader>

        <div id="payslip-print-area" className="space-y-4">
          <div>
            <h1>{employee.first_name} {employee.last_name}</h1>
            <p className="muted">
              {employee.designation} · {employee.employee_code} · {MONTHS[row.period_month - 1]} {row.period_year}
            </p>
          </div>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b"><td className="py-1.5 text-muted-foreground">Basic</td><td className="py-1.5 text-right">{currency(Number(row.basic))}</td></tr>
              <tr className="border-b"><td className="py-1.5 text-muted-foreground">HRA</td><td className="py-1.5 text-right">{currency(Number(row.hra))}</td></tr>
              <tr className="border-b"><td className="py-1.5 text-muted-foreground">Allowances</td><td className="py-1.5 text-right">{currency(Number(row.allowances))}</td></tr>
              <tr className="border-b"><td className="py-1.5 text-muted-foreground">Bonus</td><td className="py-1.5 text-right">{currency(Number(row.bonus))}</td></tr>
              <tr className="border-b total"><td className="py-1.5">Gross earnings</td><td className="py-1.5 text-right">{currency(gross)}</td></tr>
              <tr className="border-b"><td className="py-1.5 text-muted-foreground">Tax</td><td className="py-1.5 text-right">-{currency(Number(row.tax))}</td></tr>
              <tr className="border-b"><td className="py-1.5 text-muted-foreground">Other deductions</td><td className="py-1.5 text-right">-{currency(Number(row.deductions))}</td></tr>
              <tr className="border-b total"><td className="py-1.5">Total deductions</td><td className="py-1.5 text-right">-{currency(totalDeductions)}</td></tr>
              <tr><td className="py-2 total">Net pay</td><td className="py-2 text-right total">{currency(Number(row.net_pay))}</td></tr>
            </tbody>
          </table>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Status: <span className="capitalize">{row.status}</span></span>
            {row.paid_on && <span>Paid on {format(new Date(row.paid_on), "dd MMM yyyy")}</span>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handlePrint}>
            <Download className="mr-1.5 h-4 w-4" /> Download payslip
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------ Staff: run payroll ------------------------------------ */

function computeDraft(baseSalary: number) {
  const basic = Math.round(baseSalary * 0.5);
  const hra = Math.round(baseSalary * 0.2);
  const allowances = Math.round(baseSalary * 0.3);
  const bonus = 0;
  const deductions = 0;
  const gross = basic + hra + allowances + bonus;
  const tax = Math.round(gross * 0.1);
  const net_pay = gross - deductions - tax;
  return { basic, hra, allowances, bonus, deductions, tax, net_pay };
}

function RunPayrollTab() {
  const queryClient = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [editRow, setEditRow] = useState<PayrollRow | null>(null);

  const { data: employees, isLoading: employeesLoading } = useQuery({
    queryKey: ["employees", "active-for-payroll"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name, employee_code, designation, base_salary, status")
        .eq("status", "active")
        .order("first_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: payrollRows, isLoading: payrollLoading } = useQuery({
    queryKey: ["payroll", "period", month, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll")
        .select("*")
        .eq("period_month", month)
        .eq("period_year", year);
      if (error) throw error;
      return data as PayrollRow[];
    },
  });

  const rowByEmployee = useMemo(() => {
    const map = new Map<string, PayrollRow>();
    (payrollRows ?? []).forEach((r) => map.set(r.employee_id, r));
    return map;
  }, [payrollRows]);

  const generateDrafts = useMutation({
    mutationFn: async () => {
      const missing = (employees ?? []).filter((e) => !rowByEmployee.has(e.id));
      if (missing.length === 0) return 0;
      const inserts = missing.map((e) => {
        const draft = computeDraft(Number(e.base_salary));
        return {
          employee_id: e.id,
          period_month: month,
          period_year: year,
          status: "draft" as PayrollStatus,
          ...draft,
        };
      });
      const { error } = await supabase.from("payroll").insert(inserts);
      if (error) throw error;
      return inserts.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["payroll", "period", month, year] });
      toast.success(count > 0 ? `Generated ${count} draft payslip(s)` : "All employees already have payroll for this period");
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Failed to generate drafts"),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PayrollStatus }) => {
      const payload: Database["public"]["Tables"]["payroll"]["Update"] = { status };
      if (status === "paid") payload.paid_on = new Date().toISOString().slice(0, 10);
      const { error } = await supabase.from("payroll").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll", "period", month, year] });
      toast.success("Status updated");
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Failed to update status"),
  });

  const totals = useMemo(() => {
    const rows = payrollRows ?? [];
    return rows.reduce(
      (acc, r) => {
        acc.gross += Number(r.basic) + Number(r.hra) + Number(r.allowances) + Number(r.bonus);
        acc.net += Number(r.net_pay);
        acc.tax += Number(r.tax);
        acc.count += 1;
        return acc;
      },
      { gross: 0, net: 0, tax: 0, count: 0 },
    );
  }, [payrollRows]);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Month</Label>
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Year</Label>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => generateDrafts.mutate()} disabled={generateDrafts.isPending || employeesLoading}>
          <Play className="mr-1.5 h-4 w-4" /> Generate draft payroll
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="surface-card">
          <CardHeader className="pb-2"><CardDescription>Employees in period</CardDescription><CardTitle className="text-2xl">{totals.count}</CardTitle></CardHeader>
        </Card>
        <Card className="surface-card">
          <CardHeader className="pb-2"><CardDescription>Gross payout</CardDescription><CardTitle className="text-2xl">{currency(totals.gross)}</CardTitle></CardHeader>
        </Card>
        <Card className="surface-card">
          <CardHeader className="pb-2"><CardDescription>Tax withheld</CardDescription><CardTitle className="text-2xl">{currency(totals.tax)}</CardTitle></CardHeader>
        </Card>
        <Card className="surface-card">
          <CardHeader className="pb-2"><CardDescription>Net payout</CardDescription><CardTitle className="text-2xl">{currency(totals.net)}</CardTitle></CardHeader>
        </Card>
      </div>

      <Card className="surface-card">
        <CardHeader>
          <CardTitle className="text-base">
            {MONTHS[month - 1]} {year} — employees
          </CardTitle>
          <CardDescription>Auto-computed drafts based on base salary; edit or progress status individually</CardDescription>
        </CardHeader>
        <CardContent>
          {employeesLoading || payrollLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : !employees || employees.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No active employees found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Base salary</TableHead>
                  <TableHead>Net pay</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((e) => {
                  const row = rowByEmployee.get(e.id);
                  const draft = !row ? computeDraft(Number(e.base_salary)) : null;
                  return (
                    <TableRow key={e.id}>
                      <TableCell>
                        <div className="font-medium">{e.first_name} {e.last_name}</div>
                        <div className="text-xs text-muted-foreground">{e.employee_code} · {e.designation}</div>
                      </TableCell>
                      <TableCell>{currency(Number(e.base_salary))}</TableCell>
                      <TableCell className={cn("font-medium", !row && "text-muted-foreground")}>
                        {currency(row ? Number(row.net_pay) : draft!.net_pay)}
                        {!row && <span className="ml-1.5 text-xs font-normal italic">(preview)</span>}
                      </TableCell>
                      <TableCell>
                        {row ? (
                          <Badge variant={statusVariant(row.status)} className="capitalize">{row.status}</Badge>
                        ) : (
                          <Badge variant="outline">not generated</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-1.5">
                        {row && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => setEditRow(row)}>Edit</Button>
                            {row.status === "draft" && (
                              <Button size="sm" variant="secondary" onClick={() => updateStatus.mutate({ id: row.id, status: "processed" })}>
                                Mark processed
                              </Button>
                            )}
                            {row.status === "processed" && (
                              <Button size="sm" onClick={() => updateStatus.mutate({ id: row.id, status: "paid" })}>
                                Mark paid
                              </Button>
                            )}
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <EditPayrollDialog row={editRow} onOpenChange={(open) => !open && setEditRow(null)} />
    </div>
  );
}

function EditPayrollDialog({
  row,
  onOpenChange,
}: {
  row: PayrollRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Partial<PayrollRow>>({});

  useMemo(() => {
    if (row) setForm(row);
  }, [row]);

  const gross =
    Number(form.basic ?? 0) + Number(form.hra ?? 0) + Number(form.allowances ?? 0) + Number(form.bonus ?? 0);
  const netPreview = gross - Number(form.deductions ?? 0) - Number(form.tax ?? 0);

  const save = useMutation({
    mutationFn: async () => {
      if (!row) return;
      const { error } = await supabase
        .from("payroll")
        .update({
          basic: Number(form.basic ?? 0),
          hra: Number(form.hra ?? 0),
          allowances: Number(form.allowances ?? 0),
          bonus: Number(form.bonus ?? 0),
          deductions: Number(form.deductions ?? 0),
          tax: Number(form.tax ?? 0),
          net_pay: netPreview,
        })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      toast.success("Payslip updated");
      onOpenChange(false);
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Failed to update"),
  });

  if (!row) return null;

  const field = (key: keyof PayrollRow, label: string) => (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={Number(form[key] ?? 0)}
        onChange={(e) => setForm((f) => ({ ...f, [key]: Number(e.target.value) }))}
      />
    </div>
  );

  return (
    <Dialog open={Boolean(row)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit payslip</DialogTitle>
          <DialogDescription>
            {MONTHS[row.period_month - 1]} {row.period_year}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {field("basic", "Basic")}
          {field("hra", "HRA")}
          {field("allowances", "Allowances")}
          {field("bonus", "Bonus")}
          {field("deductions", "Other deductions")}
          {field("tax", "Tax")}
        </div>
        <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Net pay</span>
          <span className="flex items-center gap-1 font-semibold"><IndianRupee className="h-3.5 w-3.5" />{netPreview.toLocaleString("en-IN")}</span>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
