import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

import {
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_TYPES,
  formatLabel,
  type EmployeeWithRelations,
} from "./types";

const employeeSchema = z.object({
  first_name: z.string().trim().min(1, "Required").max(80),
  last_name: z.string().trim().min(1, "Required").max(80),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  employee_code: z.string().trim().min(1, "Required").max(30),
  department_id: z.string().uuid().optional().or(z.literal("")),
  manager_id: z.string().uuid().optional().or(z.literal("")),
  designation: z.string().trim().min(1, "Required").max(120),
  employment_type: z.enum(["full_time", "part_time", "contract", "intern"]),
  status: z.enum(["active", "probation", "notice", "terminated", "on_leave"]),
  date_of_joining: z.string().min(1, "Required"),
  date_of_birth: z.string().optional().or(z.literal("")),
  gender: z.string().trim().max(30).optional().or(z.literal("")),
  location: z.string().trim().max(120).optional().or(z.literal("")),
  skills: z.string().trim().max(500).optional().or(z.literal("")),
  base_salary: z.coerce.number().min(0, "Must be positive"),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  emergency_contact: z.string().trim().max(255).optional().or(z.literal("")),
});

type EmployeeFormValues = z.infer<typeof employeeSchema>;

const NONE = "__none__";

export function EmployeeFormDialog({
  open,
  onOpenChange,
  employee,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: EmployeeWithRelations | null;
}) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(employee);

  const { data: departments } = useQuery({
    queryKey: ["departments-lite"],
    queryFn: async () => {
      const { data, error } = await supabase.from("departments").select("id, name, code").order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: managers } = useQuery({
    queryKey: ["employees-lite"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name")
        .order("first_name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      employee_code: "",
      department_id: "",
      manager_id: "",
      designation: "",
      employment_type: "full_time",
      status: "active",
      date_of_joining: new Date().toISOString().slice(0, 10),
      date_of_birth: "",
      gender: "",
      location: "",
      skills: "",
      base_salary: 0,
      address: "",
      emergency_contact: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (employee) {
      reset({
        first_name: employee.first_name,
        last_name: employee.last_name,
        email: employee.email,
        phone: employee.phone ?? "",
        employee_code: employee.employee_code,
        department_id: employee.department_id ?? "",
        manager_id: employee.manager_id ?? "",
        designation: employee.designation,
        employment_type: employee.employment_type,
        status: employee.status,
        date_of_joining: employee.date_of_joining,
        date_of_birth: employee.date_of_birth ?? "",
        gender: employee.gender ?? "",
        location: employee.location ?? "",
        skills: (employee.skills ?? []).join(", "),
        base_salary: employee.base_salary,
        address: employee.address ?? "",
        emergency_contact: employee.emergency_contact ?? "",
      });
    } else {
      reset({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        employee_code: "",
        department_id: "",
        manager_id: "",
        designation: "",
        employment_type: "full_time",
        status: "active",
        date_of_joining: new Date().toISOString().slice(0, 10),
        date_of_birth: "",
        gender: "",
        location: "",
        skills: "",
        base_salary: 0,
        address: "",
        emergency_contact: "",
      });
    }
  }, [open, employee, reset]);

  const departmentId = watch("department_id");

  const selectedDept = useMemo(
    () => departments?.find((d) => d.id === departmentId),
    [departments, departmentId],
  );

  const suggestCode = async () => {
    if (!selectedDept) {
      toast.info("Pick a department first to generate a suggested code");
      return;
    }
    const { count } = await supabase
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("department_id", selectedDept.id);
    const seq = String((count ?? 0) + 1).padStart(4, "0");
    setValue("employee_code", `${selectedDept.code.toUpperCase()}-${seq}`, { shouldValidate: true });
  };

  const onSubmit = async (values: EmployeeFormValues) => {
    setSaving(true);
    try {
      const payload = {
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email,
        phone: values.phone || null,
        employee_code: values.employee_code,
        department_id: values.department_id || null,
        manager_id: values.manager_id || null,
        designation: values.designation,
        employment_type: values.employment_type,
        status: values.status,
        date_of_joining: values.date_of_joining,
        date_of_birth: values.date_of_birth || null,
        gender: values.gender || null,
        location: values.location || null,
        skills: values.skills
          ? values.skills.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        base_salary: values.base_salary,
        address: values.address || null,
        emergency_contact: values.emergency_contact || null,
      };

      if (isEdit && employee) {
        const { error } = await supabase.from("employees").update(payload).eq("id", employee.id);
        if (error) throw error;
        toast.success("Employee updated");
      } else {
        const { error } = await supabase.from("employees").insert(payload);
        if (error) throw error;
        toast.success("Employee created");
      }
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit employee" : "Add employee"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this employee's profile details." : "Create a new employee record."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="first_name">First name</Label>
              <Input id="first_name" {...register("first_name")} />
              {errors.first_name && <p className="text-xs text-destructive">{errors.first_name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="last_name">Last name</Label>
              <Input id="last_name" {...register("last_name")} />
              {errors.last_name && <p className="text-xs text-destructive">{errors.last_name.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...register("phone")} />
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="employee_code">Employee code</Label>
              <Input id="employee_code" {...register("employee_code")} />
              {errors.employee_code && (
                <p className="text-xs text-destructive">{errors.employee_code.message}</p>
              )}
            </div>
            <div className="flex items-end">
              <Button type="button" variant="outline" size="sm" onClick={suggestCode} className="gap-1.5">
                <Sparkles className="size-3.5" /> Suggest
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Select
                value={departmentId || NONE}
                onValueChange={(v) => setValue("department_id", v === NONE ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {departments?.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Manager</Label>
              <Select
                value={watch("manager_id") || NONE}
                onValueChange={(v) => setValue("manager_id", v === NONE ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {managers
                    ?.filter((m) => m.id !== employee?.id)
                    .map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.first_name} {m.last_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="designation">Designation</Label>
              <Input id="designation" {...register("designation")} />
              {errors.designation && <p className="text-xs text-destructive">{errors.designation.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="base_salary">Base salary</Label>
              <Input id="base_salary" type="number" step="0.01" {...register("base_salary")} />
              {errors.base_salary && <p className="text-xs text-destructive">{errors.base_salary.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Employment type</Label>
              <Select
                value={watch("employment_type")}
                onValueChange={(v) => setValue("employment_type", v as EmployeeFormValues["employment_type"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {formatLabel(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={watch("status")}
                onValueChange={(v) => setValue("status", v as EmployeeFormValues["status"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {formatLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="date_of_joining">Date of joining</Label>
              <Input id="date_of_joining" type="date" {...register("date_of_joining")} />
              {errors.date_of_joining && (
                <p className="text-xs text-destructive">{errors.date_of_joining.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date_of_birth">Date of birth</Label>
              <Input id="date_of_birth" type="date" {...register("date_of_birth")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gender">Gender</Label>
              <Input id="gender" {...register("gender")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="location">Location</Label>
              <Input id="location" {...register("location")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="skills">Skills (comma separated)</Label>
              <Input id="skills" {...register("skills")} placeholder="React, SQL, Figma" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" rows={2} {...register("address")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emergency_contact">Emergency contact</Label>
            <Input id="emergency_contact" {...register("emergency_contact")} placeholder="Name, phone" />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Save changes" : "Create employee"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
