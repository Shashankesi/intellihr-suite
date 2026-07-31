import { motion } from "framer-motion";
import { Quote, Star } from "lucide-react";

import { SectionHeading } from "@/components/landing/features";

const STATS = [
  { value: "2.4M+", label: "Employee records managed" },
  { value: "180+", label: "Enterprises onboarded" },
  { value: "31%", label: "Less admin time per HR FTE" },
  { value: "99.98%", label: "Platform uptime" },
];

const TESTIMONIALS = [
  {
    quote:
      "We consolidated four tools into Nexus HR. Leave approvals that took three days now close in under four hours, and the AI summaries genuinely save our managers a full afternoon each cycle.",
    name: "Aparna Rao",
    role: "VP People Operations, 3,200 employees",
  },
  {
    quote:
      "The audit trail and role-based access cleared our internal compliance review on the first pass. That alone justified the migration for us.",
    name: "Julien Moreau",
    role: "Head of HR Technology, Financial Services",
  },
  {
    quote:
      "Attendance insights flagged a burnout pattern in one delivery team weeks before it would have surfaced in a survey. That's the difference an AI-native HRMS makes.",
    name: "Daniel Okafor",
    role: "Director of Talent, Global Consulting",
  },
];

/** Social proof: aggregate metrics plus customer quotes. */
export function SocialProof() {
  return (
    <section className="px-4 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: i * 0.07, duration: 0.5 }}
              className="rounded-2xl border border-border bg-surface p-6 text-center"
            >
              <p className="text-3xl font-bold text-gradient">{stat.value}</p>
              <p className="mt-1.5 text-xs text-muted-foreground">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-24">
          <SectionHeading
            eyebrow="Customers"
            title="Trusted by people teams at scale"
            body="From 200-person scale-ups to 30,000-person enterprises across consulting, banking and technology."
          />

          <div className="mt-14 grid gap-4 lg:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <motion.figure
                key={t.name}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="surface-card hover-lift flex flex-col p-6"
              >
                <Quote className="size-5 text-primary" />
                <blockquote className="mt-4 flex-1 text-[13px] leading-relaxed text-muted-foreground">
                  {t.quote}
                </blockquote>
                <div className="mt-5 flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star key={s} className="size-3.5 fill-warning text-warning" />
                  ))}
                </div>
                <figcaption className="mt-3 border-t border-border pt-3">
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </figcaption>
              </motion.figure>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
