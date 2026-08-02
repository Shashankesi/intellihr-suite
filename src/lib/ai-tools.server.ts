import type { SupabaseClient } from "@supabase/supabase-js";

export type AiToolName =
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

type Sb = SupabaseClient<any, any, any>;

/** Fetches the employee record for an employeeId input, tolerant of missing rows. */
async function fetchEmployee(supabase: Sb, employeeId: string | undefined) {
  if (!employeeId) return null;
  const { data } = await supabase
    .from("employees")
    .select("*, departments(name)")
    .eq("id", employeeId)
    .maybeSingle();
  return data;
}

async function buildPerformanceSummaryPrompt(supabase: Sb, input: Record<string, string>) {
  const employee = await fetchEmployee(supabase, input["employeeId"]);
  if (!employee) {
    return "No employee was selected or found. Explain to the user that they need to pick a valid employee, and stop there.";
  }

  const { data: reviews } = await supabase
    .from("performance_reviews")
    .select("period, rating, strengths, improvements, summary")
    .eq("employee_id", employee.id)
    .order("created_at", { ascending: false })
    .limit(6);

  const { data: goals } = await supabase
    .from("goals")
    .select("title, status, progress")
    .eq("employee_id", employee.id)
    .order("updated_at", { ascending: false })
    .limit(8);

  const reviewsBlock = reviews?.length
    ? reviews
        .map((r) => `- ${r.period}: rating ${r.rating}/5. Strengths: ${r.strengths ?? "n/a"}. Improvements: ${r.improvements ?? "n/a"}. Summary: ${r.summary ?? "n/a"}.`)
        .join("\n")
    : "No performance reviews on record yet.";

  const goalsBlock = goals?.length
    ? goals.map((g) => `- ${g.title} (${g.status}, ${g.progress}% complete)`).join("\n")
    : "No goals tracked yet.";

  return `Employee: ${employee.first_name} ${employee.last_name}, ${employee.designation}, department ${employee.departments?.name ?? "n/a"}.

Performance reviews:
${reviewsBlock}

Goals:
${goalsBlock}

Write a well-structured performance summary covering overall trajectory, strengths, growth areas, and goal progress. If data is sparse, say so honestly rather than inventing detail.`;
}

async function buildAttendanceInsightsPrompt(supabase: Sb, input: Record<string, string>) {
  const employeeId = input["employeeId"];
  const since = new Date();
  since.setDate(since.getDate() - 60);
  const sinceStr = since.toISOString().slice(0, 10);

  let query = supabase
    .from("attendance")
    .select("employee_id, status, work_date, worked_minutes, employees(first_name, last_name, department_id, departments(name))")
    .gte("work_date", sinceStr);
  if (employeeId) query = query.eq("employee_id", employeeId);

  const { data: rows } = await query.limit(1000);

  if (!rows?.length) {
    return "No attendance records found in the last 60 days for the requested scope. Tell the user there isn't enough data yet for insights.";
  }

  const counts: Record<string, number> = {};
  const byEmployee: Record<string, { name: string; present: number; absent: number; late: number; total: number }> = {};
  for (const row of rows as any[]) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
    const empName = row.employees ? `${row.employees.first_name} ${row.employees.last_name}` : row.employee_id;
    byEmployee[row.employee_id] ??= { name: empName, present: 0, absent: 0, late: 0, total: 0 };
    byEmployee[row.employee_id].total += 1;
    if (row.status === "present") byEmployee[row.employee_id].present += 1;
    if (row.status === "absent") byEmployee[row.employee_id].absent += 1;
    if (row.status === "late") byEmployee[row.employee_id].late += 1;
  }

  const perEmployeeBlock = Object.values(byEmployee)
    .slice(0, 25)
    .map((e) => `- ${e.name}: ${e.present} present, ${e.absent} absent, ${e.late} late out of ${e.total} records`)
    .join("\n");

  return `Attendance data window: last 60 days, ${rows.length} records.
Status totals: ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(", ")}.

Per-employee breakdown (up to 25 shown):
${perEmployeeBlock}

Produce clear attendance insights: patterns, risk of burnout or absenteeism, notable outliers, and 2-3 actionable recommendations for HR.`;
}

