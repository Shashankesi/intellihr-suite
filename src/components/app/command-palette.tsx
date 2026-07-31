import { useNavigate } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface PaletteItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

/** ⌘K navigation palette. */
export function CommandPalette({
  open,
  onOpenChange,
  items,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: PaletteItem[];
}) {
  const navigate = useNavigate();

  const go = (to: string) => {
    onOpenChange(false);
    navigate({ to });
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search pages and actions…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigate">
          {items.map((item) => (
            <CommandItem key={item.to} value={item.label} onSelect={() => go(item.to)}>
              <item.icon className="size-4" />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Actions">
          <CommandItem value="Ask the AI copilot" onSelect={() => go("/copilot")}>
            Ask the AI copilot
          </CommandItem>
          <CommandItem value="Apply for leave" onSelect={() => go("/leave")}>
            Apply for leave
          </CommandItem>
          <CommandItem value="Clock in or out" onSelect={() => go("/attendance")}>
            Clock in or out
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
