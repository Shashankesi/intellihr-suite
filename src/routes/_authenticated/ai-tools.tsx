import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Briefcase,
  ClipboardCheck,
  FileSearch,
  FileText,
  GraduationCap,
  History,
  Mail,
  MessageSquareHeart,
  Loader2,
  NotebookPen,
  Route as RouteIcon,
  ScrollText,
  Search,
  ShieldQuestion,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AiResult } from "@/components/ai/ai-result";
import { ToolCard } from "@/components/ai/tool-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentEmployee, useRoles, useSession } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { runAiTool } from "@/lib/ai-tools.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ai-tools")({
  head: () => ({
    meta: [
      { title: "AI Toolkit · Nexus HR" },
      {
        name: "description",
        content: "A workspace of AI-powered HR tools for recruiting, people development, operations and leadership.",
      },
      { property: "og:title", content: "AI Toolkit · Nexus HR" },
      { property: "og:description", content: "Generate resumes reviews, job descriptions, insights and more with AI." },
    ],
  }),
  component: AiToolsPage,
});

type FieldType = "textarea" | "text" | "select" | "employee-picker";

type FieldConfig = {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  options?: { value: string; label: string }[];
  optional?: boolean;
};

type ToolConfig = {
  id:
    | "resume_analyzer"
    | "job_description"
    | "interview_questions"
    | "skill_gap"
    | "career_path"
    | "email_generator"
    | "policy_assistant"
    | "meeting_notes"
    | "feedback_sentiment"
    | "offer_letter"
    | "performance_summary"
    | "attendance_insights"
    | "leave_recommendation"
    | "executive_report"
    | "smart_search";
  name: string;
  description: string;
  icon: typeof Sparkles;
  category: "Recruiting" | "People" | "Operations" | "Leadership";
  staffOnly: boolean;
  fields: FieldConfig[];
};

