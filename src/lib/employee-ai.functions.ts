import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const insightsSchema = z.object({
  employeeId: z.string().uuid(),
});

export const generateEmployeeInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(insightsSchema)
  .handler(async ({ data, context }) => {
    const LOVABLE_API_KEY = process.env["LOVABLE_API_KEY"];
    if (!LOVABLE_API_KEY) {
      throw new Error("AI is not configured. Missing LOVABLE_API_KEY.");
    }

    const { supabase } = context;

    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select(
        "id, first_name, last_name, designation, status, employment_type, date_of_joining, skills, departments(name)",
      )
      .eq("id", data.employeeId)
      .maybeSingle();

    if (employeeError) throw new Error(employeeError.message);
    if (!employee) throw new Error("Employee not found or you don't have access to this record.");

    const since = new Date();
    since.setDate(since.getDate() - 90);

    const { data: attendance } = await supabase
      .from("attendance")
      .select("status, worked_minutes")
      .eq("employee_id", data.employeeId)
      .gte("work_date", since.toISOString().slice(0, 10));

    const attendanceCounts: Record<string, number> = {};
    let totalMinutes = 0;
    for (const row of attendance ?? []) {
      attendanceCounts[row.status] = (attendanceCounts[row.status] ?? 0) + 1;
      totalMinutes += row.worked_minutes ?? 0;
    }
    const avgHours = attendance?.length ? totalMinutes / attendance.length / 60 : 0;

    const year = new Date().getFullYear();
    const { data: balances } = await supabase
      .from("leave_balances")
      .select("leave_type, entitled, used")
      .eq("employee_id", data.employeeId)
      .eq("year", year);

    const { data: goals } = await supabase
      .from("goals")
      .select("title, status, progress")
      .eq("employee_id", data.employeeId)
      .order("updated_at", { ascending: false })
      .limit(10);

    const { data: reviews } = await supabase
      .from("performance_reviews")
      .select("period, rating, strengths, improvements, summary")
      .eq("employee_id", data.employeeId)
      .order("created_at", { ascending: false })
      .limit(5);

    const contextLines: string[] = [];
    contextLines.push(
      `Employee: ${employee.first_name} ${employee.last_name}, ${employee.designation}, status=${employee.status}, type=${employee.employment_type}, department=${(employee as unknown as { departments?: { name?: string } }).departments?.name ?? "n/a"}, joined=${employee.date_of_joining}.`,
    );
    if (employee.skills?.length) {
      contextLines.push(`Skills: ${employee.skills.join(", ")}.`);
    }
    contextLines.push(
      `Attendance (last 90 days, ${attendance?.length ?? 0} records): ${Object.entries(attendanceCounts)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ") || "no records"}. Average worked hours/day: ${avgHours.toFixed(1)}.`,
    );
    if (balances?.length) {
      contextLines.push(
        `Leave balances (${year}): ${balances
          .map((b) => `${b.leave_type}=${b.used}/${b.entitled} used`)
          .join(", ")}.`,
      );
    }
    if (goals?.length) {
      contextLines.push(
        `Goals: ${goals.map((g) => `${g.title} (${g.status}, ${g.progress}%)`).join("; ")}.`,
      );
    }
    if (reviews?.length) {
      contextLines.push(
        `Performance reviews: ${reviews
          .map(
            (r) =>
              `${r.period}: rating=${r.rating}/5${r.summary ? `, summary="${r.summary}"` : ""}${r.strengths ? `, strengths="${r.strengths}"` : ""}${r.improvements ? `, improvements="${r.improvements}"` : ""}`,
          )
          .join(" | ")}.`,
      );
    } else {
      contextLines.push("No performance reviews on record.");
    }

    const systemPrompt = `You are the Nexus HR AI Copilot generating an HR insight brief for a manager reviewing a single employee's record. Be concise, structured and honest — never invent numbers not present in the context. Use the exact data given.

Structure your response with these headings, each 2-4 short bullet points or sentences:
### Performance summary
### Attendance pattern
### Risk flags
### Skill gaps
### Recommended actions
(exactly 3 concrete, actionable recommendations)

Context:
${contextLines.join("\n")}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Generate the HR insight brief for this employee now." },
        ],
      }),
    });

    if (response.status === 429) {
      throw new Error("Rate limit reached. Please wait a moment and try again.");
    }
    if (response.status === 402) {
      throw new Error("AI credits exhausted. Please add credits to continue using AI insights.");
    }
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`AI gateway error (${response.status}): ${text.slice(0, 200)}`);
    }

    const json = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const insights = json.choices?.[0]?.message?.content?.trim();
    if (!insights) throw new Error("The assistant returned an empty response.");

    return { insights };
  });
