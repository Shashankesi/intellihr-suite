import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Building2, Loader2, MapPin, MoreHorizontal, Plus, Trash2, Users, Wallet } from "lucide-react";
import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { DepartmentFormDialog } from "@/components/hr/department-form-dialog";
import { currency, fullName, type Department } from "@/components/hr/types";
import { useRoles, useSession } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/departments")({
  head: () => ({
    meta: [
      { title: "Departments — Nexus HR" },
      { name: "description", content: "Organize your company into departments with budgets and leads." },
      { property: "og:title", content: "Departments — Nexus HR" },
      { property: "og:description", content: "Organize your company into departments with budgets and leads." },
    ],
  }),
  component: DepartmentsPage,
});

type DepartmentWithStats = Department & {
  head: { id: string; first_name: string; last_name: string } | null;
  headcount: number;
};

function DepartmentsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useSession();
  const { isStaff } = useRoles(user?.id);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DepartmentWithStats | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: departments, isLoading, isError } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const [{ data: depts, error: deptError }, { data: employees, error: empError }] = await Promise.all([
        supabase
          .from("departments")
          .select("*, head:head_employee_id(id, first_name, last_name)")
          .order("name"),
        supabase.from("employees").select("id, department_id"),
      ]);
      if (deptError) throw deptError;
      if (empError) throw empError;

      const counts = new Map<string, number>();
      for (const e of employees ?? []) {
        if (!e.department_id) continue;
        counts.set(e.department_id, (counts.get(e.department_id) ?? 0) + 1);
      }

      return (depts ?? []).map((d) => ({
        ...d,
        headcount: counts.get(d.id) ?? 0,
      })) as unknown as DepartmentWithStats[];
    },
  });

  const totalHeadcount = departments?.reduce((sum, d) => sum + d.headcount, 0) ?? 0;
  const totalBudget = departments?.reduce((sum, d) => sum + d.budget, 0) ?? 0;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("departments").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      toast.success("Department deleted");
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete department");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Departments</h1>
          <p className="text-[13px] text-muted-foreground">
            Organize your teams, budgets and leadership across the company.
          </p>
        </div>
        {isStaff && (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="gap-2"
          >
            <Plus className="size-4" /> Add department
          </Button>
        )}
      </header>

      <div className="flex flex-wrap gap-2.5">
        <StatChip icon={Building2} label="Departments" value={String(departments?.length ?? 0)} />
        <StatChip icon={Users} label="Employees" value={String(totalHeadcount)} />
        <StatChip icon={Wallet} label="Total budget" value={currency(totalBudget)} />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <Card className="surface-card p-10 text-center text-sm text-muted-foreground">
          Failed to load departments.
        </Card>
      ) : !departments || departments.length === 0 ? (
        <Card className="surface-card flex flex-col items-center gap-2 p-12 text-center">
          <Building2 className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No departments yet</p>
          <p className="text-[13px] text-muted-foreground">
            {isStaff ? "Create your first department to get started." : "Check back once HR sets these up."}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((d) => (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="surface-card hover-lift group cursor-pointer space-y-4 p-5"
              onClick={() => navigate({ to: "/employees", search: { department: d.id } })}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Building2 className="size-4" />
                  </div>
                  <div>
                    <p className="font-semibold leading-tight">{d.name}</p>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{d.code}</p>
                  </div>
                </div>
                {isStaff && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditing(d);
                            setFormOpen(true);
                          }}
                        >
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleteTarget(d)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 size-3.5" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>

              {d.description && (
                <p className="line-clamp-2 text-[13px] text-muted-foreground">{d.description}</p>
              )}

              <div className="grid grid-cols-2 gap-3 text-[13px]">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Users className="size-3.5" /> {d.headcount} employees
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Wallet className="size-3.5" /> {currency(d.budget)}
                </div>
                {d.location && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <MapPin className="size-3.5" /> {d.location}
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Building2 className="size-3.5" /> {d.head ? fullName(d.head) : "No head assigned"}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {isStaff && (
        <>
          <DepartmentFormDialog open={formOpen} onOpenChange={setFormOpen} department={editing} />

          <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the department. Employees assigned to it will be unassigned. This cannot be
                  undone.
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
        </>
      )}
    </div>
  );
}

function StatChip({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
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
