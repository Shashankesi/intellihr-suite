import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildPrompt, callAiGateway } from "@/lib/ai-tools.server";

const toolSchema = z.enum([
  "resume_analyzer",
  "job_description",
  "interview_questions",
  "skill_gap",
  "career_path",
  "email_generator",
  "policy_assistant",
  "meeting_notes",
  "feedback_sentiment",
  "offer_letter",
  "performance_summary",
  "attendance_insights",
  "leave_recommendation",
  "executive_report",
  "smart_search",
]);

const runAiToolSchema = z.object({
  tool: toolSchema,
  input: z.record(z.string()),
});

export const runAiTool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(runAiToolSchema)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { system, user } = await buildPrompt(data.tool, supabase, data.input);
    const output = await callAiGateway(system, user);
    return { output };
  });
