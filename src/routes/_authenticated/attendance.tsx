import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarClock,
  Clock,
  LogIn,
  LogOut,
  Timer,
  TrendingUp,
  Users,
  PlusCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCurrentEmployee, useRoles, useSession } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({
    meta: [
      { title: "Attendance — Nexus HR" },
      { name: "description", content: "Clock in, track hours, and review attendance records." },
      { property: "og:title", content: "Attendance — Nexus HR" },
      { property: "og:description", content: "Clock in, track hours, and review attendance records." },
    ],
  }),
  component: AttendancePage,
});

type AttendanceRow = Database["public"]["Tables"]["attendance"]["Row"];
type AttendanceStatus = Database["public"]["Enums"]["attendance_status"];

const STATUS_STYLES: Record<AttendanceStatus, string> = {
  present: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  late: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  absent: "bg-destructive/15 text-destructive border-destructive/30",
  half_day: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  remote: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  holiday: "bg-muted text-muted-foreground border-border",
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatElapsed(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function minutesToHours(mins: number) {
  return (mins / 60).toFixed(1);
}

function AttendancePage() {
  const { user } = useSession();
  const { isStaff } = useRoles(user?.id);
  const { data: employee, isLoading: employeeLoading } = useCurrentEmployee(user?.id);

  if (employeeLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
        <div className="surface-card mt-4 flex flex-col items-center justify-center gap-3 p-12 text-center">
          <CalendarClock className="size-10 text-muted-foreground" />
          <p className="font-medium">No employee profile linked yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Your account isn't linked to an employee record. Ask HR to link your profile so you can
            clock in and view attendance.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
        <p className="text-sm text-muted-foreground">Track your daily clock-ins and review your monthly record.</p>
      </div>

      {isStaff ? (
        <Tabs defaultValue="me" className="space-y-4">
          <TabsList>
            <TabsTrigger value="me">My attendance</TabsTrigger>
            <TabsTrigger value="org">
              <Users className="mr-1.5 size-3.5" /> Org-wide
            </TabsTrigger>
          </TabsList>
          <TabsContent value="me" className="space-y-6">
            <MyAttendance employeeId={employee.id} />
          </TabsContent>
          <TabsContent value="org">
            <OrgAttendance />
          </TabsContent>
        </Tabs>
      ) : (
        <MyAttendance employeeId={employee.id} />
      )}
    </div>
  );
}

function MyAttendance({ employeeId }: { employeeId: string }) {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => Date.now());

  const { data: today, isLoading: todayLoading } = useQuery({
    queryKey: ["attendance-today", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("employee_id", employeeId)
        .eq("work_date", todayISO())
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const monthStart = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  }, []);

  const { data: monthRecords, isLoading: monthLoading } = useQuery({
    queryKey: ["attendance-month", employeeId, monthStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("employee_id", employeeId)
        .gte("work_date", monthStart)
        .order("work_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!today?.clock_in || today.clock_out) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [today?.clock_in, today?.clock_out]);

  const clockInMutation = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const nineThirty = new Date(now);
      nineThirty.setHours(9, 30, 0, 0);
      const status: AttendanceStatus = now > nineThirty ? "late" : "present";
      const { error } = await supabase.from("attendance").upsert(
        {
          employee_id: employeeId,
          work_date: todayISO(),
          clock_in: now.toISOString(),
          status,
        },
        { onConflict: "employee_id,work_date" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Clocked in");
      queryClient.invalidateQueries({ queryKey: ["attendance-today", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["attendance-month", employeeId] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to clock in"),
  });

  const clockOutMutation = useMutation({
    mutationFn: async () => {
      if (!today?.clock_in) throw new Error("You haven't clocked in today");
      const clockOutTime = new Date();
      const workedMinutes = Math.max(
        0,
        Math.round((clockOutTime.getTime() - new Date(today.clock_in).getTime()) / 60000),
      );
      const { error } = await supabase
        .from("attendance")
        .update({
          clock_out: clockOutTime.toISOString(),
          worked_minutes: workedMinutes,
        })
        .eq("id", today.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Clocked out");
      queryClient.invalidateQueries({ queryKey: ["attendance-today", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["attendance-month", employeeId] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to clock out"),
  });

  const elapsedMs =
    today?.clock_in && !today.clock_out ? now - new Date(today.clock_in).getTime() : 0;

  const kpis = useMemo(() => {
    const records = monthRecords ?? [];
    const present = records.filter((r) => r.status === "present" || r.status === "remote").length;
    const late = records.filter((r) => r.status === "late").length;
    const absent = records.filter((r) => r.status === "absent").length;
    const totalWorked = records.reduce((sum, r) => sum + (r.worked_minutes ?? 0), 0);
    const workedDays = records.filter((r) => r.worked_minutes > 0).length;
    const avgHours = workedDays > 0 ? totalWorked / workedDays / 60 : 0;
    const trackedDays = records.length;
    const attendancePct = trackedDays > 0 ? ((trackedDays - absent) / trackedDays) * 100 : 0;
    return { present, late, avgHours, attendancePct };
  }, [monthRecords]);

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="surface-card relative overflow-hidden p-6 shadow-float"
      >
        <div className="pointer-events-none absolute inset-0 -z-10 mesh-bg opacity-20" aria-hidden />
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Clock className="size-7" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Today · {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
              {todayLoading ? (
                <Skeleton className="mt-1 h-8 w-32" />
              ) : today?.clock_in ? (
                <p className="text-3xl font-bold tabular-nums tracking-tight">
                  {today.clock_out ? minutesToHours(today.worked_minutes) + " hrs" : formatElapsed(elapsedMs)}
                </p>
              ) : (
                <p className="text-3xl font-bold tracking-tight">Not clocked in</p>
              )}
              {today?.status && (
                <Badge variant="outline" className={cn("mt-1.5 capitalize", STATUS_STYLES[today.status])}>
                  {today.status.replace("_", " ")}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="lg"
              disabled={Boolean(today?.clock_in) || clockInMutation.isPending}
              onClick={() => clockInMutation.mutate()}
              className="gap-2"
            >
              <LogIn className="size-4" /> Clock in
            </Button>
            <Button
              size="lg"
              variant="secondary"
              disabled={!today?.clock_in || Boolean(today?.clock_out) || clockOutMutation.isPending}
              onClick={() => clockOutMutation.mutate()}
              className="gap-2"
            >
              <LogOut className="size-4" /> Clock out
            </Button>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiChip icon={TrendingUp} label="Present days" value={String(kpis.present)} />
        <KpiChip icon={Timer} label="Late" value={String(kpis.late)} />
        <KpiChip icon={Clock} label="Avg hours/day" value={`${kpis.avgHours.toFixed(1)}h`} />
        <KpiChip icon={CalendarClock} label="Attendance %" value={`${kpis.attendancePct.toFixed(0)}%`} />
      </div>

      <div className="surface-card p-5">
        <h2 className="mb-3 text-sm font-semibold">This month</h2>
        {monthLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <MonthGrid records={monthRecords ?? []} />
        )}
      </div>
    </div>
  );
}

function KpiChip({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
}) {
  return (
    <div className="surface-card flex items-center gap-3 p-4">
      <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </div>
      <div>
        <p className="text-lg font-bold leading-none">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function MonthGrid({ records }: { records: AttendanceRow[] }) {
  const byDate = useMemo(() => {
    const map = new Map<string, AttendanceRow>();
    for (const r of records) map.set(r.work_date, r);
    return map;
  }, [records]);

  const days = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const numDays = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: numDays }, (_, i) => {
      const d = new Date(year, month, i + 1);
      return d.toISOString().slice(0, 10);
    });
  }, []);

  if (records.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No attendance records yet this month.</p>;
  }

  return (
    <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-10 md:grid-cols-12">
      {days.map((date) => {
        const rec = byDate.get(date);
        const dayNum = Number(date.slice(-2));
        return (
          <div
            key={date}
            title={rec ? `${date} · ${rec.status}` : date}
            className={cn(
              "flex aspect-square items-center justify-center rounded-md border text-[11px] font-medium",
              rec ? STATUS_STYLES[rec.status] : "border-border/60 bg-muted/30 text-muted-foreground",
            )}
          >
            {dayNum}
          </div>
        );
      })}
    </div>
  );
}

type EmployeeMini = {
  id: string;
  first_name: string;
  last_name: string;
  employee_code: string;
};

function OrgAttendance() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(todayISO());
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["attendance-org", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("*, employees(id, first_name, last_name, employee_code)")
        .eq("work_date", date)
        .order("clock_in", { ascending: true });
      if (error) throw error;
      return data as (AttendanceRow & { employees: EmployeeMini | null })[];
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    if (statusFilter === "all") return data;
    return data.filter((d) => d.status === statusFilter);
  }, [data, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(["present", "late", "absent", "half_day", "remote", "holiday"] as AttendanceStatus[]).map((s) => (
                <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <CorrectRecordDialog open={dialogOpen} onOpenChange={setDialogOpen} date={date} />
      </div>

      <div className="surface-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Clock in</TableHead>
              <TableHead>Clock out</TableHead>
              <TableHead>Worked</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  No attendance records for this date.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {r.employees ? `${r.employees.first_name} ${r.employees.last_name}` : "—"}
                    <span className="ml-1.5 text-xs text-muted-foreground">{r.employees?.employee_code}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("capitalize", STATUS_STYLES[r.status])}>
                      {r.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>{r.clock_in ? new Date(r.clock_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</TableCell>
                  <TableCell>{r.clock_out ? new Date(r.clock_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</TableCell>
                  <TableCell>{r.worked_minutes ? `${minutesToHours(r.worked_minutes)}h` : "—"}</TableCell>
                  <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground">{r.notes ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function CorrectRecordDialog({
  open,
  onOpenChange,
  date,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  date: string;
}) {
  const queryClient = useQueryClient();
  const [employeeCode, setEmployeeCode] = useState("");
  const [status, setStatus] = useState<AttendanceStatus>("present");
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!employeeCode.trim()) {
      toast.error("Enter an employee code");
      return;
    }
    setSaving(true);
    try {
      const { data: emp, error: empErr } = await supabase
        .from("employees")
        .select("id")
        .eq("employee_code", employeeCode.trim())
        .maybeSingle();
      if (empErr) throw empErr;
      if (!emp) throw new Error("No employee found with that code");

      const clockInIso = clockIn ? new Date(`${date}T${clockIn}`).toISOString() : null;
      const clockOutIso = clockOut ? new Date(`${date}T${clockOut}`).toISOString() : null;
      const workedMinutes =
        clockInIso && clockOutIso
          ? Math.max(0, Math.round((new Date(clockOutIso).getTime() - new Date(clockInIso).getTime()) / 60000))
          : 0;

      const { error } = await supabase.from("attendance").upsert(
        {
          employee_id: emp.id,
          work_date: date,
          clock_in: clockInIso,
          clock_out: clockOutIso,
          worked_minutes: workedMinutes,
          status,
          notes: notes || null,
        },
        { onConflict: "employee_id,work_date" },
      );
      if (error) throw error;
      toast.success("Attendance record saved");
      queryClient.invalidateQueries({ queryKey: ["attendance-org", date] });
      onOpenChange(false);
      setEmployeeCode("");
      setClockIn("");
      setClockOut("");
      setNotes("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save record");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5"><PlusCircle className="size-4" /> Correct / add record</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Correct or add attendance record</DialogTitle>
          <DialogDescription>For {date}. Enter the employee code to identify the record.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Employee code</Label>
            <Input value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} placeholder="EMP-0001" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Clock in</Label>
              <Input type="time" value={clockIn} onChange={(e) => setClockIn(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Clock out</Label>
              <Input type="time" value={clockOut} onChange={(e) => setClockOut(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as AttendanceStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["present", "late", "absent", "half_day", "remote", "holiday"] as AttendanceStatus[]).map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving..." : "Save record"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
