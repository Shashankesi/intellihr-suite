import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { format, formatDistanceToNow, isFuture, parseISO } from "date-fns";
import { motion } from "framer-motion";
import {
  CalendarDays,
  Loader2,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useProfile, useRoles, useSession } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/announcements")({
  head: () => ({
    meta: [
      { title: "Announcements — Nexus HR" },
      { name: "description", content: "Company announcements and the holiday calendar." },
      { property: "og:title", content: "Announcements — Nexus HR" },
      { property: "og:description", content: "Company announcements and the holiday calendar." },
    ],
  }),
  component: AnnouncementsPage,
});

type Announcement = Database["public"]["Tables"]["announcements"]["Row"];
type Holiday = Database["public"]["Tables"]["holidays"]["Row"];

const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
const AUDIENCES = ["all", "staff", "employees"] as const;
const HOLIDAY_TYPES = ["public", "optional", "company"] as const;

function priorityVariant(p: string): "default" | "secondary" | "destructive" | "outline" {
  switch (p) {
    case "urgent":
      return "destructive";
    case "high":
      return "default";
    case "normal":
      return "secondary";
    default:
      return "outline";
  }
}

function holidayVariant(t: string): "default" | "secondary" | "outline" {
  switch (t) {
    case "public":
      return "default";
    case "company":
      return "secondary";
    default:
      return "outline";
  }
}

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
}

