import { useQuery } from "@tanstack/react-query";
import { Briefcase, Building2, Cake, Mail, MapPin, Phone, ShieldAlert, User2, Wallet } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

import { currency, formatLabel, fullName, initials, statusBadgeVariant, type EmployeeWithRelations } from "./types";

function Field({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value?: string | null }) {
  if (!value) return null;
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

export function EmployeeDetailSheet({
  open,
  onOpenChange,
  employeeId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string | null;
}) {
  const { data: employee, isLoading } = useQuery({
    queryKey: ["employee-detail", employeeId],
    enabled: open && Boolean(employeeId),
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-md overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Employee profile</SheetTitle>
          <SheetDescription>Full record details.</SheetDescription>
        </SheetHeader>

        {isLoading || !employee ? (
          <div className="mt-6 space-y-3">
            <Skeleton className="h-16 w-16 rounded-full" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="flex items-center gap-3">
              <Avatar className="size-14">
                <AvatarFallback className="text-base">{initials(employee)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-base font-semibold">{fullName(employee)}</p>
                <p className="text-[13px] text-muted-foreground">{employee.designation}</p>
                <div className="mt-1 flex gap-1.5">
                  <Badge variant={statusBadgeVariant(employee.status)}>{formatLabel(employee.status)}</Badge>
                  <Badge variant="outline">{formatLabel(employee.employment_type)}</Badge>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-3.5">
              <Field icon={Mail} label="Email" value={employee.email} />
              <Field icon={Phone} label="Phone" value={employee.phone} />
              <Field icon={Building2} label="Department" value={employee.departments?.name} />
              <Field
                icon={User2}
                label="Manager"
                value={employee.manager ? fullName(employee.manager) : undefined}
              />
              <Field icon={Briefcase} label="Employee code" value={employee.employee_code} />
              <Field icon={MapPin} label="Location" value={employee.location} />
              <Field icon={Cake} label="Date of birth" value={employee.date_of_birth} />
              <Field icon={Wallet} label="Base salary" value={currency(employee.base_salary)} />
              <Field icon={ShieldAlert} label="Emergency contact" value={employee.emergency_contact} />
            </div>

            {employee.skills?.length > 0 && (
              <>
                <Separator />
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
              </>
            )}

            {employee.address && (
              <>
                <Separator />
                <div>
                  <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Address</p>
                  <p className="text-[13px]">{employee.address}</p>
                </div>
              </>
            )}

            <Separator />
            <p className="text-[11px] text-muted-foreground">
              Joined {new Date(employee.date_of_joining).toLocaleDateString()}
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
