import { createFileRoute } from "@tanstack/react-router";

import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNav } from "@/components/landing/landing-nav";
import { Pricing } from "@/components/landing/pricing";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Nexus HR" },
      {
        name: "description",
        content:
          "Transparent per-employee pricing for Nexus HR. Starter, Growth and Enterprise plans with no implementation fees.",
      },
      { property: "og:title", content: "Pricing — Nexus HR" },
      {
        property: "og:description",
        content: "Per-employee pricing for the AI-native HR platform. Starter, Growth, Enterprise.",
      },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNav />
      <main className="pt-28">
        <Pricing />
      </main>
      <LandingFooter />
    </div>
  );
}
