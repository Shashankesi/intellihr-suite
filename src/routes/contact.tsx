import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute } from "@tanstack/react-router";
import { Mail, MapPin, Phone, Send } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNav } from "@/components/landing/landing-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Nexus HR — Talk to our team" },
      {
        name: "description",
        content:
          "Book a demo or talk to the Nexus HR team about migrating your HR stack, security reviews and enterprise pricing.",
      },
      { property: "og:title", content: "Contact Nexus HR" },
      { property: "og:description", content: "Book a demo or talk to our enterprise team." },
    ],
  }),
  component: ContactPage,
});

/** Client-side validation mirrors the constraints we would enforce server-side. */
const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(100),
  email: z.string().trim().email("Enter a valid work email").max(255),
  company: z.string().trim().max(120).optional(),
  message: z.string().trim().min(10, "Tell us a little more").max(1000),
});

type ContactValues = z.infer<typeof contactSchema>;

const DETAILS = [
  { icon: Mail, label: "Email", value: "hello@nexushr.io" },
  { icon: Phone, label: "Phone", value: "+1 (415) 555-0132" },
  { icon: MapPin, label: "Offices", value: "London · Bengaluru · New York" },
];

function ContactPage() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactValues>({ resolver: zodResolver(contactSchema) });

  const onSubmit = async (values: ContactValues) => {
    // Demo form: no message is transmitted until an email provider is connected.
    await new Promise((resolve) => setTimeout(resolve, 600));
    toast.success("Thanks — we'll be in touch", {
      description: `We received your note, ${values.name.split(" ")[0]}.`,
    });
    reset();
  };

  return (
    <div className="min-h-screen bg-background">
      <LandingNav />
      <main className="px-4 pt-36 pb-20">
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_1.15fr]">
          <div>
            <h1 className="text-4xl font-bold sm:text-5xl">Let's talk</h1>
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
              Tell us about your team size, current tooling and what you need to move. We'll come
              back with a tailored walkthrough — usually within one business day.
            </p>
            <ul className="mt-10 space-y-5">
              {DETAILS.map((detail) => (
                <li key={detail.label} className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
                    <detail.icon className="size-[18px]" />
                  </span>
                  <div>
                    <p className="text-xs text-muted-foreground">{detail.label}</p>
                    <p className="text-sm font-medium">{detail.value}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="surface-card space-y-4 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" placeholder="Alex Mercer" {...register("name")} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="company">Company</Label>
                <Input id="company" placeholder="Acme Group" {...register("company")} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input id="email" type="email" placeholder="alex@acme.com" {...register("email")} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="message">How can we help?</Label>
              <Textarea
                id="message"
                rows={5}
                placeholder="We're a 1,200-person consultancy moving off spreadsheets…"
                {...register("message")}
              />
              {errors.message && (
                <p className="text-xs text-destructive">{errors.message.message}</p>
              )}
            </div>
            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Sending…" : "Send message"} <Send />
            </Button>
          </form>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
