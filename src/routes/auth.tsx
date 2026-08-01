import { zodResolver } from "@hookform/resolvers/zod";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/hooks/use-auth";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";

type AuthMode = "signin" | "signup" | "forgot";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    mode: (["signin", "signup", "forgot"].includes(String(search.mode))
      ? String(search.mode)
      : "signin") as AuthMode,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Nexus HR" },
      { name: "description", content: "Access your Nexus HR workspace." },
      { property: "og:title", content: "Sign in — Nexus HR" },
      { property: "og:description", content: "Access your Nexus HR workspace." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
  remember: z.boolean().optional(),
  accessCode: z.string().trim().max(64).optional(),
});

const signUpSchema = z
  .object({
    email: z.string().trim().email("Enter a valid email").max(255),
    password: z.string().min(6, "Password must be at least 6 characters").max(72),
    fullName: z.string().trim().min(2, "Enter your full name").max(100),
    role: z.enum(["employee", "hr", "admin"]),
    accessCode: z.string().trim().max(64).optional(),
  })
  .refine((v) => v.role === "employee" || Boolean(v.accessCode && v.accessCode.length >= 4), {
    message: "An access code from your administrator is required for this role",
    path: ["accessCode"],
  });

const forgotSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
});

const ROLE_OPTIONS = [
  {
    value: "employee" as const,
    label: "Employee",
    icon: User,
    blurb: "Attendance, leave, payslips, goals",
  },
  {
    value: "hr" as const,
    label: "HR manager",
    icon: Users,
    blurb: "People, approvals, payroll runs",
  },
  {
    value: "admin" as const,
    label: "Administrator",
    icon: ShieldCheck,
    blurb: "Full workspace control & audit",
  },
];


function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useSession();

  // Already signed in? Go straight to the workspace.
  useEffect(() => {
    if (!loading && isAuthenticated) navigate({ to: "/dashboard", replace: true });
  }, [isAuthenticated, loading, navigate]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-16">
      <div className="pointer-events-none absolute inset-0 -z-10 mesh-bg animate-aurora" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 -z-10 grid-lines opacity-30 [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,black,transparent)]"
        aria-hidden
      />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md"
      >
        <Link to="/" className="mb-6 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Back to site
        </Link>

        <div className="surface-card p-7 shadow-float">
          <Logo />
          {mode === "signin" && <SignInForm />}
          {mode === "signup" && <SignUpForm />}
          {mode === "forgot" && <ForgotForm />}
        </div>

        <p className="mt-5 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
          <ShieldCheck className="size-3.5 text-success" />
          Protected by role-based access and row-level data isolation
        </p>
      </motion.div>
    </div>
  );
}

/** Managed Google OAuth button, shared by sign-in and sign-up. */
function GoogleButton({ label }: { label: string }) {
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const handleGoogle = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Google sign-in failed", { description: result.error.message });
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <Button variant="outline" size="lg" className="w-full" onClick={handleGoogle} disabled={busy}>
      {busy ? (
        <Loader2 className="animate-spin" />
      ) : (
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.27-4.74 3.27-8.09Z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5A11 11 0 0 0 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.14 6.16-4.14Z"
          />
        </svg>
      )}
      {label}
    </Button>
  );
}

function Divider() {
  return (
    <div className="my-5 flex items-center gap-3">
      <span className="h-px flex-1 bg-border" />
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">or</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function SignInForm() {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof signInSchema>>({
    resolver: zodResolver(signInSchema),
    defaultValues: { remember: true },
  });

  const onSubmit = async (values: z.infer<typeof signInSchema>) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    if (error) {
      toast.error("Could not sign in", { description: error.message });
      return;
    }
    toast.success("Welcome back");
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <>
      <h1 className="mt-6 text-2xl font-bold">Sign in to your workspace</h1>
      <p className="mt-1.5 text-[13px] text-muted-foreground">
        New here?{" "}
        <Link to="/auth" search={{ mode: "signup" }} className="text-primary hover:underline">
          Create an account
        </Link>
      </p>

      <div className="mt-6">
        <GoogleButton label="Continue with Google" />
      </div>
      <Divider />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="you@company.com" {...register("email")} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" {...register("password")} />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>
        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={Boolean(watch("remember"))}
              onCheckedChange={(checked) => setValue("remember", checked === true)}
            />
            Remember me
          </label>
          <Link
            to="/auth"
            search={{ mode: "forgot" }}
            className="text-xs text-primary hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <Button type="submit" variant="hero" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />} Sign in
        </Button>
      </form>
    </>
  );
}

function SignUpForm() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof signUpSchema>>({ resolver: zodResolver(signUpSchema) });

  const onSubmit = async (values: z.infer<typeof signUpSchema>) => {
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: values.fullName },
      },
    });
    if (error) {
      toast.error("Could not create account", { description: error.message });
      return;
    }
    // With email confirmation enabled there is no session yet.
    if (!data.session) {
      setSent(true);
      return;
    }
    toast.success("Workspace ready");
  };

  if (sent) {
    return (
      <div className="mt-6">
        <h1 className="text-2xl font-bold">Check your inbox</h1>
        <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
          We sent you a confirmation link. Click it to verify your email address and activate your
          Nexus HR workspace.
        </p>
        <Button variant="outline" size="lg" className="mt-6 w-full" asChild>
          <Link to="/auth" search={{ mode: "signin" }}>
            Back to sign in
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <h1 className="mt-6 text-2xl font-bold">Create your workspace</h1>
      <p className="mt-1.5 text-[13px] text-muted-foreground">
        Already have an account?{" "}
        <Link to="/auth" search={{ mode: "signin" }} className="text-primary hover:underline">
          Sign in
        </Link>
      </p>

      <div className="mt-6">
        <GoogleButton label="Sign up with Google" />
      </div>
      <Divider />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" placeholder="Alex Mercer" {...register("fullName")} />
          {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="you@company.com" {...register("email")} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="new-password" placeholder="At least 6 characters" {...register("password")} />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>
        <p className="rounded-lg border border-border bg-secondary/50 p-3 text-[11px] leading-relaxed text-muted-foreground">
          Access level is assigned by your workspace administrator. The first account created becomes
          the admin; everyone else joins as an employee.
        </p>
        <Button type="submit" variant="hero" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />} Create account
        </Button>
      </form>
    </>
  );
}

function ForgotForm() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof forgotSchema>>({ resolver: zodResolver(forgotSchema) });

  const onSubmit = async (values: z.infer<typeof forgotSchema>) => {
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error("Could not send reset link", { description: error.message });
      return;
    }
    setSent(true);
  };

  return (
    <>
      <h1 className="mt-6 text-2xl font-bold">Reset your password</h1>
      <p className="mt-1.5 text-[13px] text-muted-foreground">
        We'll email you a secure link to choose a new password.
      </p>

      {sent ? (
        <div className="mt-6 rounded-xl border border-border bg-secondary/50 p-4 text-[13px] text-muted-foreground">
          If an account exists for that address, a reset link is on its way.
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Work email</Label>
            <Input id="email" type="email" placeholder="you@company.com" {...register("email")} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <Button type="submit" variant="hero" size="lg" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />} Send reset link
          </Button>
        </form>
      )}

      <Button variant="ghost" size="sm" className="mt-4 w-full" asChild>
        <Link to="/auth" search={{ mode: "signin" }}>
          Back to sign in
        </Link>
      </Button>
    </>
  );
}
