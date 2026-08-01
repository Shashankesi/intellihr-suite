import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
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

import type { Department } from "./types";

const departmentSchema = z.object({
  name: z.string().trim().min(1, "Required").max(120),
  code: z
    .string()
    .trim()
    .min(1, "Required")
    .max(10)
    .transform((v) => v.toUpperCase()),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  head_employee_id: z.string().uuid().optional().or(z.literal("")),
  budget: z.coerce.number().min(0, "Must be positive"),
  location: z.string().trim().max(120).optional().or(z.literal("")),
});

type DepartmentFormValues = z.infer<typeof departmentSchema>;

const NONE = "__none__";

export function DepartmentFormDialog({
  open,
  onOpenChange,
  department,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department?: Department | null;
}) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(department);

  const { data: employees } = useQuery({
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
  } = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentSchema),
    defaultValues: { name: "", code: "", description: "", head_employee_id: "", budget: 0, location: "" },
  });

  useEffect(() => {
    if (!open) return;
    if (department) {
      reset({
        name: department.name,
        code: department.code,
        description: department.description ?? "",
        head_employee_id: department.head_employee_id ?? "",
        budget: department.budget,
        location: department.location ?? "",
      });
    } else {
      reset({ name: "", code: "", description: "", head_employee_id: "", budget: 0, location: "" });
    }
  }, [open, department, reset]);

  const onSubmit = async (values: DepartmentFormValues) => {
    setSaving(true);
    try {
      const payload = {
        name: values.name,
        code: values.code,
        description: values.description || null,
        head_employee_id: values.head_employee_id || null,
        budget: values.budget,
        location: values.location || null,
      };

      if (isEdit && department) {
        const { error } = await supabase.from("departments").update(payload).eq("id", department.id);
        if (error) throw error;
        toast.success("Department updated");
      } else {
        const { error } = await supabase.from("departments").insert(payload);
        if (error) throw error;
        toast.success("Department created");
      }
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit department" : "Add department"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update department details." : "Create a new department."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="code">Code</Label>
              <Input id="code" {...register("code")} placeholder="ENG" />
              {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={3} {...register("description")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Head of department</Label>
              <Select
                value={watch("head_employee_id") || NONE}
                onValueChange={(v) => setValue("head_employee_id", v === NONE ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {employees?.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.first_name} {e.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="budget">Budget</Label>
              <Input id="budget" type="number" step="0.01" {...register("budget")} />
              {errors.budget && <p className="text-xs text-destructive">{errors.budget.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="location">Location</Label>
            <Input id="location" {...register("location")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Save changes" : "Create department"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
