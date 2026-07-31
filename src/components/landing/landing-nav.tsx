import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useState } from "react";

import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { label: "Platform", to: "/#platform" },
  { label: "AI", to: "/#ai" },
  { label: "Pricing", to: "/pricing" },
  { label: "About", to: "/about" },
  { label: "Contact", to: "/contact" },
] as const;

/** Sticky, frosted marketing navigation. */
export function LandingNav() {
  const [open, setOpen] = useState(false);

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 top-0 z-50 px-4 pt-3"
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-2xl glass px-4 py-2.5 shadow-elegant">
        <Link to="/" className="shrink-0">
          <Logo />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.to}
              className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <ThemeToggle className="hidden sm:inline-flex" />
          <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
            <Link to="/auth">Sign in</Link>
          </Button>
          <Button variant="hero" size="sm" asChild>
            <Link to="/auth" search={{ mode: "signup" }}>
              Start free
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Toggle menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </nav>

      {open && (
        <div className="mx-auto mt-2 max-w-6xl rounded-2xl glass p-2 md:hidden">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.to}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </motion.header>
  );
}
