import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  Bot,
  Building2,
  CalendarClock,
  ChevronsLeft,
  ClipboardList,
  Gauge,
  LayoutDashboard,
  LogOut,
  Menu,
  ScrollText,
  Settings,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Logo } from "@/components/brand/logo";
import { CommandPalette } from "@/components/app/command-palette";
import { NotificationBell } from "@/components/app/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentEmployee, useProfile, useRoles, useSession } from "@/hooks/use-auth";
import { useRedeemPendingInvite } from "@/hooks/use-invite";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";


type NavItem = {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  /** Minimum access level required to see the entry. */
  access?: "staff" | "admin";
};

const NAV_GROUPS: { heading: string; items: NavItem[] }[] = [
  {
    heading: "Overview",
    items: [
      { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
      { label: "Analytics", to: "/analytics", icon: BarChart3, access: "staff" },
    ],
  },
  {
    heading: "People",
    items: [
      { label: "Employees", to: "/employees", icon: Users, access: "staff" },
      { label: "Departments", to: "/departments", icon: Building2, access: "staff" },
    ],
  },
  {
    heading: "Operations",
    items: [
      { label: "Attendance", to: "/attendance", icon: CalendarClock },
      { label: "Leave", to: "/leave", icon: ClipboardList },
      { label: "Payroll", to: "/payroll", icon: Wallet },
      { label: "Performance", to: "/performance", icon: Gauge },
    ],
  },
  {
    heading: "Intelligence",
    items: [{ label: "AI Copilot", to: "/copilot", icon: Bot }],
  },
  {
    heading: "Workspace",
    items: [
      { label: "Team & roles", to: "/team", icon: ShieldCheck },
      { label: "Audit log", to: "/audit", icon: ScrollText, access: "admin" },
      { label: "Settings", to: "/settings", icon: Settings },
    ],
  },
];


/** Application chrome: sidebar, top bar, command palette and page container. */
export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const { user } = useSession();
  const { data: profile } = useProfile(user?.id);
  const { primaryRole, isAdmin, isStaff } = useRoles(user?.id);
  const { data: employee } = useCurrentEmployee(user?.id);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Global keyboard shortcuts: ⌘K palette, g+d dashboard style navigation.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "/") {
        event.preventDefault();
        setCollapsed((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => setMobileOpen(false), [pathname]);

  const visible = (item: NavItem) =>
    !item.access || (item.access === "admin" ? isAdmin : isStaff);

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { mode: "signin" }, replace: true });
  };

  const initials = (profile?.full_name || user?.email || "U")
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const sidebar = (
    <div className="flex h-full flex-col gap-1 p-3">
      <div className="mb-3 flex items-center justify-between px-1.5 py-2">
        <Link to="/dashboard">
          <Logo compact={collapsed} />
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="hidden size-7 lg:inline-flex"
          onClick={() => setCollapsed((v) => !v)}
          aria-label="Collapse sidebar"
        >
          <ChevronsLeft className={cn("transition-transform", collapsed && "rotate-180")} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X />
        </Button>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter(visible);
          if (items.length === 0) return null;
          return (
            <div key={group.heading}>
              {!collapsed && (
                <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {group.heading}
                </p>
              )}
              <div className="space-y-0.5">
                {items.map((item) => {
                  const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      title={item.label}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="nav-active"
                          className="absolute left-0 h-5 w-[3px] rounded-r-full bg-primary"
                        />
                      )}
                      <item.icon className="size-[17px] shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/50 p-3">
          <p className="text-[11px] font-medium">Press ⌘K</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Jump to any page or ask the copilot.
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r border-sidebar-border bg-sidebar transition-[width] duration-300 lg:block",
          collapsed ? "w-[68px]" : "w-[248px]",
        )}
      >
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 26, stiffness: 260 }}
              className="fixed inset-y-0 left-0 z-50 w-[260px] border-r border-sidebar-border bg-sidebar lg:hidden"
            >
              {sidebar}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className={cn("transition-[padding] duration-300", collapsed ? "lg:pl-[68px]" : "lg:pl-[248px]")}>
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur-xl">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu />
          </Button>

          <button
            onClick={() => setPaletteOpen(true)}
            className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-left text-[13px] text-muted-foreground transition-colors hover:border-border-strong sm:max-w-sm"
          >
            <span className="flex-1 truncate">Search people, pages, actions…</span>
            <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
          </button>

          <div className="ml-auto flex items-center gap-1">
            <NotificationBell userId={user?.id} />
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="ml-1 flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-secondary">
                  <Avatar className="size-7">
                    <AvatarFallback className="bg-primary-soft text-[11px] font-semibold text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden text-left sm:block">
                    <span className="block text-[13px] font-medium leading-tight">
                      {profile?.full_name || "Account"}
                    </span>
                    <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                      {primaryRole}
                    </span>
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="text-sm font-medium">{profile?.full_name}</p>
                  <p className="text-xs font-normal text-muted-foreground">{user?.email}</p>
                  {employee && (
                    <p className="mt-1 text-[11px] font-normal text-muted-foreground">
                      {employee.employee_code} · {employee.designation}
                    </p>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/settings">
                    <Settings className="size-4" /> Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className="size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.div>
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        items={NAV_GROUPS.flatMap((g) => g.items.filter(visible))}
      />
    </div>
  );
}
