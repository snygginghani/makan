"use client";

import { useCallback, useEffect, useState } from "react";

import { clearSession, getStoredUser } from "./api";
import type { User } from "./types";

/** Session state from localStorage (JWT). Re-reads on mount + storage events. */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUser(getStoredUser());
    setReady(true);
    const refresh = () => setUser(getStoredUser());
    window.addEventListener("storage", refresh);
    window.addEventListener("makan-auth", refresh); // same-tab login/onboarding
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("makan-auth", refresh);
    };
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  return { user, ready, isAdmin: user?.role === "admin", logout };
}
