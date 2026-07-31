import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Building2, Globe2, Lock, Users2 } from "lucide-react";

import { SectionHeading } from "@/components/landing/features";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNav } from "@/components/landing/landing-nav";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Nexus HR — Our mission for people teams" },
      {
        name: "description",
        content:
          "Why we built Nexus HR: an AI-native HR platform designed with enterprise security, auditability and employee experience at its core.",
      },
      { property: "og:title", content: "About Nexus HR" },
      {
        property: "og:description",
        content: "An AI-native HR platform built for enterprise security, auditability and scale.",
      },
    ],
  }),
  component: AboutPage,
});

const VALUES = [
  {
    icon: Users2,
    title: "People first",
    body: "Every workflow is designed for the employee on the other side of it, not just the administrator.",
  },
  {
    icon: Lock,
    title: "Security by default",
    body: "Row-level isolation, least-privilege roles and a complete audit trail are baked in, not sold as an add-on.",
  },
  {
    icon: Globe2,
    title: "Built for scale",
    body: "One workspace serves 200 or 30,000 employees across regions, currencies and policies.",
  },
  {
    icon: Building2,
    title: "Enterprise ready",
    body: "Governance, exports and reporting that satisfy finance, compliance and internal audit on the first pass.",
  },
];

function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNav />
      <main className="px-4 pt-36 pb-16">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold sm:text-5xl">
            HR software should feel like <span className="text-gradient">the best product</span> your
            employees use
          </h1>
          <p className="mt-6 text-[15px] leading-relaxed text-muted-foreground">
            Nexus HR started from a simple observation: people teams spend more time fighting tools
            than supporting people. We rebuilt the HR stack around one connected data model and an AI
            layer that actually understands it — so records, attendance, leave, payroll and
            performance stop living in separate spreadsheets.
          </p>
        </div>

        <div className="mx-auto mt-20 max-w-6xl">
          <SectionHeading
            eyebrow="Principles"
            title="What we optimise for"
            body="Four commitments that shape every release."
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map((value, i) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07, duration: 0.5 }}
                className="surface-card hover-lift p-5"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
                  <value.icon className="size-5" />
                </span>
                <h2 className="mt-4 text-sm font-semibold">{value.title}</h2>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                  {value.body}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
