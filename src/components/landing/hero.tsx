import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Play, ShieldCheck, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.08 * i, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

/** Marketing hero with animated aurora background and a live product preview. */
export function Hero() {
  return (
    <section className="relative overflow-hidden px-4 pt-36 pb-20 sm:pt-44">
      {/* Animated background layers */}
      <div className="pointer-events-none absolute inset-0 -z-10 mesh-bg animate-aurora" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 -z-10 grid-lines opacity-[0.35] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]"
        aria-hidden
      />

      <div className="mx-auto max-w-5xl text-center">
        <motion.div variants={fadeUp} initial="hidden" animate="show" custom={0}>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-elevated/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="size-3.5 text-accent" />
            AI copilot for every HR workflow
          </span>
        </motion.div>

        <motion.h1
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={1}
          className="mt-6 text-4xl font-bold leading-[1.05] sm:text-6xl lg:text-7xl"
        >
          The operating system for
          <br />
          <span className="text-gradient">modern people teams</span>
        </motion.h1>

        <motion.p
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={2}
          className="mx-auto mt-6 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg"
        >
          Nexus HR unifies employee records, attendance, leave, payroll and performance in one
          secure workspace — with an AI layer that answers questions, drafts documents and surfaces
          risks before they cost you.
        </motion.p>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={3}
          className="mt-9 flex flex-wrap items-center justify-center gap-3"
        >
          <Button variant="hero" size="xl" asChild>
            <Link to="/auth" search={{ mode: "signup" }}>
              Start free trial <ArrowRight />
            </Link>
          </Button>
          <Button variant="glass" size="xl" asChild>
            <a href="#platform">
              <Play /> See the platform
            </a>
          </Button>
        </motion.div>

        <motion.p
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={4}
          className="mt-5 inline-flex items-center gap-2 text-xs text-muted-foreground"
        >
          <ShieldCheck className="size-3.5 text-success" />
          SOC 2 aligned · Role-based access · Row-level data isolation
        </motion.p>
      </div>

      {/* Product preview */}
      <motion.div
        initial={{ opacity: 0, y: 40, rotateX: 8 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ delay: 0.45, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto mt-16 max-w-5xl [perspective:1200px]"
      >
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-float">
          <div className="flex items-center gap-1.5 border-b border-border bg-surface px-4 py-2.5">
            <span className="size-2.5 rounded-full bg-destructive/70" />
            <span className="size-2.5 rounded-full bg-warning/70" />
            <span className="size-2.5 rounded-full bg-success/70" />
            <span className="ml-3 font-mono text-[11px] text-muted-foreground">
              app.nexushr.io/dashboard
            </span>
          </div>
          <DashboardPreview />
        </div>
      </motion.div>
    </section>
  );
}

const PREVIEW_STATS = [
  { label: "Headcount", value: "2,148", delta: "+3.4%" },
  { label: "Present today", value: "94.2%", delta: "+1.1%" },
  { label: "Open leave", value: "37", delta: "-12%" },
  { label: "Payroll run", value: "$4.8M", delta: "On track" },
];

const BARS = [42, 68, 54, 82, 61, 90, 74, 96, 66, 88, 78, 94];

/** Static, purely visual dashboard mock rendered inside the hero device frame. */
function DashboardPreview() {
  return (
    <div className="grid gap-4 bg-background/60 p-4 sm:p-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {PREVIEW_STATS.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 + i * 0.08, duration: 0.5 }}
            className="surface-card p-3.5"
          >
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{stat.label}</p>
            <p className="mt-1.5 text-xl font-semibold">{stat.value}</p>
            <p className="mt-0.5 text-[11px] text-success">{stat.delta}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="surface-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Attendance trend</p>
            <span className="rounded-md bg-primary-soft px-2 py-0.5 text-[10px] font-medium text-primary">
              12 months
            </span>
          </div>
          <div className="mt-5 flex h-28 items-end gap-1.5">
            {BARS.map((h, i) => (
              <motion.span
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                transition={{ delay: 0.9 + i * 0.04, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="flex-1 rounded-t-sm gradient-brand opacity-90"
              />
            ))}
          </div>
        </div>

        <div className="surface-card p-4">
          <p className="text-sm font-medium">AI insights</p>
          <ul className="mt-3 space-y-2.5">
            {[
              "Engineering absenteeism up 8% — 3 employees flagged",
              "12 leave requests match auto-approve policy",
              "Q3 appraisal drafts ready for 46 employees",
            ].map((item) => (
              <li key={item} className="flex gap-2 text-xs text-muted-foreground">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-accent" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
