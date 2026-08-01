import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

const PENDING_KEY = "nexus.pending_invite_code";

/** Remember an access code entered at signup until the user has a session. */
export function storePendingInvite(code: string) {
  try {
    window.localStorage.setItem(PENDING_KEY, code.trim());
  } catch {
    /* storage unavailable */
  }
}

export function readPendingInvite(): string | null {
  try {
    return window.localStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
}

export function clearPendingInvite() {
  try {
    window.localStorage.removeItem(PENDING_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Redeem a workspace access code for the signed-in user. */
export async function redeemInviteCode(code: string) {
  const { data, error } = await supabase.rpc("redeem_invite_code", { _code: code.trim() });
  if (error) throw new Error(error.message);
  return data as "admin" | "hr" | "employee";
}

/**
 * Once the user is authenticated, redeem any access code captured during
 * signup. Runs once per session.
 */
export function useRedeemPendingInvite(userId?: string) {
  const queryClient = useQueryClient();
  const done = useRef(false);

  useEffect(() => {
    if (!userId || done.current) return;
    const code = readPendingInvite();
    if (!code) return;
    done.current = true;

    redeemInviteCode(code)
      .then((role) => {
        clearPendingInvite();
        toast.success(`Access level activated: ${role.toUpperCase()}`);
        queryClient.invalidateQueries({ queryKey: ["roles", userId] });
      })
      .catch((error: Error) => {
        clearPendingInvite();
        toast.error("Access code not applied", { description: error.message });
      });
  }, [userId, queryClient]);
}
