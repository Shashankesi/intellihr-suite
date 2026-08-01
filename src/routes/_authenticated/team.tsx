import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Check, Copy, KeyRound, Loader2, Plus, ShieldAlert, ShieldCheck, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRoles, useSession, type AppRole } from "@/hooks/use-auth";
import { redeemInviteCode } from "@/hooks/use-invite";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Team & roles — Nexus HR" },
      {
        name: "description",
        content: "Grant admin, HR or employee access and issue single-use workspace access codes.",
      },
      { property: "og:title", content: "Team & roles — Nexus HR" },
      {
        property: "og:description",
        content: "Grant admin, HR or employee access and issue single-use workspace access codes.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeamPage,
});

const ROLES: AppRole[] = ["admin", "hr", "employee"];

const ROLE_STYLE: Record<AppRole, string> = {
  admin: "border-primary/40 bg-primary-soft text-primary",
  hr: "border-warning/40 bg-warning/10 text-warning",
  employee: "border-border bg-secondary text-muted-foreground",
};

const inviteSchema = z.object({
  role: z.enum(["admin", "hr", "employee"]),
  email: z.string().trim().email("Enter a valid email").max(255).optional().or(z.literal("")),
  note: z.string().trim().max(140).optional(),
});

function randomCode(role: AppRole) {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const part = Array.from(
    { length: 6 },
    () => alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join("");
  return `NEXUS-${role.toUpperCase()}-${part}`;
}

function TeamPage() {
  const { user } = useSession();
  const { isAdmin, isStaff, isPending } = useRoles(user?.id);

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team &amp; roles</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Access levels are enforced in the database — every page, query and mutation respects
            them.
          </p>
        </div>
      </header>

      {isStaff ? (
        <Tabs defaultValue="members">
          <TabsList>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="codes">Access codes</TabsTrigger>
            <TabsTrigger value="matrix">Permission matrix</TabsTrigger>
          </TabsList>
          <TabsContent value="members" className="mt-4">
            <MembersTable isAdmin={isAdmin} currentUserId={user?.id} />
          </TabsContent>
          <TabsContent value="codes" className="mt-4">
            <InviteCodes isAdmin={isAdmin} currentUserId={user?.id} />
          </TabsContent>
          <TabsContent value="matrix" className="mt-4">
            <PermissionMatrix />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <RedeemCard />
          <PermissionMatrix />
        </div>
      )}
    </div>
  );
}

/* ------------------------------- members -------------------------------- */

