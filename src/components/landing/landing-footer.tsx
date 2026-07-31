import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

const FOOTER_LINKS = [
  {
    heading: "Product",
    links: [
      { label: "Platform", href: "/#platform" },
      { label: "AI capabilities", href: "/#ai" },
      { label: "Pricing", href: "/pricing" },
      { label: "Sign in", href: "/auth" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Careers", href: "/about" },
      { label: "Security", href: "/about" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Documentation", href: "/about" },
      { label: "Changelog", href: "/about" },
      { label: "Status", href: "/about" },
      { label: "Support", href: "/contact" },
    ],
  },
];

/** Closing call to action + site footer. */
export function LandingFooter() {
  return (
    <footer className="px-4 pb-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
        className="mx-auto max-w-6xl overflow-hidden rounded-3xl border border-border bg-surface p-10 text-center sm:p-16"
      >
        <div className="pointer-events-none absolute inset-0 -z-10 mesh-bg" aria-hidden />
        <h2 className="text-3xl font-bold sm:text-4xl">Bring your HR stack into one system</h2>
        <p className="mx-auto mt-4 max-w-xl text-[15px] text-muted-foreground">
          Set up your workspace in minutes. Invite your team, import employees and let the copilot
          take the busywork.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button variant="hero" size="xl" asChild>
            <Link to="/auth" search={{ mode: "signup" }}>
              Create your workspace <ArrowRight />
            </Link>
          </Button>
          <Button variant="outline" size="xl" asChild>
            <Link to="/contact">Book a demo</Link>
          </Button>
        </div>
      </motion.div>

      <div className="mx-auto mt-14 max-w-6xl">
        <div className="grid gap-10 border-b border-border pb-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
              The AI-native HR operating system for enterprises that care about their people data.
            </p>
          </div>
          {FOOTER_LINKS.map((group) => (
            <div key={group.heading}>
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground">
                {group.heading}
              </p>
              <ul className="mt-4 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center justify-between gap-3 py-6 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} Nexus HR. All rights reserved.</p>
          <p>Privacy · Terms · Data processing agreement</p>
        </div>
      </div>
    </footer>
  );
}