function AnnouncementsPage() {
  const { user } = useSession();
  const { isStaff } = useRoles(user?.id);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Announcements</h1>
        <p className="text-[13px] text-muted-foreground">
          Company-wide updates and the holiday calendar, all in one place.
        </p>
      </header>

      <Tabs defaultValue="announcements">
        <TabsList>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
          <TabsTrigger value="holidays">Holidays</TabsTrigger>
        </TabsList>
        <TabsContent value="announcements" className="mt-4">
          <AnnouncementsTab isStaff={isStaff} />
        </TabsContent>
        <TabsContent value="holidays" className="mt-4">
          <HolidaysTab isStaff={isStaff} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------------------- Announcements ---------------------------- */

const announcementSchema = z.object({
  title: z.string().trim().min(3, "At least 3 characters").max(140, "Max 140 characters"),
  body: z.string().trim().min(1, "Required").max(5000, "Max 5000 characters"),
  audience: z.enum(AUDIENCES),
  priority: z.enum(PRIORITIES),
  pinned: z.boolean(),
  published: z.boolean(),
  publish_at: z.string().min(1, "Required"),
  expires_at: z.string().optional().or(z.literal("")),
});

type AnnouncementFormValues = z.infer<typeof announcementSchema>;

function AnnouncementsTab({ isStaff }: { isStaff: boolean }) {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { data: profile } = useProfile(user?.id);

  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [showUnpublished, setShowUnpublished] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: announcements, isLoading, isError } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("pinned", { ascending: false })
        .order("publish_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    let rows = announcements ?? [];
    if (!showUnpublished) {
      rows = rows.filter((a) => a.published && !isFuture(parseISO(a.publish_at)));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (a) => a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q),
      );
    }
    if (priorityFilter !== "all") rows = rows.filter((a) => a.priority === priorityFilter);
    return rows;
  }, [announcements, search, priorityFilter, showUnpublished]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("announcements").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      await supabase.from("activity_events").insert({
        actor_id: user?.id ?? null,
        actor_name: profile?.full_name ?? null,
        employee_id: null,
        kind: "announcement",
        title: "Announcement deleted",
        description: deleteTarget.title,
      });
      toast.success("Announcement deleted");
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete announcement");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="surface-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search announcements..."
              className="pl-8"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isStaff && (
              <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <Switch checked={showUnpublished} onCheckedChange={setShowUnpublished} />
                Show unpublished
              </label>
            )}
            {isStaff && (
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
                className="gap-2"
              >
                <Plus className="size-4" /> New announcement
              </Button>
            )}
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <Card className="surface-card p-10 text-center text-sm text-muted-foreground">
          Failed to load announcements.
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="surface-card flex flex-col items-center gap-2 p-12 text-center">
          <Sparkles className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No announcements</p>
          <p className="text-[13px] text-muted-foreground">
            {announcements && announcements.length > 0
              ? "Try adjusting your search or filters."
              : "Nothing has been posted yet."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="surface-card space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {a.pinned && <Pin className="size-3.5 text-primary" />}
                    <h3 className="font-semibold leading-tight">{a.title}</h3>
                  </div>
                  {isStaff && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8 shrink-0">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditing(a);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="mr-2 size-3.5" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleteTarget(a)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 size-3.5" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-[13px] text-muted-foreground">{a.body}</p>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <Badge variant={priorityVariant(a.priority)}>{a.priority}</Badge>
                  <Badge variant="outline">{a.audience}</Badge>
                  {!a.published && <Badge variant="outline">Draft</Badge>}
                  <span>
                    {formatDistanceToNow(parseISO(a.publish_at), { addSuffix: true })}
                  </span>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {isStaff && (
        <>
          <AnnouncementFormDialog
            open={formOpen}
            onOpenChange={setFormOpen}
            announcement={editing}
          />
          <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {deleteTarget?.title}?</AlertDialogTitle>
                <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    handleDelete();
                  }}
                  disabled={deleting}
                  className="gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting && <Loader2 className="size-4 animate-spin" />}
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}

function AnnouncementFormDialog({
  open,
  onOpenChange,
  announcement,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  announcement?: Announcement | null;
}) {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { data: profile } = useProfile(user?.id);
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(announcement);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AnnouncementFormValues>({
    resolver: zodResolver(announcementSchema),
    defaultValues: {
      title: "",
      body: "",
      audience: "all",
      priority: "normal",
      pinned: false,
      published: true,
      publish_at: toLocalInputValue(new Date().toISOString()),
      expires_at: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (announcement) {
      reset({
        title: announcement.title,
        body: announcement.body,
        audience: announcement.audience as AnnouncementFormValues["audience"],
        priority: announcement.priority as AnnouncementFormValues["priority"],
        pinned: announcement.pinned,
        published: announcement.published,
        publish_at: toLocalInputValue(announcement.publish_at),
        expires_at: announcement.expires_at ? toLocalInputValue(announcement.expires_at) : "",
      });
    } else {
      reset({
        title: "",
        body: "",
        audience: "all",
        priority: "normal",
        pinned: false,
        published: true,
        publish_at: toLocalInputValue(new Date().toISOString()),
        expires_at: "",
      });
    }
  }, [open, announcement, reset]);

  const onSubmit = async (values: AnnouncementFormValues) => {
    setSaving(true);
    try {
      const payload = {
        title: values.title,
        body: values.body,
        audience: values.audience,
        priority: values.priority,
        pinned: values.pinned,
        published: values.published,
        publish_at: new Date(values.publish_at).toISOString(),
        expires_at: values.expires_at ? new Date(values.expires_at).toISOString() : null,
      };

      if (isEdit && announcement) {
        const { error } = await supabase.from("announcements").update(payload).eq("id", announcement.id);
        if (error) throw error;
        toast.success("Announcement updated");
      } else {
        const { error } = await supabase
          .from("announcements")
          .insert({ ...payload, author_id: user?.id ?? null });
        if (error) throw error;
        toast.success("Announcement created");
      }

      await supabase.from("activity_events").insert({
        actor_id: user?.id ?? null,
        actor_name: profile?.full_name ?? null,
        employee_id: null,
        kind: "announcement",
        title: isEdit ? "Announcement updated" : "Announcement posted",
        description: values.title,
      });

      queryClient.invalidateQueries({ queryKey: ["announcements"] });
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
          <DialogTitle>{isEdit ? "Edit announcement" : "New announcement"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this announcement." : "Share an update with the company."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...register("title")} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="body">Body</Label>
            <Textarea id="body" rows={5} {...register("body")} />
            {errors.body && <p className="text-xs text-destructive">{errors.body.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Audience</Label>
              <Select
                value={watch("audience")}
                onValueChange={(v) => setValue("audience", v as AnnouncementFormValues["audience"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUDIENCES.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a.charAt(0).toUpperCase() + a.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select
                value={watch("priority")}
                onValueChange={(v) => setValue("priority", v as AnnouncementFormValues["priority"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="publish_at">Publish at</Label>
              <Input id="publish_at" type="datetime-local" {...register("publish_at")} />
              {errors.publish_at && <p className="text-xs text-destructive">{errors.publish_at.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expires_at">Expires at (optional)</Label>
              <Input id="expires_at" type="datetime-local" {...register("expires_at")} />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={watch("pinned")} onCheckedChange={(v) => setValue("pinned", v)} />
              Pinned
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={watch("published")} onCheckedChange={(v) => setValue("published", v)} />
              Published
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Save changes" : "Post announcement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------- Holidays ------------------------------- */

const holidaySchema = z.object({
  name: z.string().trim().min(1, "Required").max(120),
  holiday_date: z.string().min(1, "Required"),
  type: z.enum(HOLIDAY_TYPES),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});

type HolidayFormValues = z.infer<typeof holidaySchema>;

function HolidaysTab({ isStaff }: { isStaff: boolean }) {
  const queryClient = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Holiday | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Holiday | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: holidays, isLoading, isError } = useQuery({
    queryKey: ["holidays"],
    queryFn: async () => {
      const { data, error } = await supabase.from("holidays").select("*").order("holiday_date");
      if (error) throw error;
      return data ?? [];
    },
  });

  const yearHolidays = useMemo(
    () => (holidays ?? []).filter((h) => new Date(h.holiday_date).getFullYear() === year),
    [holidays, year],
  );

  const upcoming = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return (holidays ?? [])
      .filter((h) => new Date(h.holiday_date) >= today)
      .sort((a, b) => new Date(a.holiday_date).getTime() - new Date(b.holiday_date).getTime())
      .slice(0, 5);
  }, [holidays]);

  const grouped = useMemo(() => {
    const map = new Map<string, Holiday[]>();
    for (const h of yearHolidays) {
      const month = format(new Date(h.holiday_date), "MMMM");
      map.set(month, [...(map.get(month) ?? []), h]);
    }
    return Array.from(map.entries());
  }, [yearHolidays]);

  const availableYears = useMemo(() => {
    const years = new Set((holidays ?? []).map((h) => new Date(h.holiday_date).getFullYear()));
    years.add(new Date().getFullYear());
    return Array.from(years).sort();
  }, [holidays]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("holidays").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      toast.success("Holiday removed");
      queryClient.invalidateQueries({ queryKey: ["holidays"] });
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove holiday");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableYears.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isStaff && (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="gap-2"
          >
            <Plus className="size-4" /> Add holiday
          </Button>
        )}
      </div>

      {upcoming.length > 0 && (
        <Card className="surface-card p-5">
          <h3 className="mb-3 text-sm font-semibold">Upcoming holidays</h3>
          <div className="flex flex-wrap gap-2.5">
            {upcoming.map((h) => (
              <div key={h.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px]">
                <CalendarDays className="size-3.5 text-primary" />
                <span className="font-medium">{h.name}</span>
                <span className="text-muted-foreground">
                  {format(new Date(h.holiday_date), "MMM d, yyyy")}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <Card className="surface-card p-10 text-center text-sm text-muted-foreground">
          Failed to load holidays.
        </Card>
      ) : yearHolidays.length === 0 ? (
        <Card className="surface-card flex flex-col items-center gap-2 p-12 text-center">
          <CalendarDays className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No holidays for {year}</p>
          <p className="text-[13px] text-muted-foreground">
            {isStaff ? "Add a holiday to populate the calendar." : "Check back later."}
          </p>
        </Card>
      ) : (
        <div className="space-y-5">
          {grouped.map(([month, items]) => (
            <div key={month} className="space-y-2">
              <h4 className="text-[13px] font-semibold text-muted-foreground">{month}</h4>
              <div className="space-y-2">
                {items.map((h) => (
                  <Card key={h.id} className="surface-card flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <CalendarDays className="size-4" />
                      </div>
                      <div>
                        <p className="font-medium leading-tight">{h.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {format(new Date(h.holiday_date), "EEEE, MMM d, yyyy")}
                        </p>
                        {h.description && (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">{h.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={holidayVariant(h.type)}>{h.type}</Badge>
                      {isStaff && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditing(h);
                                setFormOpen(true);
                              }}
                            >
                              <Pencil className="mr-2 size-3.5" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteTarget(h)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 size-3.5" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {isStaff && (
        <>
          <HolidayFormDialog open={formOpen} onOpenChange={setFormOpen} holiday={editing} />
          <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove {deleteTarget?.name}?</AlertDialogTitle>
                <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    handleDelete();
                  }}
                  disabled={deleting}
                  className="gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting && <Loader2 className="size-4 animate-spin" />}
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}

function HolidayFormDialog({
  open,
  onOpenChange,
  holiday,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  holiday?: Holiday | null;
}) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(holiday);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<HolidayFormValues>({
    resolver: zodResolver(holidaySchema),
    defaultValues: { name: "", holiday_date: "", type: "public", description: "" },
  });

  useEffect(() => {
    if (!open) return;
    if (holiday) {
      reset({
        name: holiday.name,
        holiday_date: holiday.holiday_date,
        type: holiday.type as HolidayFormValues["type"],
        description: holiday.description ?? "",
      });
    } else {
      reset({ name: "", holiday_date: "", type: "public", description: "" });
    }
  }, [open, holiday, reset]);

  const onSubmit = async (values: HolidayFormValues) => {
    setSaving(true);
    try {
      const payload = {
        name: values.name,
        holiday_date: values.holiday_date,
        type: values.type,
        description: values.description || null,
      };
      if (isEdit && holiday) {
        const { error } = await supabase.from("holidays").update(payload).eq("id", holiday.id);
        if (error) throw error;
        toast.success("Holiday updated");
      } else {
        const { error } = await supabase.from("holidays").insert(payload);
        if (error) throw error;
        toast.success("Holiday added");
      }
      queryClient.invalidateQueries({ queryKey: ["holidays"] });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit holiday" : "Add holiday"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="holiday_date">Date</Label>
              <Input id="holiday_date" type="date" {...register("holiday_date")} />
              {errors.holiday_date && (
                <p className="text-xs text-destructive">{errors.holiday_date.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={watch("type")}
                onValueChange={(v) => setValue("type", v as HolidayFormValues["type"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOLIDAY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea id="description" rows={3} {...register("description")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Save changes" : "Add holiday"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
