"use client";

import { Loader2, Trophy } from "lucide-react";
import { useEffect, useState } from "react";

import { LeaderboardList } from "@/components/leaderboard-list";
import { TopNav } from "@/components/layout/nav";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import type { LeaderboardEntry } from "@/lib/types";

export default function LeaderboardPage() {
  const { t } = useLang();
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);

  useEffect(() => {
    api.leaderboard(50).then(setEntries).catch(() => setEntries([]));
  }, []);

  return (
    <div className="flex min-h-dvh flex-col">
      <TopNav />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#FBBF24]/15 text-[#FBBF24]">
            <Trophy size={22} aria-hidden />
          </span>
          <div>
            <h1 className="font-heading text-2xl font-bold">{t("leaderboard")}</h1>
            <p className="text-sm text-muted-foreground">{t("howToEarn")}</p>
          </div>
        </div>

        {entries === null ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="animate-spin" size={18} aria-hidden /> {t("loading")}
          </div>
        ) : (
          <LeaderboardList entries={entries} />
        )}
      </main>
    </div>
  );
}
