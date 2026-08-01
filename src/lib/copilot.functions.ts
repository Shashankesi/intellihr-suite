import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const askCopilotSchema = z.object({
  messages: z.array(messageSchema).min(1).max(20),
});

/** Builds a compact context block describing the signed-in user's HR world. */
async function buildContext(supabase: any, userId: string, isStaff: boolean) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, job_title, email")
    .eq("id", userId)
    .maybeSingle();

  const { data: employee } = await supabase
    .from("employees")
    .select("id, first_name, last_name, designation, status, department_id, date_of_joining, departments(name)")
    .eq("user_id", userId)
    .maybeSingle();

  const lines: string[] = [];
  lines.push(`Signed-in user: ${profile?.full_name ?? "Unknown"} (${profile?.email ?? "n/a"})`);

  if (employee) {
    lines.push(
      `Employee record: ${employee.first_name} ${employee.last_name}, ${employee.designation}, status=${employee.status}, department=${employee.departments?.name ?? "n/a"}, joined=${employee.date_of_joining}.`,
    );

    const since = new Date();
    since.setDate(since.getDate() - 30);
    const { data: attendance } = await supabase
      .from("attendance")
      .select("status")
      .eq("employee_id", employee.id)
      .gte("work_date", since.toISOString().slice(0, 10));

    if (attendance?.length) {
      const counts: Record<string, number> = {};
      for (const row of attendance) counts[row.status] = (counts[row.status] ?? 0) + 1;
      lines.push(
        `Attendance (last 30 days, ${attendance.length} records): ${Object.entries(counts)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ")}.`,
      );
    }

    const year = new Date().getFullYear();
    const { data: balances } = await supabase
      .from("leave_balances")
      .select("leave_type, entitled, used")
      .eq("employee_id", employee.id)
      .eq("year", year);
    if (balances?.length) {
      lines.push(
        `Leave balances (${year}): ${balances
          .map((b: any) => `${b.leave_type}=${b.entitled - b.used}/${b.entitled} remaining`)
          .join(", ")}.`,
      );
    }

    const { data: pendingLeave } = await supabase
      .from("leave_requests")
      .select("id, leave_type, start_date, end_date, days, status")
      .eq("employee_id", employee.id)
      .eq("status", "pending");
    if (pendingLeave?.length) {
      lines.push(
        `Pending leave requests: ${pendingLeave
          .map((r: any) => `${r.leave_type} ${r.start_date}→${r.end_date} (${r.days}d)`)
          .join("; ")}.`,
      );
    }

    const { data: goals } = await supabase
      .from("goals")
      .select("title, status, progress")
      .eq("employee_id", employee.id)
      .order("updated_at", { ascending: false })
      .limit(5);
    if (goals?.length) {
      lines.push(
        `Recent goals: ${goals.map((g: any) => `${g.title} (${g.status}, ${g.progress}%)`).join("; ")}.`,
      );
    }
  } else {
    lines.push("No linked employee record found for this user.");
  }

  if (isStaff) {
    const { count: headcount } = await supabase
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");

    const { data: deptCounts } = await supabase.from("employees").select("department_id, departments(name)");
    const deptTally: Record<string, number> = {};
    for (const row of deptCounts ?? []) {
      const name = (row as any).departments?.name ?? "Unassigned";
      deptTally[name] = (deptTally[name] ?? 0) + 1;
    }

    const { count: pendingApprovals } = await supabase
      .from("leave_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    lines.push(
      `Org snapshot: active headcount=${headcount ?? 0}. Department counts: ${Object.entries(deptTally)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ")}. Pending leave approvals org-wide=${pendingApprovals ?? 0}.`,
    );
  }

  return lines.join("\n");
}

export const askCopilot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(askCopilotSchema)
  .handler(async ({ data, context }) => {
    const LOVABLE_API_KEY = process.env["LOVABLE_API_KEY"];
    if (!LOVABLE_API_KEY) {
      throw new Error("AI is not configured. Missing LOVABLE_API_KEY.");
    }

    const { supabase, userId } = context;

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roleList = (roles ?? []).map((r: any) => r.role as string);
    const isStaff = roleList.includes("admin") || roleList.includes("hr");

    const contextBlock = await buildContext(supabase, userId, isStaff);

    const systemPrompt = `You are the Nexus HR AI Copilot, an assistant embedded inside Nexus HR, an enterprise HR platform covering employees, attendance, leave, payroll, performance and departments.
Answer concisely and helpfully using the context below when relevant. If asked something you cannot know from context, say so honestly and suggest where in the app to look (e.g. the Leave, Attendance, Payroll or Analytics pages). Never invent numbers not present in context.

Context about the current user${isStaff ? " (has staff/admin privileges)" : ""}:
${contextBlock}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, ...data.messages],
      }),
    });

    if (response.status === 429) {
      throw new Error("Rate limit reached. Please wait a moment and try again.");
    }
    if (response.status === 402) {
      throw new Error("AI credits exhausted. Please add credits to continue using the copilot.");
    }
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`AI gateway error (${response.status}): ${text.slice(0, 200)}`);
    }

    const json = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const reply = json.choices?.[0]?.message?.content?.trim();
    if (!reply) throw new Error("The assistant returned an empty response.");

    return { reply };
  });
