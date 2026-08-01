import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Lock, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoles, useSession } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({
    meta: [
      { title: "Audit log · Nexus HR" },
      { name: "description", content: "Review system audit trail: who did what, when, in Nexus HR." },
      { property: "og:title", content: "Audit log · Nexus HR" },
      { property: "og:description", content: "Searchable, filterable audit trail for administrators." },
    ],
  }),
  component: AuditPage,
});

const PAGE_SIZE = 20;

function AuditPage() {
  const { user } = useSession();
  const { isAdmin, isLoading: rolesLoading } = useRoles(user?.id);

  const [search, setSearch] = useState("");
  const [action, setAction] = useState<string>("all");
  const [entity, setEntity] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: facets } = useQuery({
    queryKey: ["audit-facets"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_logs").select("action, entity");
      if (error) throw error;
      return {
        actions: Array.from(new Set((data ?? []).map((r) => r.action))).sort(),
        entities: Array.from(new Set((data ?? []).map((r) => r.entity))).sort(),
      };
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", search, action, entity, from, to, page],
    enabled: isAdmin,
    queryFn: async () => {
      let query = supabase
        .from("audit_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (search.trim()) {
        query = query.or(
          `actor_email.ilike.%${search.trim()}%,action.ilike.%${search.trim()}%,entity.ilike.%${search.trim()}%`,
        );
      }
      if (action !== "all") query = query.eq("action", action);
      if (entity !== "all") query = query.eq("entity", entity);
      if (from) query = query.gte("created_at", new Date(from).toISOString());
      if (to) query = query.lte("created_at", new Date(to + "T23:59:59").toISOString());

      const { data: rows, error, count } = await query;
      if (error) throw error;
      return { rows: rows ?? [], count: count ?? 0 };
    },
  });

  const totalPages = useMemo(() => Math.max(1, Math.ceil((data?.count ?? 0) / PAGE_SIZE)), [data?.count]);

  if (!rolesLoading && !isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="surface-card max-w-md text-center">
          <CardHeader>
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-muted">
              <Lock className="size-5 text-muted-foreground" />
            </div>
            <CardTitle>Access restricted</CardTitle>
            <CardDescription>The audit log is only visible to administrators.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit log</h1>
        <p className="text-sm text-muted-foreground">A trail of actions taken across the workspace.</p>
      </div>

      <Card className="surface-card">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Search</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder="Actor, action, entity..."
                className="pl-8"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Action</label>
            <Select
              value={action}
              onValueChange={(v) => {
                setAction(v);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {facets?.actions.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Entity</label>
            <Select
              value={entity}
              onValueChange={(v) => {
                setEntity(v);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All entities</SelectItem>
                {facets?.entities.map((e) => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">From</label>
            <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} className="w-40" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">To</label>
            <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} className="w-40" />
          </div>
        </CardContent>
      </Card>

      <Card className="surface-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Entity ID</TableHead>
              <TableHead>When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell>
                </TableRow>
              ))}
            {!isLoading && data?.rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No audit entries match your filters.
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              data?.rows.map((row) => (
                <>
                  <TableRow
                    key={row.id}
                    className="cursor-pointer"
                    onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                  >
                    <TableCell>
                      {expanded === row.id ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    </TableCell>
                    <TableCell className="text-sm">{row.actor_email ?? "—"}</TableCell>
                    <TableCell><Badge variant="secondary">{row.action}</Badge></TableCell>
                    <TableCell className="text-sm">{row.entity}</TableCell>
                    <TableCell className="max-w-[160px] truncate text-xs text-muted-foreground">
                      {row.entity_id ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(row.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                  {expanded === row.id && (
                    <TableRow key={`${row.id}-meta`}>
                      <TableCell colSpan={6} className="bg-muted/30">
                        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md bg-background/60 p-3 text-xs">
                          {JSON.stringify(row.metadata, null, 2)}
                        </pre>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between border-t border-border p-3 text-sm text-muted-foreground">
          <span>
            Page {page + 1} of {totalPages} · {data?.count ?? 0} entries
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
