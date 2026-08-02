import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { Building2, User } from "lucide-react";
import { useState } from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";

interface PaletteItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

/** Live directory search — RLS keeps results scoped to what the user may see. */
function useDirectorySearch(term: string, open: boolean) {
  const query = term.trim();
  return useQuery({
    queryKey: ["palette-search", query],
    enabled: open && query.length >= 2,
    staleTime: 30_000,
    queryFn: async () => {
      const [employees, departments] = await Promise.all([
        supabase
          .from("employees")
          .select("id, first_name, last_name, designation")
          .or(
            `first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,employee_code.ilike.%${query}%,designation.ilike.%${query}%`,
          )
          .limit(6),
        supabase.from("departments").select("id, name, code").ilike("name", `%${query}%`).limit(4),
      ]);
      return {
        employees: employees.data ?? [],
        departments: departments.data ?? [],
      };
    },
  });
}

/** ⌘K navigation, search and action palette. */
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
  const [term, setTerm] = useState("");
  const { data: results } = useDirectorySearch(term, open);

  const go = (to: string) => {
    onOpenChange(false);
    setTerm("");
    navigate({ to });
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search people, departments, pages and actions…"
        value={term}
        onValueChange={setTerm}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {results && results.employees.length > 0 && (
          <CommandGroup heading="People">
            {results.employees.map((e) => (
              <CommandItem
                key={e.id}
                value={`${e.first_name} ${e.last_name} ${e.designation}`}
                onSelect={() => go(`/employees/${e.id}`)}
              >
                <User className="size-4" />
                {e.first_name} {e.last_name}
                <span className="ml-auto text-[12px] text-muted-foreground">{e.designation}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results && results.departments.length > 0 && (
          <CommandGroup heading="Departments">
            {results.departments.map((d) => (
              <CommandItem key={d.id} value={d.name} onSelect={() => go("/departments")}>
                <Building2 className="size-4" />
                {d.name}
                <span className="ml-auto text-[12px] text-muted-foreground">{d.code}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

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
          <CommandItem value="Open the AI toolkit" onSelect={() => go("/ai-tools")}>
            Open the AI toolkit
          </CommandItem>
          <CommandItem value="Post an announcement" onSelect={() => go("/announcements")}>
            Post an announcement
          </CommandItem>
          <CommandItem value="Upload a document" onSelect={() => go("/documents")}>
            Upload a document
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