const TOOLS: ToolConfig[] = [
  {
    id: "resume_analyzer",
    name: "Resume Analyzer",
    description: "Score a candidate's resume against a target role.",
    icon: FileSearch,
    category: "Recruiting",
    staffOnly: true,
    fields: [
      { name: "role", label: "Target role", type: "text", placeholder: "e.g. Senior Backend Engineer" },
      { name: "resumeText", label: "Resume text", type: "textarea", placeholder: "Paste the candidate's resume text…" },
    ],
  },
  {
    id: "job_description",
    name: "Job Description Generator",
    description: "Draft a polished, inclusive job description.",
    icon: FileText,
    category: "Recruiting",
    staffOnly: true,
    fields: [
      { name: "role", label: "Role title", type: "text", placeholder: "e.g. Product Designer" },
      { name: "level", label: "Level", type: "text", placeholder: "e.g. Mid, Senior, Lead" },
      { name: "department", label: "Department", type: "text", placeholder: "e.g. Design" },
      { name: "notes", label: "Key requirements / notes", type: "textarea", optional: true },
    ],
  },
  {
    id: "interview_questions",
    name: "Interview Question Generator",
    description: "Create a structured interview question set for a role.",
    icon: ClipboardCheck,
    category: "Recruiting",
    staffOnly: true,
    fields: [
      { name: "role", label: "Role title", type: "text", placeholder: "e.g. Data Analyst" },
      { name: "level", label: "Level", type: "text", placeholder: "e.g. Junior, Mid, Senior" },
      { name: "focus", label: "Focus areas", type: "text", placeholder: "e.g. SQL, stakeholder communication", optional: true },
    ],
  },
  {
    id: "offer_letter",
    name: "Offer Letter Drafter",
    description: "Generate a professional offer letter from key details.",
    icon: ScrollText,
    category: "Recruiting",
    staffOnly: true,
    fields: [
      { name: "candidateName", label: "Candidate name", type: "text" },
      { name: "role", label: "Role", type: "text" },
      { name: "salary", label: "Salary", type: "text", placeholder: "e.g. $95,000/year" },
      { name: "startDate", label: "Start date", type: "text", placeholder: "e.g. 2024-08-01" },
      { name: "details", label: "Other details", type: "textarea", optional: true },
    ],
  },
  {
    id: "skill_gap",
    name: "Skill Gap Analyzer",
    description: "Compare current skills to a target role and get a plan.",
    icon: TrendingUp,
    category: "People",
    staffOnly: false,
    fields: [
      { name: "currentSkills", label: "Current skills", type: "textarea", placeholder: "List your current skills…" },
      { name: "targetRole", label: "Target role / skills", type: "text", placeholder: "e.g. Engineering Manager" },
    ],
  },
  {
    id: "career_path",
    name: "Career Path Advisor",
    description: "Explore realistic career paths from your current role.",
    icon: RouteIcon,
    category: "People",
    staffOnly: false,
    fields: [
      { name: "currentRole", label: "Current role", type: "text" },
      { name: "skills", label: "Key skills", type: "textarea", optional: true },
      { name: "aspirations", label: "Aspirations", type: "textarea", placeholder: "What do you want to grow into?" },
    ],
  },
  {
    id: "performance_summary",
    name: "Performance Summary",
    description: "AI summary of an employee's reviews and goal progress.",
    icon: GraduationCap,
    category: "People",
    staffOnly: true,
    fields: [{ name: "employeeId", label: "Employee", type: "employee-picker" }],
  },
  {
    id: "feedback_sentiment",
    name: "Feedback Sentiment",
    description: "Analyze sentiment and themes in written feedback.",
    icon: MessageSquareHeart,
    category: "People",
    staffOnly: true,
    fields: [{ name: "feedbackText", label: "Feedback text", type: "textarea", placeholder: "Paste feedback or a review comment…" }],
  },
  {
    id: "attendance_insights",
    name: "Attendance Insights",
    description: "Patterns and risks from the last 60 days of attendance.",
    icon: Users,
    category: "Operations",
    staffOnly: true,
    fields: [{ name: "employeeId", label: "Employee (optional, org-wide if blank)", type: "employee-picker", optional: true }],
  },
  {
    id: "leave_recommendation",
    name: "Leave Recommendation",
    description: "Get a data-backed recommendation on a leave request.",
    icon: NotebookPen,
    category: "Operations",
    staffOnly: true,
    fields: [
      { name: "employeeId", label: "Employee", type: "employee-picker" },
      { name: "context", label: "Additional context", type: "textarea", optional: true },
    ],
  },
  {
    id: "meeting_notes",
    name: "Meeting Notes Summarizer",
    description: "Turn raw notes or a transcript into a clean summary.",
    icon: NotebookPen,
    category: "Operations",
    staffOnly: false,
    fields: [{ name: "notes", label: "Raw notes / transcript", type: "textarea", placeholder: "Paste your meeting notes…" }],
  },
  {
    id: "email_generator",
    name: "Email Generator",
    description: "Draft a professional HR email in any tone.",
    icon: Mail,
    category: "Operations",
    staffOnly: false,
    fields: [
      { name: "purpose", label: "Purpose", type: "text", placeholder: "e.g. Welcome new hire" },
      {
        name: "tone",
        label: "Tone",
        type: "select",
        options: [
          { value: "professional", label: "Professional" },
          { value: "friendly", label: "Friendly" },
          { value: "formal", label: "Formal" },
          { value: "empathetic", label: "Empathetic" },
        ],
      },
      { name: "details", label: "Key points", type: "textarea", optional: true },
    ],
  },
  {
    id: "executive_report",
    name: "Executive Report",
    description: "Org-wide headline metrics, risks and recommendations.",
    icon: Briefcase,
    category: "Leadership",
    staffOnly: true,
    fields: [{ name: "focus", label: "Focus area (optional)", type: "text", placeholder: "e.g. retention, cost, growth", optional: true }],
  },
  {
    id: "policy_assistant",
    name: "Policy Assistant",
    description: "Ask general HR policy questions and get guidance.",
    icon: ShieldQuestion,
    category: "Leadership",
    staffOnly: false,
    fields: [{ name: "question", label: "Policy question", type: "textarea", placeholder: "e.g. How should I handle a repeated late-arrival pattern?" }],
  },
  {
    id: "smart_search",
    name: "Smart Search",
    description: "Find employees using natural language.",
    icon: Search,
    category: "Leadership",
    staffOnly: true,
    fields: [{ name: "query", label: "Search query", type: "text", placeholder: "e.g. Senior engineers who know React based in Berlin" }],
  },
];