async function buildLeaveRecommendationPrompt(supabase: Sb, input: Record<string, string>) {
  const employeeId = input["employeeId"];
  if (!employeeId) {
    return "No employee was selected. Explain to the user they must pick an employee to get a leave recommendation, and stop there.";
  }
  const employee = await fetchEmployee(supabase, employeeId);
  if (!employee) return "The selected employee could not be found. Say so plainly.";

  const year = new Date().getFullYear();
  const { data: balances } = await supabase
    .from("leave_balances")
    .select("leave_type, entitled, used")
    .eq("employee_id", employeeId)
    .eq("year", year);

  const { data: pending } = await supabase
    .from("leave_requests")
    .select("leave_type, start_date, end_date, days, status, reason")
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false })
    .limit(10);

  const balancesBlock = balances?.length
    ? balances.map((b) => `${b.leave_type}: ${b.entitled - b.used}/${b.entitled} remaining`).join(", ")
    : "No leave balance records for this year.";

  const historyBlock = pending?.length
    ? pending.map((r) => `- ${r.leave_type} ${r.start_date}→${r.end_date} (${r.days}d), status ${r.status}, reason: ${r.reason}`).join("\n")
    : "No leave request history.";

  const context = input["context"]?.trim();

  return `Employee: ${employee.first_name} ${employee.last_name}, ${employee.designation}.
Leave balances (${year}): ${balancesBlock}

Recent leave request history:
${historyBlock}
${context ? `\nAdditional context from requester: ${context}` : ""}

Give a leave approval/planning recommendation: whether a new request in this context looks reasonable, balance sustainability, and any policy flags to consider. Be specific and practical, not generic.`;
}

