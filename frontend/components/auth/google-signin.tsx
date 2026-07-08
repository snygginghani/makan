"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { api, ApiError, storeSession } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { useTheme } from "@/lib/use-theme";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

// Minimal typing for the Google Identity Services global.
interface GoogleCredentialResponse {
  credential: string;
}
interface GoogleAccounts {
  id: {
    initialize: (config: {
      client_id: string;
      callback: (res: GoogleCredentialResponse) => void;
    }) => void;
    renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
  };
}
declare global {
  interface Window {
    google?: { accounts: GoogleAccounts };
  }
}

export function GoogleSignIn() {
  const router = useRouter();
  const { lang, t } = useLang();
  const { theme } = useTheme();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleCredential = useCallback(
    async (res: GoogleCredentialResponse) => {
      setBusy(true);
      try {
        const token = await api.googleLogin(res.credential);
        storeSession(token);
        toast.success(`${t("welcome", { name: token.user.name })}`);
        // first-time users pick a username before entering the app
        if (!token.user.onboarded) router.push("/onboarding");
        else router.push(token.user.role === "admin" ? "/admin" : "/");
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : t("loginFailed"));
        setBusy(false);
      }
    },
    [router, t],
  );

  useEffect(() => {
    if (!scriptReady || !CLIENT_ID || !buttonRef.current || !window.google) return;
    window.google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: handleCredential,
    });
    buttonRef.current.innerHTML = "";
    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: theme === "dark" ? "filled_black" : "outline",
      size: "large",
      shape: "pill",
      text: "continue_with",
      width: 300,
      locale: lang,
    });
  }, [scriptReady, theme, lang, handleCredential]);

  if (!CLIENT_ID) {
    return (
      <p className="rounded-xl border border-dashed border-destructive/40 bg-destructive/5 p-4 text-center text-sm text-muted-foreground">
        {t("googleNotConfigured")}
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
      />
      {busy ? (
        <div className="flex h-11 items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" aria-hidden />
          {t("signingIn")}
        </div>
      ) : (
        <div ref={buttonRef} className="min-h-11" />
      )}
    </div>
  );
}
