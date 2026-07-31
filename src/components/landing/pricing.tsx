import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Check } from "lucide-react";

import { SectionHeading } from "@/components/landing/features";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PLANS = [
  {
    name: "Starter",
    price: "$4",
    unit: "/employee/mo",
    blurb: "For growing teams putting HR on rails for the first time.",
    features: [
      "Up to 100 employees",
      "Employee records & departments",
      "Attendance and leave",
      "Standard dashboards",
      "Email support",
    ],
    cta: "Start free",
    featured: false,
  },
  {
    name: "Growth",
    price: "$9",
    unit: "/employee/mo",
    blurb: "The full platform plus the AI copilot across every module.",
    features: [
      "Unlimited employees",
      "Payroll & payslip generation",
      "Performance reviews and goals",
      "All 10 AI capabilities",
      "CSV / PDF exports & audit trail",
      "Priority support",
    ],
    cta: "Start free trial",
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    unit: "",
    blurb: "For regulated organisations with bespoke governance needs.",
    features: [
      "SSO & advanced role model",
      "Custom approval workflows",
      "Data residency options",
      "Dedicated success manager",
      "99.99% uptime SLA",
    ],
    cta: "Talk to sales",
    featured: false,
  },
];

/** Pricing table (demo pricing). */
export function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-24 px-4 py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Pricing"
          title="Simple, per-employee pricing"
          body="No implementation fees. Move up or down a tier at any time — you only pay for active employees."
        />

        <div className="mt-14 grid gap-4 lg:grid-cols-3">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: i * 0.08, duration: 0.55 }}
              className={cn(
                "relative flex flex-col rounded-2xl border p-6",
                plan.featured
                  ? "border-primary/40 bg-card shadow-brand-glow lg:-mt-4 lg:mb-[-1rem]"
                  : "surface-card",
              )}
            >
              {plan.featured && (
                <span className="absolute -top-3 left-6 rounded-full gradient-brand px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                  Most popular
                </span>
              )}
              <h3 className="text-sm font-semibold">{plan.name}</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-xs text-muted-foreground">{plan.unit}</span>
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{plan.blurb}</p>

              <ul className="mt-6 flex-1 space-y-2.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2.5 text-[13px]">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant={plan.featured ? "hero" : "outline"}
                size="lg"
                className="mt-7 w-full"
                asChild
              >
                {plan.name === "Enterprise" ? (
                  <Link to="/contact">{plan.cta}</Link>
                ) : (
                  <Link to="/auth" search={{ mode: "signup" }}>
                    {plan.cta}
                  </Link>
                )}
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
