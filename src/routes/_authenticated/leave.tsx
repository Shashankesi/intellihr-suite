import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  PlaneTakeoff,
  Plus,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export const Route = createFileRoute("/_authenticated/leave")({
  head: () => ({
    meta: [
      { title: "Leave — Nexus HR" },
      { name: "description", content: "Request leave, track balances, and manage approvals." },
      { property: "og:title", content: "Leave — Nexus HR" },
      { property: "og:description", content: "Request leave, track balances, and manage approvals." },
    ],
  }),
  component: LeavePage,
});

type LeaveType = Database["public"]["Enums"]["leave_type"];
type LeaveStatus = Database["public"]["Enums"]["leave_status"];
type LeaveRequestRow = Database["public"]["Tables"]["leave_requests"]["Row"];
type LeaveBalanceRow = Database["public"]["Tables"]["leave_balances"]["Row"];

const LEAVE_TYPES: LeaveType[] = ["casual", "sick", "earned", "unpaid", "maternity", "paternity", "bereavement"];

const STATUS_STYLES: Record<LeaveStatus, string> = {
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

function businessDaysBetween(start: Date, end: Date) {
  if (end < start) return 0;
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function LeavePage() {
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
        <h1 className="text-2xl font-bold tracking-tight">Leave</h1>
        <div className="surface-card mt-4 flex flex-col items-center justify-center gap-3 p-12 text-center">
          <PlaneTakeoff className="size-10 text-muted-foreground" />
          <p className="font-medium">No employee profile linked yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Your account isn't linked to an employee record. Ask HR to link your profile so you can
            request and track leave.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Leave</h1>
        <p className="text-sm text-muted-foreground">Manage your leave balances, requests, and approvals.</p>
      </div>

      {isStaff ? (
        <Tabs defaultValue="me" className="space-y-4">
          <TabsList>
            <TabsTrigger value="me">My leave</TabsTrigger>
            <TabsTrigger value="approvals">
              <ClipboardList className="mr-1.5 size-3.5" /> Approvals
            </TabsTrigger>
          </TabsList>
          <TabsContent value="me" className="space-y-6">
            <MyLeave employeeId={employee.id} />
          </TabsContent>
          <TabsContent value="approvals">
            <Approvals />
          </TabsContent>
        </Tabs>
      ) : (
        <MyLeave employeeId={employee.id} />
      )}
    </div>
  );
}

function MyLeave({ employeeId }: { employeeId: string }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const year = new Date().getFullYear();

  const { data: balances, isLoading: balancesLoading } = useQuery({
    queryKey: ["leave-balances", employeeId, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_balances")
        .select("*")
        .eq("employee_id", employeeId)
        .eq("year", year);
      if (error) throw error;
      return data;
    },
  });

  const { data: requests, isLoading: requestsLoading } = useQuery({
    queryKey: ["leave-requests-mine", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("leave_requests")
        .update({ status: "cancelled" as LeaveStatus })
        .eq("id", id)
        .eq("status", "pending");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Leave request cancelled");
      queryClient.invalidateQueries({ queryKey: ["leave-requests-mine", employeeId] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to cancel request"),
  });

  const balanceMap = useMemo(() => {
    const map = new Map<LeaveType, LeaveBalanceRow>();
    for (const b of balances ?? []) map.set(b.leave_type, b);
    return map;
  }, [balances]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Leave balances ({year})</h2>
        <RequestLeaveDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          employeeId={employeeId}
          existingRequests={requests ?? []}
        />
      </div>

      {balancesLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : (balances ?? []).length === 0 ? (
        <div className="surface-card p-8 text-center text-sm text-muted-foreground">
          No leave balances set up yet. Ask HR to configure your entitlements.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {LEAVE_TYPES.filter((t) => balanceMap.has(t)).map((t) => {
            const b = balanceMap.get(t)!;
            const remaining = b.entitled - b.used;
            return (
              <motion.div
                key={t}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="surface-card p-4"
              >
                <p className="text-xs font-medium capitalize text-muted-foreground">{t}</p>
                <p className="mt-1 text-2xl font-bold tracking-tight">{remaining}</p>
                <p className="text-xs text-muted-foreground">of {b.entitled} remaining · {b.used} used</p>
              </motion.div>
            );
          })}
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold">My requests</h2>
        <div className="surface-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requestsLoading ? (
                <TableRow><TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
              ) : (requests ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    You haven't requested any leave yet.
                  </TableCell>
                </TableRow>
              ) : (
                requests!.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="capitalize font-medium">{r.leave_type}</TableCell>
                    <TableCell className="text-xs">{r.start_date} → {r.end_date}</TableCell>
                    <TableCell>{r.days}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("capitalize", STATUS_STYLES[r.status])}>{r.status}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">{r.reason}</TableCell>
                    <TableCell className="text-right">
                      {r.status === "pending" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => cancelMutation.mutate(r.id)}
                          disabled={cancelMutation.isPending}
                        >
                          Cancel
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

const requestSchema = z
  .object({
    leaveType: z.enum(["casual", "sick", "earned", "unpaid", "maternity", "paternity", "bereavement"]),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
    reason: z.string().trim().min(3, "Please provide a brief reason").max(500),
  })
  .refine((v) => new Date(v.endDate) >= new Date(v.startDate), {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });

type RequestFormValues = z.infer<typeof requestSchema>;

function RequestLeaveDialog({
  open,
  onOpenChange,
  employeeId,
  existingRequests,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employeeId: string;
  existingRequests: LeaveRequestRow[];
}) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: { leaveType: "casual", startDate: "", endDate: "", reason: "" },
  });

  const startDate = watch("startDate");
  const endDate = watch("endDate");
  const dayCount = useMemo(() => {
    if (!startDate || !endDate) return 0;
    return businessDaysBetween(new Date(startDate), new Date(endDate));
  }, [startDate, endDate]);

  const onSubmit = async (values: RequestFormValues) => {
    if (dayCount <= 0) {
      toast.error("Selected range has no working days");
      return;
    }
    const activeStatuses: LeaveStatus[] = ["pending", "approved"];
    const overlap = existingRequests.some(
      (r) =>
        activeStatuses.includes(r.status) &&
        new Date(values.startDate) <= new Date(r.end_date) &&
        new Date(values.endDate) >= new Date(r.start_date),
    );
    if (overlap) {
      toast.error("This overlaps with an existing pending or approved leave request");
      return;
    }

    const { error } = await supabase.from("leave_requests").insert({
      employee_id: employeeId,
      leave_type: values.leaveType,
      start_date: values.startDate,
      end_date: values.endDate,
      days: dayCount,
      reason: values.reason,
      status: "pending",
    });
    if (error) {
      toast.error(error.message || "Failed to submit request");
      return;
    }
    toast.success("Leave request submitted");
    reset({ leaveType: "casual", startDate: "", endDate: "", reason: "" });
    onOpenChange(false);
    queryClient.invalidateQueries({ queryKey: ["leave-requests-mine", employeeId] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-1.5"><Plus className="size-4" /> Request leave</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request leave</DialogTitle>
          <DialogDescription>Weekends are excluded automatically from the day count.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Leave type</Label>
            <Controller
              control={control}
              name="leaveType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEAVE_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start date</Label>
              <Input type="date" {...register("startDate")} />
              {errors.startDate && <p className="text-xs text-destructive">{errors.startDate.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>End date</Label>
              <Input type="date" {...register("endDate")} />
              {errors.endDate && <p className="text-xs text-destructive">{errors.endDate.message}</p>}
            </div>
          </div>
          {dayCount > 0 && (
            <p className="text-xs text-muted-foreground">
              <CalendarDays className="mr-1 inline size-3.5" />
              {dayCount} working day{dayCount === 1 ? "" : "s"} requested
            </p>
          )}
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Textarea rows={3} {...register("reason")} placeholder="Brief reason for leave" />
            {errors.reason && <p className="text-xs text-destructive">{errors.reason.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Submitting..." : "Submit request"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type EmployeeMini = {
  id: string;
  first_name: string;
  last_name: string;
  employee_code: string;
  user_id: string | null;
};

function Approvals() {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { data: reviewerEmployee } = useCurrentEmployee(user?.id);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewAction, setReviewAction] = useState<"approved" | "rejected" | null>(null);

  const { data: pending, isLoading } = useQuery({
    queryKey: ["leave-requests-pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("*, employees!leave_requests_employee_id_fkey(id, first_name, last_name, employee_code, user_id)")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as (LeaveRequestRow & { employees: EmployeeMini | null })[];
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({
      request,
      action,
      note,
    }: {
      request: LeaveRequestRow & { employees: EmployeeMini | null };
      action: "approved" | "rejected";
      note: string;
    }) => {
      const nowIso = new Date().toISOString();
      const { error: updateErr } = await supabase
        .from("leave_requests")
        .update({
          status: action,
          reviewer_id: reviewerEmployee?.id ?? null,
          review_note: note || null,
          reviewed_at: nowIso,
        })
        .eq("id", request.id)
        .eq("status", "pending");
      if (updateErr) throw updateErr;

      if (action === "approved") {
        const year = new Date(request.start_date).getFullYear();
        const { data: existingBalance, error: balErr } = await supabase
          .from("leave_balances")
          .select("*")
          .eq("employee_id", request.employee_id)
          .eq("leave_type", request.leave_type)
          .eq("year", year)
          .maybeSingle();
        if (balErr) throw balErr;

        if (existingBalance) {
          const { error } = await supabase
            .from("leave_balances")
            .update({ used: existingBalance.used + request.days })
            .eq("id", existingBalance.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("leave_balances").insert({
            employee_id: request.employee_id,
            leave_type: request.leave_type,
            year,
            entitled: 0,
            used: request.days,
          });
          if (error) throw error;
        }
      }

      if (request.employees?.user_id) {
        const { error: notifErr } = await supabase.from("notifications").insert({
          user_id: request.employees.user_id,
          title: `Leave request ${action}`,
          body: `Your ${request.leave_type} leave request (${request.start_date} → ${request.end_date}) was ${action}.${note ? ` Note: ${note}` : ""}`,
          category: "leave",
          link: "/leave",
        });
        if (notifErr) throw notifErr;
      }
    },
    onSuccess: (_, vars) => {
      toast.success(`Leave request ${vars.action}`);
      queryClient.invalidateQueries({ queryKey: ["leave-requests-pending"] });
      setReviewingId(null);
      setReviewNote("");
      setReviewAction(null);
    },
    onError: (e: Error) => toast.error(e.message || "Failed to review request"),
  });

  return (
    <div className="space-y-4">
      <div className="surface-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
            ) : (pending ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  <CheckCircle2 className="mx-auto mb-2 size-6 text-muted-foreground" />
                  No pending leave requests. All caught up.
                </TableCell>
              </TableRow>
            ) : (
              pending!.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {r.employees ? `${r.employees.first_name} ${r.employees.last_name}` : "—"}
                    <span className="ml-1.5 text-xs text-muted-foreground">{r.employees?.employee_code}</span>
                  </TableCell>
                  <TableCell className="capitalize">{r.leave_type}</TableCell>
                  <TableCell className="text-xs">{r.start_date} → {r.end_date}</TableCell>
                  <TableCell>{r.days}</TableCell>
                  <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">{r.reason}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                        onClick={() => { setReviewingId(r.id); setReviewAction("approved"); }}
                      >
                        <ThumbsUp className="size-3.5" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                        onClick={() => { setReviewingId(r.id); setReviewAction("rejected"); }}
                      >
                        <ThumbsDown className="size-3.5" /> Reject
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={Boolean(reviewingId)} onOpenChange={(v) => { if (!v) { setReviewingId(null); setReviewAction(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {reviewAction === "approved" ? <CheckCircle2 className="size-4 text-emerald-400" /> : <XCircle className="size-4 text-destructive" />}
              {reviewAction === "approved" ? "Approve" : "Reject"} leave request
            </DialogTitle>
            <DialogDescription>Add an optional note for the employee.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Review note</Label>
            <Textarea rows={3} value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder="Optional note" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReviewingId(null); setReviewAction(null); }}>Cancel</Button>
            <Button
              disabled={reviewMutation.isPending}
              onClick={() => {
                const request = pending?.find((p) => p.id === reviewingId);
                if (!request || !reviewAction) return;
                reviewMutation.mutate({ request, action: reviewAction, note: reviewNote });
              }}
            >
              {reviewMutation.isPending ? "Saving..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
