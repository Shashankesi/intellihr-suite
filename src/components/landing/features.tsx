import { motion } from "framer-motion";
import {
  BarChart3,
  CalendarClock,
  FileSpreadsheet,
  Gauge,
  Layers,
  Lock,
  Users,
  Wallet,
} from "lucide-react";

const FEATURES = [
  {
    icon: Users,
    title: "Employee records",
    body: "A single source of truth for profiles, documents, departments and reporting lines — searchable in milliseconds.",
  },
  {
    icon: CalendarClock,
    title: "Attendance & time",
    body: "Clock in/out, calendar views, late detection and working-hour analytics across every location.",
  },
  {
    icon: Layers,
    title: "Leave workflows",
    body: "Policy-driven balances, multi-step approvals and instant visibility into who is out and when.",
  },
  {
    icon: Wallet,
    title: "Payroll & payslips",
    body: "Structured salary components, tax and bonus handling, and one-click PDF payslip generation.",
  },
  {
    icon: Gauge,
    title: "Performance",
    body: "Goals, review cycles and ratings that roll up into department and company-wide scorecards.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    body: "Board-ready dashboards on headcount, cost, attrition risk and attendance with live drilldowns.",
  },
  {
    icon: Lock,
    title: "Enterprise security",
    body: "Role-based access, row-level data isolation, full audit trail and validated inputs everywhere.",
  },
  {
    icon: FileSpreadsheet,
    title: "Export anywhere",
    body: "CSV and PDF exports on every table so finance and compliance always get what they need.",
  },
];

/** Feature grid — the core (non-AI) product surface. */
export function Features() {
  return (
    <section id="platform" className="relative scroll-mt-24 px-4 py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Platform"
          title="Everything HR runs on, in one place"
          body="Replace the spreadsheet sprawl. Nexus HR covers the full employee lifecycle with the depth enterprise teams expect."
        />

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, i) => (
            <motion.article
              key={feature.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: (i % 4) * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="group surface-card hover-lift p-5"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary transition-colors group-hover:gradient-brand group-hover:text-primary-foreground">
                <feature.icon className="size-5" />
              </span>
              <h3 className="mt-4 text-sm font-semibold">{feature.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                {feature.body}
              </p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Shared marketing section header. */
export function SectionHeading({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto max-w-2xl text-center"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-bold sm:text-4xl">{title}</h2>
      {body && <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">{body}</p>}
    </motion.div>
  );
}
