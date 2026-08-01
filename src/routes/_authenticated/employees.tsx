import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Building2,
  LayoutGrid,
  List as ListIcon,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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
import { DepartmentFormDialog } from "@/components/hr/department-form-dialog";
import { EmployeeDetailSheet } from "@/components/hr/employee-detail-sheet";
import { EmployeeFormDialog } from "@/components/hr/employee-form-dialog";
import {
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_TYPES,
  currency,
  formatLabel,
  fullName,
  initials,
  statusBadgeVariant,
  type EmployeeWithRelations,
} from "@/components/hr/types";
import { useCurrentEmployee, useRoles, useSession } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const ALL = "__all__";

export const Route = createFileRoute("/_authenticated/employees")({
  validateSearch: (search: Record<string, unknown>) => ({
    department: typeof search.department === "string" ? search.department : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Employees — Nexus HR" },
      { name: "description", content: "Browse and manage your organization's employee directory." },
      { property: "og:title", content: "Employees — Nexus HR" },
      { property: "og:description", content: "Browse and manage your organization's employee directory." },
    ],
  }),
  component: EmployeesPage,
});

function EmployeesPage() {
  const { department } = Route.useSearch();
  const { user } = useSession();
  const { isStaff, isLoading: rolesLoading } = useRoles(user?.id);
  const { data: currentEmployee, isLoading: employeeLoading } = useCurrentEmployee(user?.id);

  if (rolesLoading || employeeLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!isStaff) {
    return <SelfProfileView employeeId={currentEmployee?.id ?? null} />;
  }

  return <StaffDirectory initialDepartment={department} />;
}

