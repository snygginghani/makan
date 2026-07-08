"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { GoogleSignIn } from "@/components/auth/google-signin";
import { LogoMark } from "@/components/brand/logo";
import { useLang } from "@/lib/i18n";

export default function LoginPage() {
  const { t } = useLang();
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    setExpired(new URLSearchParams(window.location.search).get("expired") === "1");
  }, []);

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-8">
      <div className="glass w-full max-w-sm rounded-3xl p-7 text-center sm:p-9">
        <Link href="/" className="mb-5 inline-flex flex-col items-center gap-2.5" aria-label={t("appName")}>
          <LogoMark size={56} />
          <span className="font-heading text-2xl font-bold">{t("appName")}</span>
        </Link>
        {expired && (
          <p className="mb-4 rounded-xl border border-[#FBBF24]/40 bg-[#FBBF24]/10 px-3 py-2 text-sm text-[#FBBF24]">
            {t("sessionExpired")}
          </p>
        )}
        <h1 className="text-lg font-semibold">{t("loginTitle")}</h1>
        <p className="mt-1 mb-7 text-sm text-muted-foreground">{t("loginSubtitle")}</p>

        <div className="flex justify-center">
          <GoogleSignIn />
        </div>

        <p className="mt-7 text-xs leading-relaxed text-muted-foreground">{t("loginPrivacy")}</p>
      </div>
    </main>
  );
}
