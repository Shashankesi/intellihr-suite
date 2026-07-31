import { cn } from "@/lib/utils";

/** Nexus HR wordmark. `compact` renders the glyph only (collapsed sidebar). */
export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-[10px] gradient-brand shadow-brand-glow">
        <svg viewBox="0 0 24 24" className="size-4 text-primary-foreground" aria-hidden="true">
          <path
            fill="currentColor"
            d="M5 3h3v7.2L16 3h3v18h-3v-7.2L8 21H5V3Z"
            opacity="0.95"
          />
        </svg>
      </span>
      {!compact && (
        <span className="text-[0.98rem] font-semibold tracking-tight">
          Nexus<span className="text-muted-foreground font-normal">HR</span>
        </span>
      )}
    </span>
  );
}
