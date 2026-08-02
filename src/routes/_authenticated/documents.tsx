import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { motion } from "framer-motion";
import {
  Download,
  Eye,
  FileText,
  FolderOpen,
  Loader2,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination";
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
import { formatLabel, fullName } from "@/components/hr/types";
import { useCurrentEmployee, useProfile, useRoles, useSession } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { formatFileSize, sanitizeFileName } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({
    meta: [
      { title: "Documents — Nexus HR" },
      { name: "description", content: "Upload, organize and manage employee documents securely." },
      { property: "og:title", content: "Documents — Nexus HR" },
      { property: "og:description", content: "Upload, organize and manage employee documents securely." },
    ],
  }),
  component: DocumentsPage,
});

type DocumentRow = Database["public"]["Tables"]["documents"]["Row"] & {
  employees: { id: string; first_name: string; last_name: string } | null;
};

const CATEGORIES = [
  "resume",
  "offer_letter",
  "certificate",
  "id_card",
  "policy",
  "contract",
  "payslip",
  "general",
] as const;

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const PAGE_SIZE = 12;
const BUCKET = "hr-documents";

type SortKey = "date" | "name" | "size";

function DocumentsPage() {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { isStaff } = useRoles(user?.id);
  const { data: profile } = useProfile(user?.id);
  const { data: currentEmployee } = useCurrentEmployee(user?.id);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [page, setPage] = useState(1);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<DocumentRow | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [renameTarget, setRenameTarget] = useState<DocumentRow | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DocumentRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: documents, isLoading, isError } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*, employees(id, first_name, last_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DocumentRow[];
    },
  });

  const { data: employees } = useQuery({
    queryKey: ["employees-lite"],
    enabled: isStaff,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name")
        .order("first_name");
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    let rows = documents ?? [];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (d) => d.title.toLowerCase().includes(q) || (d.file_name ?? "").toLowerCase().includes(q),
      );
    }
    if (category !== "all") rows = rows.filter((d) => d.category === category);
    if (isStaff && employeeFilter !== "all") rows = rows.filter((d) => d.employee_id === employeeFilter);

    rows = [...rows].sort((a, b) => {
      if (sortKey === "name") return a.title.localeCompare(b.title);
      if (sortKey === "size") return (b.file_size ?? 0) - (a.file_size ?? 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return rows;
  }, [documents, search, category, employeeFilter, sortKey, isStaff]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = useMemo(() => {
    const rows = documents ?? [];
    const totalSize = rows.reduce((sum, d) => sum + (d.file_size ?? 0), 0);
    const categoriesCount = new Set(rows.map((d) => d.category)).size;
    const now = new Date();
    const thisMonth = rows.filter((d) => {
      const created = new Date(d.created_at);
      return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth();
    }).length;
    return { total: rows.length, totalSize, categoriesCount, thisMonth };
  }, [documents]);

  const logActivity = async (title: string, description: string, employeeId: string | null) => {
    await supabase.from("activity_events").insert({
      actor_id: user?.id ?? null,
      actor_name: profile?.full_name ?? null,
      employee_id: employeeId,
      kind: "document",
      title,
      description,
    });
  };

  const openPreview = async (doc: DocumentRow) => {
    setPreviewDoc(doc);
    setPreviewUrl(null);
    if (!doc.storage_path) return;
    setPreviewLoading(true);
    try {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.storage_path, 60);
      if (error) throw error;
      setPreviewUrl(data.signedUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not preview file");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownload = async (doc: DocumentRow) => {
    if (!doc.storage_path) return;
    try {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.storage_path, 60);
      if (error) throw error;
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = doc.file_name ?? doc.title;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not download file");
    }
  };

  const handleRename = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    setRenaming(true);
    try {
      const { error } = await supabase
        .from("documents")
        .update({ title: renameValue.trim() })
        .eq("id", renameTarget.id);
      if (error) throw error;
      toast.success("Document renamed");
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setRenameTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not rename document");
    } finally {
      setRenaming(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.storage_path) {
        await supabase.storage.from(BUCKET).remove([deleteTarget.storage_path]);
      }
      const { error } = await supabase.from("documents").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      await logActivity("Document deleted", deleteTarget.title, deleteTarget.employee_id);
      toast.success("Document deleted");
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete document");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
          <p className="text-[13px] text-muted-foreground">
            Upload and manage HR documents such as offer letters, contracts and payslips.
          </p>
        </div>
        <Button onClick={() => setUploadOpen(true)} className="gap-2">
          <Upload className="size-4" /> Upload document
        </Button>
      </header>

      <div className="flex flex-wrap gap-2.5">
        <StatChip icon={FileText} label="Documents" value={String(stats.total)} />
        <StatChip icon={FolderOpen} label="Total size" value={formatFileSize(stats.totalSize)} />
        <StatChip icon={FolderOpen} label="Categories" value={String(stats.categoriesCount)} />
        <StatChip icon={FileText} label="This month" value={String(stats.thisMonth)} />
      </div>

      <Card className="surface-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by title or file name..."
              className="pl-8"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select
              value={category}
              onValueChange={(v) => {
                setCategory(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {formatLabel(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isStaff && (
              <Select
                value={employeeFilter}
                onValueChange={(v) => {
                  setEmployeeFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All employees</SelectItem>
                  {employees?.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {fullName(e)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Newest first</SelectItem>
                <SelectItem value="name">Name (A-Z)</SelectItem>
                <SelectItem value="size">Largest first</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <Card className="surface-card p-10 text-center text-sm text-muted-foreground">
          Failed to load documents.
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="surface-card flex flex-col items-center gap-2 p-12 text-center">
          <FileText className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No documents found</p>
          <p className="text-[13px] text-muted-foreground">
            {documents && documents.length > 0
              ? "Try adjusting your search or filters."
              : "Upload your first document to get started."}
          </p>
        </Card>
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="surface-card overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  {isStaff && <TableHead>Employee</TableHead>}
                  <TableHead>Size</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <FileText className="size-4" />
                        </div>
                        <div>
                          <p className="font-medium leading-tight">{doc.title}</p>
                          <p className="text-[11px] text-muted-foreground">{doc.file_name}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{formatLabel(doc.category)}</Badge>
                    </TableCell>
                    {isStaff && (
                      <TableCell className="text-[13px] text-muted-foreground">
                        {doc.employees ? fullName(doc.employees) : "—"}
                      </TableCell>
                    )}
                    <TableCell className="text-[13px] text-muted-foreground">
                      {formatFileSize(doc.file_size)}
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">
                      {format(new Date(doc.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openPreview(doc)}>
                            <Eye className="mr-2 size-3.5" /> Preview
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownload(doc)}>
                            <Download className="mr-2 size-3.5" /> Download
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setRenameTarget(doc);
                              setRenameValue(doc.title);
                            }}
                          >
                            <Pencil className="mr-2 size-3.5" /> Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleteTarget(doc)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 size-3.5" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {totalPages > 1 && (
            <Pagination className="mt-4">
              <PaginationContent>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <PaginationItem key={i}>
                    <PaginationLink isActive={page === i + 1} onClick={() => setPage(i + 1)}>
                      {i + 1}
                    </PaginationLink>
                  </PaginationItem>
                ))}
              </PaginationContent>
            </Pagination>
          )}
        </motion.div>
      )}

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        isStaff={isStaff}
        employees={employees}
        currentEmployeeId={currentEmployee?.id ?? null}
        onUploaded={(title, description, employeeId) => {
          logActivity(title, description, employeeId);
          queryClient.invalidateQueries({ queryKey: ["documents"] });
        }}
      />

      <Dialog open={Boolean(previewDoc)} onOpenChange={(o) => !o && setPreviewDoc(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{previewDoc?.title}</DialogTitle>
            <DialogDescription>{previewDoc?.file_name}</DialogDescription>
          </DialogHeader>
          <div className="flex min-h-[300px] items-center justify-center rounded-lg border bg-muted/30">
            {previewLoading ? (
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            ) : previewUrl && previewDoc?.mime_type?.startsWith("image/") ? (
              <img src={previewUrl} alt={previewDoc.title} className="max-h-[70vh] max-w-full rounded" />
            ) : previewUrl && previewDoc?.mime_type === "application/pdf" ? (
              <iframe title={previewDoc.title} src={previewUrl} className="h-[70vh] w-full rounded" />
            ) : previewUrl ? (
              <div className="flex flex-col items-center gap-3 p-8 text-center">
                <FileText className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Preview not available for this file type.</p>
                <Button size="sm" onClick={() => previewDoc && handleDownload(previewDoc)} className="gap-2">
                  <Download className="size-4" /> Download instead
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No file attached.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(renameTarget)} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename document</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="rename">Title</Label>
            <Input id="rename" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={renaming} className="gap-2">
              {renaming && <Loader2 className="size-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the file and its record. This cannot be undone.
            </AlertDialogDescription>
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
    </div>
  );
}

function UploadDialog({
  open,
  onOpenChange,
  isStaff,
  employees,
  currentEmployeeId,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isStaff: boolean;
  employees: { id: string; first_name: string; last_name: string }[] | undefined;
  currentEmployeeId: string | null;
  onUploaded: (title: string, description: string, employeeId: string | null) => void;
}) {
  const { user } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("general");
  const [employeeId, setEmployeeId] = useState<string>("__none__");
  const [uploading, setUploading] = useState(false);

  const reset = () => {
    setFile(null);
    setTitle("");
    setCategory("general");
    setEmployeeId("__none__");
  };

  const handleUpload = async () => {
    if (!user || !file) {
      toast.error("Please choose a file to upload");
      return;
    }
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File must be 20MB or smaller");
      return;
    }
    setUploading(true);
    try {
      const path = `${user.id}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file);
      if (uploadError) throw uploadError;

      const resolvedEmployeeId = isStaff
        ? employeeId === "__none__"
          ? null
          : employeeId
        : (currentEmployeeId ?? null);

      const { error: insertError } = await supabase.from("documents").insert({
        owner_id: user.id,
        employee_id: resolvedEmployeeId,
        title: title.trim(),
        category,
        storage_path: path,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || null,
      });
      if (insertError) throw insertError;

      toast.success("Document uploaded");
      onUploaded("Document uploaded", title.trim(), resolvedEmployeeId);
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload document</DialogTitle>
          <DialogDescription>Files up to 20MB are supported.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="file">File</Label>
            <Input
              id="file"
              type="file"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                if (f && !title) setTitle(f.name.replace(/\.[^/.]+$/, ""));
              }}
            />
            {file && (
              <p className="text-[11px] text-muted-foreground">
                {file.name} · {formatFileSize(file.size)}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {formatLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isStaff && (
              <div className="space-y-1.5">
                <Label>Employee (optional)</Label>
                <Select value={employeeId} onValueChange={setEmployeeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {employees?.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {fullName(e)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={uploading} className="gap-2">
            {uploading && <Loader2 className="size-4 animate-spin" />}
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatChip({ icon: Icon, label, value }: { icon: typeof FileText; label: string; value: string }) {
  return (
    <div className="surface-card flex items-center gap-2.5 rounded-xl px-3.5 py-2">
      <Icon className="size-4 text-primary" />
      <div>
        <p className="text-[15px] font-semibold leading-none">{value}</p>
        <p className="text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
