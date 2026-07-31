import { useQuery } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "hr" | "employee";

/**
 * Client-side session state. The authoritative access control lives in the
 * database (RLS + user_roles); this hook only drives UI.
 */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session: current } }) => {
      if (!mounted) return;
      setSession(current);
      setUser(current?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return { session, user, loading, isAuthenticated: Boolean(user) };
}

/** Current user's profile row. */
export function useProfile(userId?: string) {
  return useQuery({
    queryKey: ["profile", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Current user's roles, highest privilege first. */
export function useRoles(userId?: string) {
  const query = useQuery({
    queryKey: ["roles", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId!);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as AppRole);
    },
  });

  const roles = query.data ?? [];
  const primaryRole: AppRole = roles.includes("admin")
    ? "admin"
    : roles.includes("hr")
      ? "hr"
      : "employee";

  return {
    ...query,
    roles,
    primaryRole,
    isAdmin: roles.includes("admin"),
    isStaff: roles.includes("admin") || roles.includes("hr"),
  };
}

/** The employee record linked to the signed-in user, if any. */
export function useCurrentEmployee(userId?: string) {
  return useQuery({
    queryKey: ["current-employee", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*, departments(id, name, code)")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
