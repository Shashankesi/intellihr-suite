import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { LogOut, Moon, Sun } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTheme } from "@/components/theme-provider";
import { useProfile, useSession } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings · Nexus HR" },
      { name: "description", content: "Manage your Nexus HR profile, appearance, security and notifications." },
      { property: "og:title", content: "Settings · Nexus HR" },
      { property: "og:description", content: "Personal workspace preferences and account security." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your profile, appearance, security and notifications.</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <ProfileTab />
        </TabsContent>
        <TabsContent value="appearance" className="mt-4">
          <AppearanceTab />
        </TabsContent>
        <TabsContent value="security" className="mt-4">
          <SecurityTab />
        </TabsContent>
        <TabsContent value="notifications" className="mt-4">
          <NotificationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const profileSchema = z.object({
  full_name: z.string().min(1, "Name is required").max(120),
  phone: z.string().max(30).optional().or(z.literal("")),
  job_title: z.string().max(120).optional().or(z.literal("")),
  timezone: z.string().min(1, "Timezone is required").max(60),
  locale: z.string().min(1, "Locale is required").max(20),
  avatar_url: z.string().max(500).optional().or(z.literal("")),
});
type ProfileForm = z.infer<typeof profileSchema>;

function ProfileTab() {
  const { user } = useSession();
  const { data: profile, isLoading } = useProfile(user?.id);
  const queryClient = useQueryClient();

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: {
      full_name: profile?.full_name ?? "",
      phone: profile?.phone ?? "",
      job_title: profile?.job_title ?? "",
      timezone: profile?.timezone ?? "UTC",
      locale: profile?.locale ?? "en-US",
      avatar_url: profile?.avatar_url ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: ProfileForm) => {
      if (!user?.id) throw new Error("Not signed in");
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: values.full_name,
          phone: values.phone || null,
          job_title: values.job_title || null,
          timezone: values.timezone,
          locale: values.locale,
          avatar_url: values.avatar_url || null,
        })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile updated");
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const avatarUrl = form.watch("avatar_url");
  const initials = (form.watch("full_name") || user?.email || "U")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Card className="surface-card">
      <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your personal details shown across Nexus HR.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback className="text-lg">{isLoading ? "…" : initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="avatar_url">Avatar URL</Label>
              <Input id="avatar_url" placeholder="https://..." {...form.register("avatar_url")} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" {...form.register("full_name")} />
              {form.formState.errors.full_name && (
                <p className="text-xs text-destructive">{form.formState.errors.full_name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...form.register("phone")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="job_title">Job title</Label>
              <Input id="job_title" {...form.register("job_title")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="timezone">Timezone</Label>
              <Input id="timezone" placeholder="e.g. Asia/Kolkata" {...form.register("timezone")} />
              {form.formState.errors.timezone && (
                <p className="text-xs text-destructive">{form.formState.errors.timezone.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="locale">Locale</Label>
              <Input id="locale" placeholder="e.g. en-US" {...form.register("locale")} />
              {form.formState.errors.locale && (
                <p className="text-xs text-destructive">{form.formState.errors.locale.message}</p>
              )}
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-end border-t border-border pt-4">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Save changes"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function AppearanceTab() {
  const { theme, setTheme } = useTheme();

  return (
    <Card className="surface-card">
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>Choose how Nexus HR looks on this device.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 sm:max-w-md">
        <button
          type="button"
          onClick={() => {
            setTheme("dark");
            toast.success("Switched to dark mode");
          }}
          className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors ${
            theme === "dark" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
          }`}
        >
          <Moon className="size-5" />
          <span className="text-sm font-medium">Dark</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setTheme("light");
            toast.success("Switched to light mode");
          }}
          className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors ${
            theme === "light" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
          }`}
        >
          <Sun className="size-5" />
          <span className="text-sm font-medium">Light</span>
        </button>
      </CardContent>
    </Card>
  );
}

const passwordSchema = z
  .object({
    password: z.string().min(8, "At least 8 characters"),
    confirm: z.string().min(8, "At least 8 characters"),
  })
  .refine((v) => v.password === v.confirm, { message: "Passwords do not match", path: ["confirm"] });
type PasswordForm = z.infer<typeof passwordSchema>;

function SecurityTab() {
  const form = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  const changePassword = useMutation({
    mutationFn: async (values: PasswordForm) => {
      const { error } = await supabase.auth.updateUser({ password: values.password });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Password updated");
      form.reset();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const signOutAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Signed out of all sessions");
      window.location.href = "/auth";
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-4">
      <Card className="surface-card">
        <form onSubmit={form.handleSubmit((v) => changePassword.mutate(v))}>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
            <CardDescription>Choose a strong password you don't use elsewhere.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:max-w-md">
            <div className="space-y-1.5">
              <Label htmlFor="password">New password</Label>
              <Input id="password" type="password" {...form.register("password")} />
              {form.formState.errors.password && (
                <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input id="confirm" type="password" {...form.register("confirm")} />
              {form.formState.errors.confirm && (
                <p className="text-xs text-destructive">{form.formState.errors.confirm.message}</p>
              )}
            </div>
          </CardContent>
          <CardFooter className="justify-end border-t border-border pt-4">
            <Button type="submit" disabled={changePassword.isPending}>
              {changePassword.isPending ? "Updating..." : "Update password"}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card className="surface-card">
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
          <CardDescription>Sign out of Nexus HR everywhere, including other devices.</CardDescription>
        </CardHeader>
        <CardFooter className="border-t border-border pt-4">
          <Button variant="destructive" onClick={() => signOutAll.mutate()} disabled={signOutAll.isPending}>
            <LogOut className="mr-2 size-4" />
            {signOutAll.isPending ? "Signing out..." : "Sign out of all sessions"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

const NOTIF_KEY = "nexus-hr-notification-prefs";
type NotifPrefs = { email: boolean; leaveUpdates: boolean; payrollAlerts: boolean; productNews: boolean };
const DEFAULT_PREFS: NotifPrefs = { email: true, leaveUpdates: true, payrollAlerts: true, productNews: false };

function NotificationsTab() {
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    const raw = window.localStorage.getItem(NOTIF_KEY);
    if (raw) {
      try {
        setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
      } catch {
        // ignore malformed local storage value
      }
    }
  }, []);

  const update = (key: keyof NotifPrefs, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    window.localStorage.setItem(NOTIF_KEY, JSON.stringify(next));
    toast.success("Preference saved");
  };

  const rows: { key: keyof NotifPrefs; label: string; description: string }[] = [
    { key: "email", label: "Email notifications", description: "Receive general updates by email." },
    { key: "leaveUpdates", label: "Leave request updates", description: "Get notified when leave requests change status." },
    { key: "payrollAlerts", label: "Payroll alerts", description: "Get notified when payslips are processed." },
    { key: "productNews", label: "Product news", description: "Occasional updates about new Nexus HR features." },
  ];

  return (
    <Card className="surface-card">
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>These preferences are saved on this device.</CardDescription>
      </CardHeader>
      <CardContent className="divide-y divide-border">
        {rows.map((row, i) => (
          <div key={row.key} className={`flex items-center justify-between py-3 ${i === 0 ? "pt-0" : ""}`}>
            <div>
              <p className="text-sm font-medium">{row.label}</p>
              <p className="text-xs text-muted-foreground">{row.description}</p>
            </div>
            <Switch checked={prefs[row.key]} onCheckedChange={(v) => update(row.key, v)} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
