import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function ToolCard({
  icon: Icon,
  name,
  description,
  active,
  onClick,
}: {
  icon: LucideIcon;
  name: string;
  description: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "surface-card flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
        active ? "border-primary/60 bg-primary/5" : "border-border hover:border-primary/40 hover:bg-primary/5",
      )}
    >
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          active ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary",
        )}
      >
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="text-[13px] leading-snug text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}