function SelfProfileView({ employeeId }: { employeeId: string | null }) {
  const { data: employee, isLoading } = useQuery({
    queryKey: ["employee-self", employeeId],
    enabled: Boolean(employeeId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*, departments(id, name, code), manager:manager_id(id, first_name, last_name)")
        .eq("id", employeeId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as EmployeeWithRelations | null;
    },
  });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">My profile</h1>
        <p className="text-[13px] text-muted-foreground">
          Your employment record. Contact HR if any details need updating.
        </p>
      </header>

      {isLoading ? (
        <Skeleton className="h-72 w-full rounded-xl" />
      ) : !employee ? (
        <Card className="surface-card flex flex-col items-center justify-center gap-2 p-12 text-center">
          <Users className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No employee record found</p>
          <p className="text-[13px] text-muted-foreground">
            Ask your HR admin to link your account to an employee profile.
          </p>
        </Card>
      ) : (
        <Card className="surface-card space-y-6 p-6">
          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              <AvatarFallback className="text-lg">{initials(employee)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-lg font-semibold">{fullName(employee)}</p>
              <p className="text-[13px] text-muted-foreground">{employee.designation}</p>
              <div className="mt-1.5 flex gap-1.5">
                <Badge variant={statusBadgeVariant(employee.status)}>{formatLabel(employee.status)}</Badge>
                <Badge variant="outline">{formatLabel(employee.employment_type)}</Badge>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-[13px] sm:grid-cols-3">
            <Info label="Employee code" value={employee.employee_code} />
            <Info label="Email" value={employee.email} />
            <Info label="Phone" value={employee.phone ?? "—"} />
            <Info label="Department" value={employee.departments?.name ?? "—"} />
            <Info label="Manager" value={employee.manager ? fullName(employee.manager) : "—"} />
            <Info label="Location" value={employee.location ?? "—"} />
            <Info label="Joined" value={new Date(employee.date_of_joining).toLocaleDateString()} />
            <Info label="Base salary" value={currency(employee.base_salary)} />
          </div>

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
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5">{value}</p>
    </div>
  );
}

function StaffDirectory({ initialDepartment }: { initialDepartment?: string }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState(initialDepartment ?? ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [view, setView] = useState<"table" | "grid">("table");
  const [page, setPage] = useState(0);
  const pageSize = 12;

  const [formOpen, setFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeWithRelations | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmployeeWithRelations | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deptFormOpen, setDeptFormOpen] = useState(false);

  const { data: departments } = useQuery({
    queryKey: ["departments-lite"],
    queryFn: async () => {
      const { data, error } = await supabase.from("departments").select("id, name, code").order("name");
      if (error) throw error;
      return data;
    },
  });

  const {
    data: employees,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*, departments(id, name, code), manager:manager_id(id, first_name, last_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as EmployeeWithRelations[];
    },
  });

  const filtered = useMemo(() => {
    const list = employees ?? [];
    const term = search.trim().toLowerCase();
    return list.filter((e) => {
      if (departmentFilter !== ALL && e.department_id !== departmentFilter) return false;
      if (statusFilter !== ALL && e.status !== statusFilter) return false;
      if (typeFilter !== ALL && e.employment_type !== typeFilter) return false;
      if (!term) return true;
      return (
        fullName(e).toLowerCase().includes(term) ||
        e.email.toLowerCase().includes(term) ||
        e.employee_code.toLowerCase().includes(term) ||
        e.designation.toLowerCase().includes(term)
      );
    });
  }, [employees, search, departmentFilter, statusFilter, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice(page * pageSize, page * pageSize + pageSize);

  const stats = useMemo(() => {
    const list = employees ?? [];
    return {
      total: list.length,
      active: list.filter((e) => e.status === "active").length,
      probation: list.filter((e) => e.status === "probation").length,
      departments: departments?.length ?? 0,
    };
  }, [employees, departments]);

  const resetPage = () => setPage(0);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("employees").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      toast.success("Employee removed");
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete employee");
    } finally {
      setDeleting(false);
    }
  };

  const handleStatusChange = async (employee: EmployeeWithRelations, status: string) => {
    try {
      const { error } = await supabase
        .from("employees")
        .update({ status: status as EmployeeWithRelations["status"] })
        .eq("id", employee.id);
      if (error) throw error;
      toast.success(`Status updated to ${formatLabel(status)}`);
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update status");
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
          <p className="text-[13px] text-muted-foreground">
            Directory of everyone in your organization — search, filter and manage records.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingEmployee(null);
            setFormOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="size-4" /> Add employee
        </Button>
      </header>

      <div className="flex flex-wrap gap-2.5">
        <StatChip icon={Users} label="Total" value={stats.total} />
        <StatChip icon={UserCheck} label="Active" value={stats.active} />
        <StatChip icon={Users} label="Probation" value={stats.probation} />
        <StatChip icon={Building2} label="Departments" value={stats.departments} />
      </div>

      <Card className="surface-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
            placeholder="Search by name, email, code or role..."
            className="pl-9"
          />
        </div>
        <Select
          value={departmentFilter}
          onValueChange={(v) => {
            setDepartmentFilter(v);
            resetPage();
          }}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All departments</SelectItem>
            {departments?.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            resetPage();
          }}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {EMPLOYMENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {formatLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={typeFilter}
          onValueChange={(v) => {
            setTypeFilter(v);
            resetPage();
          }}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            {EMPLOYMENT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {formatLabel(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-1 rounded-lg border border-border p-0.5">
          <Button
            size="icon"
            variant={view === "table" ? "secondary" : "ghost"}
            className="size-8"
            onClick={() => setView("table")}
          >
            <ListIcon className="size-4" />
          </Button>
          <Button
            size="icon"
            variant={view === "grid" ? "secondary" : "ghost"}
            className="size-8"
            onClick={() => setView("grid")}
          >
            <LayoutGrid className="size-4" />
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <Card className="surface-card p-10 text-center text-sm text-muted-foreground">
          Failed to load employees.
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="surface-card flex flex-col items-center gap-2 p-12 text-center">
          <Users className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No employees found</p>
          <p className="text-[13px] text-muted-foreground">Try adjusting your search or filters.</p>
        </Card>
      ) : view === "table" ? (
        <Card className="surface-card overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((e) => (
                <TableRow
                  key={e.id}
                  className="cursor-pointer"
                  onClick={() => setDetailId(e.id)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar className="size-8">
                        <AvatarFallback className="text-[11px]">{initials(e)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium leading-tight">{fullName(e)}</p>
                        <p className="text-[12px] text-muted-foreground">{e.employee_code}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-[13px]">{e.departments?.name ?? "—"}</TableCell>
                  <TableCell className="text-[13px]">{e.designation}</TableCell>
                  <TableCell className="text-[13px]">{formatLabel(e.employment_type)}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(e.status)}>{formatLabel(e.status)}</Badge>
                  </TableCell>
                  <TableCell className="text-right" onClick={(ev) => ev.stopPropagation()}>
                    <RowActions
                      employee={e}
                      onView={() => setDetailId(e.id)}
                      onEdit={() => {
                        setEditingEmployee(e);
                        setFormOpen(true);
                      }}
                      onDelete={() => setDeleteTarget(e)}
                      onStatusChange={(s) => handleStatusChange(e, s)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pageItems.map((e) => (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="surface-card hover-lift cursor-pointer space-y-3 p-4"
              onClick={() => setDetailId(e.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <Avatar className="size-10">
                    <AvatarFallback>{initials(e)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium leading-tight">{fullName(e)}</p>
                    <p className="text-[12px] text-muted-foreground">{e.designation}</p>
                  </div>
                </div>
                <div onClick={(ev) => ev.stopPropagation()}>
                  <RowActions
                    employee={e}
                    onView={() => setDetailId(e.id)}
                    onEdit={() => {
                      setEditingEmployee(e);
                      setFormOpen(true);
                    }}
                    onDelete={() => setDeleteTarget(e)}
                    onStatusChange={(s) => handleStatusChange(e, s)}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant={statusBadgeVariant(e.status)}>{formatLabel(e.status)}</Badge>
                <Badge variant="outline">{formatLabel(e.employment_type)}</Badge>
              </div>
              <p className="text-[13px] text-muted-foreground">{e.departments?.name ?? "No department"}</p>
            </motion.div>
          ))}
        </div>
      )}

      {filtered.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between text-[13px] text-muted-foreground">
          <p>
            Page {page + 1} of {totalPages} · {filtered.length} employees
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <EmployeeFormDialog open={formOpen} onOpenChange={setFormOpen} employee={editingEmployee} />
      <EmployeeDetailSheet
        open={Boolean(detailId)}
        onOpenChange={(o) => !o && setDetailId(null)}
        employeeId={detailId}
      />
      <DepartmentFormDialog open={deptFormOpen} onOpenChange={setDeptFormOpen} />

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleteTarget ? fullName(deleteTarget) : "employee"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes their employee record. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

function RowActions({
  employee,
  onView,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  employee: EmployeeWithRelations;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onView}>View profile</DropdownMenuItem>
        <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
        <DropdownMenuSeparator />
        {EMPLOYMENT_STATUSES.filter((s) => s !== employee.status).map((s) => (
          <DropdownMenuItem key={s} onClick={() => onStatusChange(s)}>
            Mark as {formatLabel(s)}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
          <Trash2 className="mr-2 size-3.5" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
