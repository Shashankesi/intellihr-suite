import { motion } from "framer-motion";
import {
  Bot,
  BrainCircuit,
  CalendarSearch,
  FileText,
  Mail,
  ScanSearch,
  ScrollText,
  Sparkles,
  TrendingUp,
  UserSearch,
} from "lucide-react";

import { SectionHeading } from "@/components/landing/features";

const AI_CAPABILITIES = [
  {
    icon: Bot,
    title: "HR Assistant",
    body: '"How many leaves do I have left?" — grounded answers from live company data.',
  },
  {
    icon: UserSearch,
    title: "Smart people search",
    body: '"Backend engineers with React experience in Pune" returns a ranked shortlist.',
  },
  {
    icon: ScanSearch,
    title: "Resume analyzer",
    body: "Upload a CV and extract skills, education, experience and a fit recommendation.",
  },
  {
    icon: TrendingUp,
    title: "Performance summaries",
    body: "Turn goals, ratings and review notes into a balanced written appraisal.",
  },
  {
    icon: CalendarSearch,
    title: "Attendance insights",
    body: "Detect absenteeism patterns per team and recommend interventions early.",
  },
  {
    icon: BrainCircuit,
    title: "Leave analyzer",
    body: "Classify a request as emergency, medical or casual and recommend a decision.",
  },
  {
    icon: Mail,
    title: "Email generator",
    body: "Offer letters, welcome notes, approvals, warnings and appraisals in your tone.",
  },
  {
    icon: ScrollText,
    title: "Policy assistant",
    body: "Upload HR handbooks and let employees ask policy questions in plain language.",
  },
  {
    icon: FileText,
    title: "Report generator",
    body: "Ask for a monthly headcount or payroll report and get a formatted PDF back.",
  },
];

/** AI capability showcase — the differentiator section. */
export function AiShowcase() {
  return (
    <section id="ai" className="relative scroll-mt-24 overflow-hidden px-4 py-24">
      <div className="pointer-events-none absolute inset-0 -z-10 mesh-bg opacity-60" aria-hidden />
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Intelligence"
          title="AI woven through the whole system"
          body="Not a bolted-on chatbot. Every module has a copilot that reads your real data, respects permissions and produces work you can ship."
        />

        <div className="mt-14 grid gap-4 lg:grid-cols-[1.05fr_1fr]">
          <AssistantMock />

          <div className="grid gap-3 sm:grid-cols-2">
            {AI_CAPABILITIES.map((cap, i) => (
              <motion.div
                key={cap.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ delay: (i % 4) * 0.05, duration: 0.5 }}
                className="surface-card hover-lift p-4"
              >
                <cap.icon className="size-[18px] text-accent" />
                <h3 className="mt-3 text-[13px] font-semibold">{cap.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{cap.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const CONVERSATION = [
  { role: "user", text: "Which department had the lowest attendance last month?" },
  {
    role: "assistant",
    text: "Customer Support averaged 88.4% — 5.1 points below company average. Three employees account for 61% of the absences. Want me to draft check-in notes for their managers?",
  },
  { role: "user", text: "Yes, and generate the monthly attendance report as PDF." },
];

/** Chat mock illustrating the assistant experience. */
function AssistantMock() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="surface-card flex flex-col p-5"
    >
      <div className="flex items-center gap-2.5 border-b border-border pb-4">
        <span className="grid size-9 place-items-center rounded-xl gradient-accent-bg text-accent-foreground">
          <Sparkles className="size-4" />
        </span>
        <div>
          <p className="text-sm font-semibold">Nexus Copilot</p>
          <p className="text-[11px] text-muted-foreground">Connected to live HR data</p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-success/12 px-2 py-1 text-[10px] font-medium text-success">
          <span className="size-1.5 rounded-full bg-success" /> Online
        </span>
      </div>

      <div className="mt-5 flex flex-1 flex-col gap-3">
        {CONVERSATION.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 + i * 0.25, duration: 0.45 }}
            className={
              msg.role === "user"
                ? "max-w-[85%] self-end rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-[13px] text-primary-foreground"
                : "max-w-[92%] self-start rounded-2xl rounded-bl-md bg-secondary px-3.5 py-2.5 text-[13px] leading-relaxed text-secondary-foreground"
            }
          >
            {msg.text}
          </motion.div>
        ))}
        <div className="mt-1 flex items-center gap-2 self-start rounded-2xl bg-secondary px-3.5 py-3">
          {[0, 1, 2].map((d) => (
            <motion.span
              key={d}
              animate={{ opacity: [0.25, 1, 0.25] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: d * 0.2 }}
              className="size-1.5 rounded-full bg-muted-foreground"
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