const CATEGORIES: ToolConfig["category"][] = ["Recruiting", "People", "Operations", "Leadership"];

type HistoryEntry = {
  id: string;
  toolId: ToolConfig["id"];
  toolName: string;
  input: Record<string, string>;
  output: string;
  createdAt: number;
};

function useEmployeeOptions(enabled: boolean) {
  return useQuery({
    queryKey: ["ai-tools-employee-options"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name, designation")
        .order("first_name")
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });
}

function ToolForm({
  tool,
  values,
  onChange,
  employeeOptions,
  employeeOptionsLoading,
}: {
  tool: ToolConfig;
  values: Record<string, string>;
  onChange: (name: string, value: string) => void;
  employeeOptions: { id: string; first_name: string; last_name: string; designation: string }[] | undefined;
  employeeOptionsLoading: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {tool.fields.map((field) => (
        <div key={field.name} className="flex flex-col gap-1.5">
          <Label htmlFor={field.name}>
            {field.label}
            {field.optional && <span className="ml-1 text-[11px] font-normal text-muted-foreground">(optional)</span>}
          </Label>
          {field.type === "textarea" && (
            <Textarea
              id={field.name}
              value={values[field.name] ?? ""}
              onChange={(e) => onChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              rows={5}
            />
          )}
          {field.type === "text" && (
            <Input
              id={field.name}
              value={values[field.name] ?? ""}
              onChange={(e) => onChange(field.name, e.target.value)}
              placeholder={field.placeholder}
            />
          )}
          {field.type === "select" && (
            <Select value={values[field.name] ?? field.options?.[0]?.value} onValueChange={(v) => onChange(field.name, v)}>
              <SelectTrigger id={field.name}>
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {field.type === "employee-picker" && (
            <Select value={values[field.name] ?? ""} onValueChange={(v) => onChange(field.name, v)}>
              <SelectTrigger id={field.name}>
                <SelectValue placeholder={employeeOptionsLoading ? "Loading employees…" : "Select an employee"} />
              </SelectTrigger>
              <SelectContent>
                {employeeOptions?.length ? (
                  employeeOptions.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.first_name} {e.last_name} · {e.designation}
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-2 py-1.5 text-[13px] text-muted-foreground">No employees found</div>
                )}
              </SelectContent>
            </Select>
          )}
        </div>
      ))}
    </div>
  );
}

function ToolWorkspace({
  tool,
  onClose,
  onRunComplete,
}: {
  tool: ToolConfig;
  onClose?: () => void;
  onRunComplete: (entry: HistoryEntry) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const needsEmployees = tool.fields.some((f) => f.type === "employee-picker");
  const { data: employeeOptions, isLoading: employeeOptionsLoading } = useEmployeeOptions(needsEmployees);

  const mutation = useMutation({
    mutationFn: async () => {
      const result = await runAiTool({ data: { tool: tool.id, input: values } });
      return result.output;
    },
    onSuccess: (output) => {
      onRunComplete({
        id: crypto.randomUUID(),
        toolId: tool.id,
        toolName: tool.name,
        input: values,
        output,
        createdAt: Date.now(),
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "The AI tool failed to run.");
    },
  });

  const canRun = tool.fields.every((f) => f.optional || Boolean(values[f.name]?.trim()));

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <tool.icon className="size-4" />
          </div>
          <div>
            <h2 className="text-lg font-semibold leading-tight">{tool.name}</h2>
            <p className="text-[13px] text-muted-foreground">{tool.description}</p>
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 lg:hidden">
            <X className="size-4" />
          </Button>
        )}
      </div>

      <ToolForm
        tool={tool}
        values={values}
        onChange={(name, value) => setValues((prev) => ({ ...prev, [name]: value }))}
        employeeOptions={employeeOptions}
        employeeOptionsLoading={employeeOptionsLoading}
      />

      <Button onClick={() => mutation.mutate()} disabled={!canRun || mutation.isPending} className="w-full sm:w-fit">
        {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        Run tool
      </Button>

      <div className="flex flex-1 flex-col border-t border-border pt-4">
        <AiResult
          output={mutation.data ?? null}
          isPending={mutation.isPending}
          error={mutation.isError ? (mutation.error as Error).message : null}
          fileNameHint={tool.id}
        />
      </div>
    </div>
  );
}

function AiToolsPage() {
  const { user } = useSession();
  const { isStaff } = useRoles(user?.id);
  const { data: employee } = useCurrentEmployee(user?.id);
  const [search, setSearch] = useState("");
  const [selectedTool, setSelectedTool] = useState<ToolConfig | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [viewingHistory, setViewingHistory] = useState<HistoryEntry | null>(null);

  const availableTools = useMemo(() => TOOLS.filter((t) => isStaff || !t.staffOnly), [isStaff]);

  const filteredTools = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return availableTools;
    return availableTools.filter(
      (t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q),
    );
  }, [availableTools, search]);

  const grouped = useMemo(() => {
    const map = new Map<ToolConfig["category"], ToolConfig[]>();
    for (const cat of CATEGORIES) {
      const items = filteredTools.filter((t) => t.category === cat);
      if (items.length) map.set(cat, items);
    }
    return map;
  }, [filteredTools]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Toolkit</h1>
          <p className="text-[13px] text-muted-foreground">
            {isStaff
              ? "Purpose-built AI tools for recruiting, people, operations and leadership."
              : `Purpose-built AI tools for ${employee ? "your" : "your"} career growth and everyday HR needs.`}
          </p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tools…"
            className="pl-8"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex flex-col gap-6">
          {grouped.size === 0 && (
            <Card className="surface-card flex flex-col items-center justify-center gap-2 p-10 text-center">
              <p className="text-sm font-medium">No tools match your search</p>
              <p className="text-[13px] text-muted-foreground">Try a different keyword.</p>
            </Card>
          )}
          {Array.from(grouped.entries()).map(([category, tools]) => (
            <motion.div key={category} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-2.5">
              <h3 className="text-sm font-semibold text-muted-foreground">{category}</h3>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {tools.map((tool) => (
                  <ToolCard
                    key={tool.id}
                    icon={tool.icon}
                    name={tool.name}
                    description={tool.description}
                    active={selectedTool?.id === tool.id}
                    onClick={() => setSelectedTool(tool)}
                  />
                ))}
              </div>
            </motion.div>
          ))}

          {history.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                <History className="size-3.5" /> Recent runs
              </h3>
              <div className="flex flex-col gap-2">
                {history.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => setViewingHistory(entry)}
                    className="surface-card flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-left text-[13px] hover:border-primary/40 hover:bg-primary/5"
                  >
                    <span className="truncate">{entry.toolName}</span>
                    <Badge variant="secondary" className="shrink-0">
                      {new Date(entry.createdAt).toLocaleTimeString()}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="hidden lg:block">
          <Card className="surface-card sticky top-4 flex min-h-[480px] flex-col p-5">
            {selectedTool ? (
              <ToolWorkspace
                key={selectedTool.id}
                tool={selectedTool}
                onRunComplete={(entry) => setHistory((prev) => [entry, ...prev].slice(0, 20))}
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Sparkles className="size-6" />
                </div>
                <p className="text-sm font-medium text-foreground">Pick a tool to get started</p>
                <p className="max-w-xs text-[13px]">Select any card on the left to open its inputs and run it.</p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Mobile: tool runner in a dialog */}
      <Dialog open={Boolean(selectedTool) && typeof window !== "undefined"} onOpenChange={(open) => !open && setSelectedTool(null)}>
        <DialogContent className={cn("max-h-[90vh] overflow-y-auto lg:hidden", "sm:max-w-lg")}>
          <DialogHeader className="sr-only">
            <DialogTitle>{selectedTool?.name ?? "AI tool"}</DialogTitle>
          </DialogHeader>
          {selectedTool && (
            <ToolWorkspace
              key={selectedTool.id}
              tool={selectedTool}
              onClose={() => setSelectedTool(null)}
              onRunComplete={(entry) => setHistory((prev) => [entry, ...prev].slice(0, 20))}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(viewingHistory)} onOpenChange={(open) => !open && setViewingHistory(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewingHistory?.toolName}</DialogTitle>
          </DialogHeader>
          {viewingHistory && (
            <AiResult output={viewingHistory.output} isPending={false} error={null} fileNameHint={viewingHistory.toolId} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