async function buildExecutiveReportPrompt(supabase: Sb, input: Record<string, string>) {
  const { count: headcount } = await supabase
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  const { data: deptRows } = await supabase.from("employees").select("department_id, departments(name), status");
  const deptTally: Record<string, number> = {};
  for (const row of (deptRows ?? []) as any[]) {
    const name = row.departments?.name ?? "Unassigned";
    deptTally[name] = (deptTally[name] ?? 0) + 1;
  }

  const { count: pendingLeave } = await supabase
    .from("leave_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const { data: attendance } = await supabase
    .from("attendance")
    .select("status")
    .gte("work_date", since.toISOString().slice(0, 10))
    .limit(5000);
  const attCounts: Record<string, number> = {};
  for (const row of attendance ?? []) attCounts[row.status] = (attCounts[row.status] ?? 0) + 1;

  const { data: payroll } = await supabase
    .from("payroll")
    .select("net_pay, period_month, period_year")
    .order("period_year", { ascending: false })
    .order("period_month", { ascending: false })
    .limit(200);
  const totalPayroll = (payroll ?? []).reduce((sum, p) => sum + Number(p.net_pay ?? 0), 0);

  const { data: reviews } = await supabase.from("performance_reviews").select("rating").limit(500);
  const avgRating = reviews?.length ? (reviews.reduce((s, r) => s + Number(r.rating ?? 0), 0) / reviews.length).toFixed(2) : null;

  if (!headcount) {
    return "There isn't enough organizational data yet to produce a meaningful executive report. Say so honestly and suggest adding employees, attendance, leave and payroll data first.";
  }

  const focus = input["focus"]?.trim();

  return `Organization snapshot for executive report:
- Active headcount: ${headcount ?? 0}
- Department distribution: ${Object.entries(deptTally).map(([k, v]) => `${k}=${v}`).join(", ") || "n/a"}
- Pending leave approvals: ${pendingLeave ?? 0}
- Attendance last 30 days: ${Object.entries(attCounts).map(([k, v]) => `${k}=${v}`).join(", ") || "no data"}
- Recent payroll total (sampled ${payroll?.length ?? 0} records): ${totalPayroll.toLocaleString()}
- Average performance rating (sampled ${reviews?.length ?? 0} reviews): ${avgRating ?? "no data"}
${focus ? `\nExecutive requested focus area: ${focus}` : ""}

Write a concise executive report (with headline, key metrics, risks, and recommendations) suitable for leadership review. Only use the numbers given; never fabricate.`;
}

async function buildSmartSearchPrompt(supabase: Sb, input: Record<string, string>) {
  const query = input["query"]?.trim();
  if (!query) return "No search query was provided. Ask the user to describe who they're looking for.";

  const { data: employees } = await supabase
    .from("employees")
    .select("id, first_name, last_name, designation, status, location, date_of_joining, skills, departments(name)")
    .limit(300);

  if (!employees?.length) {
    return "The employee directory is empty. Tell the user there is not enough data yet to search.";
  }

  const directory = employees
    .map(
      (e: any) =>
        `- ${e.first_name} ${e.last_name} | ${e.designation} | dept: ${e.departments?.name ?? "n/a"} | skills: ${(e.skills ?? []).join(", ") || "none listed"} | status: ${e.status} | location: ${e.location ?? "n/a"} | joined: ${e.date_of_joining}`,
    )
    .join("\n");

  return `Natural-language search query from an HR staff member: "${query}"

Employee directory:
${directory}

Identify which employees (by full name) best match the query and briefly explain why for each match. If nothing matches well, say so clearly instead of forcing a match.`;
}

const SYSTEM_PROMPTS: Record<AiToolName, string> = {
  resume_analyzer:
    "You are an expert technical recruiter. Analyze the given resume text against the target role. Output: fit score (0-100), key strengths, gaps, and a recommendation (advance/hold/reject) with reasoning. Be specific and evidence-based; never invent facts not present in the resume.",
  job_description:
    "You are a senior recruiter. Write a clear, inclusive, well-structured job description in markdown with sections: Overview, Responsibilities, Requirements, Nice to have, and Benefits (generic if unspecified). Avoid biased or exclusionary language.",
  interview_questions:
    "You are a hiring panel lead. Generate a structured interview question set (behavioral, technical, and situational) tailored to the role and level given, grouped under headings, with a short note on what a strong answer looks like for each.",
  skill_gap:
    "You are a learning & development advisor. Compare the person's current skills against the target role/skills and produce: matched skills, gaps, and a prioritized learning plan with concrete resources or steps. Be encouraging but honest.",
  career_path:
    "You are an internal career coach. Given the person's current role, skills and goals, propose 2-3 realistic career path options inside a mid-size company, each with milestones and skills to develop. Keep it grounded and specific.",
  email_generator:
    "You are an HR communications specialist. Write a professional email in the requested tone for the given purpose. Include a subject line. Keep it concise, warm where appropriate, and free of legal overreach.",
  policy_assistant:
    "You are an HR policy assistant. Answer the policy question clearly and practically, referencing common HR practice. If the answer legitimately depends on the company's specific policy document (which you don't have), say so and suggest checking with HR or the employee handbook rather than guessing at specifics like exact leave day counts.",
  meeting_notes:
    "You are an executive assistant. Turn the raw meeting notes/transcript into a clean, structured summary in markdown with sections: Summary, Key Decisions, Action Items (with owners if mentioned), and Follow-ups.",
  feedback_sentiment:
    "You are a people-analytics specialist. Analyze the sentiment and themes in the given feedback text. Output: overall sentiment (positive/neutral/negative/mixed) with confidence, key themes, and suggested next steps for the manager.",
  offer_letter:
    "You are an HR operations specialist. Draft a professional offer letter in markdown using the given details (role, salary, start date, etc.). Use placeholders in [brackets] only for details not supplied. Keep tone warm and professional, and include standard at-will/contingency language generically without inventing legal specifics.",
  performance_summary:
    "You are a performance management specialist writing an internal summary from real review and goal data supplied below. Be specific, balanced, and evidence-based; never invent numbers not present in the data.",
  attendance_insights:
    "You are a people-analytics specialist producing insights strictly from the attendance data supplied below. Never invent numbers not present in the data.",
  leave_recommendation:
    "You are an HR leave-policy advisor producing a recommendation strictly from the data supplied below. Never invent numbers not present in the data.",
  executive_report:
    "You are a Chief People Officer preparing a crisp executive report strictly from the organizational data supplied below. Never invent numbers not present in the data.",
  smart_search:
    "You are an internal people-search assistant. Match the query against the real employee directory supplied below only. Never invent employees or facts not present in the directory.",
};

const USER_PROMPT_BUILDERS: Record<
  AiToolName,
  (supabase: Sb, input: Record<string, string>) => Promise<string> | string
> = {
  resume_analyzer: (_s, input) =>
    `Target role: ${input["role"] || "not specified"}\n\nResume text:\n${input["resumeText"] || "(none provided)"}`,
  job_description: (_s, input) =>
    `Role title: ${input["role"] || "not specified"}\nLevel: ${input["level"] || "not specified"}\nDepartment: ${input["department"] || "not specified"}\nKey requirements/notes: ${input["notes"] || "none"}`,
  interview_questions: (_s, input) =>
    `Role title: ${input["role"] || "not specified"}\nLevel: ${input["level"] || "not specified"}\nFocus areas: ${input["focus"] || "general"}`,
  skill_gap: (_s, input) =>
    `Current role/skills: ${input["currentSkills"] || "not specified"}\nTarget role/skills: ${input["targetRole"] || "not specified"}`,
  career_path: (_s, input) =>
    `Current role: ${input["currentRole"] || "not specified"}\nSkills: ${input["skills"] || "not specified"}\nAspirations: ${input["aspirations"] || "not specified"}`,
  email_generator: (_s, input) =>
    `Purpose: ${input["purpose"] || "not specified"}\nTone: ${input["tone"] || "professional"}\nKey points: ${input["details"] || "none"}`,
  policy_assistant: (_s, input) => `Policy question: ${input["question"] || "not specified"}`,
  meeting_notes: (_s, input) => `Raw notes/transcript:\n${input["notes"] || "(none provided)"}`,
  feedback_sentiment: (_s, input) => `Feedback text:\n${input["feedbackText"] || "(none provided)"}`,
  offer_letter: (_s, input) =>
    `Candidate name: ${input["candidateName"] || "not specified"}\nRole: ${input["role"] || "not specified"}\nSalary: ${input["salary"] || "not specified"}\nStart date: ${input["startDate"] || "not specified"}\nOther details: ${input["details"] || "none"}`,
  performance_summary: buildPerformanceSummaryPrompt,
  attendance_insights: buildAttendanceInsightsPrompt,
  leave_recommendation: buildLeaveRecommendationPrompt,
  executive_report: buildExecutiveReportPrompt,
  smart_search: buildSmartSearchPrompt,
};

/** Builds the {system, user} prompt pair for a given tool, fetching live data for data-driven tools. */
export async function buildPrompt(
  tool: AiToolName,
  supabase: Sb,
  input: Record<string, string>,
): Promise<{ system: string; user: string }> {
  const system = SYSTEM_PROMPTS[tool];
  const user = await USER_PROMPT_BUILDERS[tool](supabase, input);
  return { system, user };
}

/** Calls the Lovable AI Gateway and returns the trimmed text reply, or throws a friendly error. */
export async function callAiGateway(system: string, user: string): Promise<string> {
  const LOVABLE_API_KEY = process.env["LOVABLE_API_KEY"];
  if (!LOVABLE_API_KEY) {
    throw new Error("AI is not configured. Missing LOVABLE_API_KEY.");
  }

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (response.status === 429) {
    throw new Error("Rate limit reached. Please wait a moment and try again.");
  }
  if (response.status === 402) {
    throw new Error("AI credits exhausted. Please add credits to continue using AI tools.");
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI gateway error (${response.status}): ${text.slice(0, 200)}`);
  }

  const json = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const reply = json.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new Error("The assistant returned an empty response.");
  return reply;
}