function MembersTable({ isAdmin, currentUserId }: { isAdmin: boolean; currentUserId?: string }) {
  const queryClient = useQueryClient();

  const members = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, job_title, created_at").order("created_at"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;

      return (profilesRes.data ?? []).map((profile) => ({
        ...profile,
        roles: (rolesRes.data ?? [])
          .filter((r) => r.user_id === profile.id)
          .map((r) => r.role as AppRole),
      }));
    },
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error: delError } = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (delError) throw delError;
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
      await supabase.from("notifications").insert({
        user_id: userId,
        title: "Your access level changed",
        body: `You now have ${role.toUpperCase()} access in Nexus HR.`,
        category: "security",
        link: "/team",
      });
    },
    onSuccess: () => {
      toast.success("Role updated");
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (error: Error) => toast.error("Could not update role", { description: error.message }),
  });

  if (members.isPending) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (members.error) {
    return (
      <div className="surface-card p-6 text-[13px] text-muted-foreground">
        Could not load members: {(members.error as Error).message}
      </div>
    );
  }

  const rows = members.data ?? [];

  return (
    <div className="surface-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
        <Users className="size-4 text-muted-foreground" />
        <p className="text-[13px] font-medium">{rows.length} workspace members</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead className="hidden sm:table-cell">Title</TableHead>
            <TableHead>Access level</TableHead>
            <TableHead className="w-[160px] text-right">Change</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((member) => {
            const role: AppRole = member.roles.includes("admin")
              ? "admin"
              : member.roles.includes("hr")
                ? "hr"
                : "employee";
            const self = member.id === currentUserId;
            return (
              <TableRow key={member.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar className="size-7">
                      <AvatarFallback className="bg-primary-soft text-[11px] font-semibold text-primary">
                        {(member.full_name || member.email).slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">{member.full_name || "—"}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{member.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden text-[13px] text-muted-foreground sm:table-cell">
                  {member.job_title || "—"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn("uppercase", ROLE_STYLE[role])}>
                    {role}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {isAdmin && !self ? (
                    <Select
                      value={role}
                      onValueChange={(next) =>
                        setRole.mutate({ userId: member.id, role: next as AppRole })
                      }
                    >
                      <SelectTrigger className="ml-auto h-8 w-[130px] text-[12px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r} className="text-[12px]">
                            {r.toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">
                      {self ? "You" : "Admin only"}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/* ----------------------------- access codes ----------------------------- */

function InviteCodes({ isAdmin, currentUserId }: { isAdmin: boolean; currentUserId?: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<AppRole>("hr");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const invites = useQuery({
    queryKey: ["workspace-invites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_invites")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createInvite = useMutation({
    mutationFn: async () => {
      const parsed = inviteSchema.parse({ role, email, note });
      const { data, error } = await supabase
        .from("workspace_invites")
        .insert({
          code: randomCode(parsed.role),
          role: parsed.role,
          email: parsed.email ? parsed.email : null,
          note: parsed.note || null,
          created_by: currentUserId!,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (invite) => {
      toast.success("Access code created", { description: invite.code });
      setOpen(false);
      setEmail("");
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["workspace-invites"] });
    },
    onError: (error: Error) =>
      toast.error("Could not create code", { description: error.message }),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workspace_invites").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Code revoked");
      queryClient.invalidateQueries({ queryKey: ["workspace-invites"] });
    },
    onError: (error: Error) => toast.error("Could not revoke", { description: error.message }),
  });

  const copy = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 1600);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-[13px] text-muted-foreground">
          Single-use codes let a new hire pick HR or admin access at signup. They expire after 30
          days and can be locked to one email address.
        </p>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="hero" size="sm">
                <Plus className="size-4" /> New access code
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Issue an access code</DialogTitle>
                <DialogDescription>
                  The code grants the selected access level the first time it is redeemed.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Access level</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-email">Lock to email (optional)</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="new.hire@company.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-note">Note (optional)</Label>
                  <Input
                    id="invite-note"
                    placeholder="HR lead — Bangalore"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="hero"
                  onClick={() => createInvite.mutate()}
                  disabled={createInvite.isPending}
                >
                  {createInvite.isPending && <Loader2 className="animate-spin" />} Generate code
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {invites.isPending ? (
        <Skeleton className="h-48 w-full rounded-2xl" />
      ) : (invites.data ?? []).length === 0 ? (
        <div className="surface-card grid place-items-center gap-2 p-10 text-center">
          <KeyRound className="size-6 text-muted-foreground" />
          <p className="text-[13px] font-medium">No access codes yet</p>
          <p className="text-[12px] text-muted-foreground">
            Generate one to onboard an HR manager or a second administrator.
          </p>
        </div>
      ) : (
        <div className="surface-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden md:table-cell">Reserved for</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[90px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(invites.data ?? []).map((invite) => {
                const expired = new Date(invite.expires_at) < new Date();
                return (
                  <TableRow key={invite.id}>
                    <TableCell>
                      <button
                        onClick={() => copy(invite.code)}
                        className="flex items-center gap-2 font-mono text-[12px] hover:text-primary"
                      >
                        {invite.code}
                        {copied === invite.code ? (
                          <Check className="size-3.5 text-success" />
                        ) : (
                          <Copy className="size-3.5 opacity-60" />
                        )}
                      </button>
                      {invite.note && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{invite.note}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn("uppercase", ROLE_STYLE[invite.role as AppRole])}
                      >
                        {invite.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden text-[12px] text-muted-foreground md:table-cell">
                      {invite.email || "Anyone"}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "text-[12px]",
                          invite.used_at
                            ? "text-muted-foreground"
                            : expired
                              ? "text-destructive"
                              : "text-success",
                        )}
                      >
                        {invite.used_at ? "Redeemed" : expired ? "Expired" : "Active"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          onClick={() => revoke.mutate(invite.id)}
                          aria-label="Revoke code"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- redeem --------------------------------- */

function RedeemCard() {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const [code, setCode] = useState("");

  const redeem = useMutation({
    mutationFn: () => redeemInviteCode(code),
    onSuccess: (role) => {
      toast.success(`Access level activated: ${role.toUpperCase()}`);
      setCode("");
      queryClient.invalidateQueries({ queryKey: ["roles", user?.id] });
    },
    onError: (error: Error) => toast.error("Code rejected", { description: error.message }),
  });

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="surface-card p-6">
      <div className="flex items-center gap-2">
        <KeyRound className="size-4 text-primary" />
        <h2 className="text-[15px] font-semibold">Have an access code?</h2>
      </div>
      <p className="mt-1.5 text-[13px] text-muted-foreground">
        Redeem a code from your administrator to unlock HR or admin capabilities.
      </p>
      <div className="mt-4 flex gap-2">
        <Input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="NEXUS-HR-2F4K"
          className="font-mono"
        />
        <Button
          variant="hero"
          onClick={() => redeem.mutate()}
          disabled={code.trim().length < 4 || redeem.isPending}
        >
          {redeem.isPending && <Loader2 className="animate-spin" />} Redeem
        </Button>
      </div>
    </motion.div>
  );
}

/* --------------------------- permission matrix --------------------------- */

const MATRIX: { capability: string; admin: boolean; hr: boolean; employee: boolean }[] = [
  { capability: "View own attendance, leave, payslips, goals", admin: true, hr: true, employee: true },
  { capability: "Clock in / out and request leave", admin: true, hr: true, employee: true },
  { capability: "Browse the full employee directory", admin: true, hr: true, employee: false },
  { capability: "Create & edit employees and departments", admin: true, hr: true, employee: false },
  { capability: "Approve or reject leave requests", admin: true, hr: true, employee: false },
  { capability: "Run payroll and publish payslips", admin: true, hr: true, employee: false },
  { capability: "Create reviews and assign goals", admin: true, hr: true, employee: false },
  { capability: "Org-wide analytics", admin: true, hr: true, employee: false },
  { capability: "Issue access codes & change roles", admin: true, hr: false, employee: false },
  { capability: "Read the audit log", admin: true, hr: false, employee: false },
];

function PermissionMatrix() {
  return (
    <div className="surface-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
        <ShieldCheck className="size-4 text-success" />
        <p className="text-[13px] font-medium">What each role can do</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Capability</TableHead>
            <TableHead className="w-[80px] text-center">Admin</TableHead>
            <TableHead className="w-[80px] text-center">HR</TableHead>
            <TableHead className="w-[90px] text-center">Employee</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {MATRIX.map((row) => (
            <TableRow key={row.capability}>
              <TableCell className="text-[13px]">{row.capability}</TableCell>
              {[row.admin, row.hr, row.employee].map((allowed, index) => (
                <TableCell key={index} className="text-center">
                  {allowed ? (
                    <Check className="mx-auto size-4 text-success" />
                  ) : (
                    <ShieldAlert className="mx-auto size-4 text-muted-foreground/50" />
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
