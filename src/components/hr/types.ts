import type { Database } from "@/integrations/supabase/types";

export type Employee = Database["public"]["Tables"]["employees"]["Row"];
export type Department = Database["public"]["Tables"]["departments"]["Row"];
export type EmploymentType = Database["public"]["Enums"]["employment_type"];
export type EmploymentStatus = Database["public"]["Enums"]["employment_status"];

export type EmployeeWithRelations = Employee & {
  departments: Pick<Department, "id" | "name" | "code"> | null;
  manager: Pick<Employee, "id" | "first_name" | "last_name"> | null;
};

export const EMPLOYMENT_TYPES: EmploymentType[] = ["full_time", "part_time", "contract", "intern"];
export const EMPLOYMENT_STATUSES: EmploymentStatus[] = [
  "active",
  "probation",
  "notice",
  "terminated",
  "on_leave",
];

export function fullName(e: { first_name: string; last_name: string }) {
  return `${e.first_name} ${e.last_name}`.trim();
}

export function initials(e: { first_name: string; last_name: string }) {
  return `${e.first_name?.[0] ?? ""}${e.last_name?.[0] ?? ""}`.toUpperCase();
}

export function formatLabel(value: string) {
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function statusBadgeVariant(status: EmploymentStatus): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "active":
      return "default";
    case "probation":
      return "secondary";
    case "notice":
      return "outline";
    case "on_leave":
      return "secondary";
    case "terminated":
      return "destructive";
    default:
      return "outline";
  }
}

export function currency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    n ?? 0,
  );
}
