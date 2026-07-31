import { createFileRoute } from "@tanstack/react-router";

import { AiShowcase } from "@/components/landing/ai-showcase";
import { Features } from "@/components/landing/features";
import { Hero } from "@/components/landing/hero";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNav } from "@/components/landing/landing-nav";
import { Pricing } from "@/components/landing/pricing";
import { SocialProof } from "@/components/landing/social-proof";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nexus HR — AI-Powered Employee Management System" },
      {
        name: "description",
        content:
          "Nexus HR unifies employee records, attendance, leave, payroll and performance with an AI copilot built into every workflow.",
      },
      { property: "og:title", content: "Nexus HR — AI-Powered Employee Management System" },
      {
        property: "og:description",
        content:
          "The AI-native HR operating system: records, attendance, leave, payroll, performance and analytics in one secure workspace.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNav />
      <main>
        <Hero />
        <Features />
        <AiShowcase />
        <SocialProof />
        <Pricing />
      </main>
      <LandingFooter />
    </div>
  );
}
