"use client";

import {
  BadgeCheck,
  Heart,
  Lightbulb,
  Loader2,
  Star,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { LeaderboardList } from "@/components/leaderboard-list";
import { TopNav } from "@/components/layout/nav";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import type { LeaderboardEntry, UserStats } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";

const EARN = [
  { key: "earnReview", pts: 10, icon: Star, color: "#FBBF24" },
  { key: "earnSuggest", pts: 10, icon: Lightbulb, color: "#4ADE80" },
  { key: "earnApproved", pts: 40, icon: BadgeCheck, color: "#2DD4BF" },
] as const;

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useLang();
  const { user, ready } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  useEffect(() => {
    if (ready && user) {
      api.myStats().then(setStats).catch(() => {});
      api.leaderboard(5).then(setBoard).catch(() => {});
    }
  }, [ready, user]);

  if (!ready || !user) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 className="animate-spin text-muted-foreground" size={24} aria-hidden />
      </div>
    );
  }

  const level = stats ? 1 + Math.floor(stats.points / 100) : 1;
  const progress = stats ? stats.points % 100 : 0;

  const statCards = [
    { label: t("reviewsGiven"), value: stats?.reviews_count ?? 0, icon: Star, color: "#FBBF24" },
    { label: t("favoritesSaved"), value: stats?.favorites_count ?? 0, icon: Heart, color: "#F472B6" },
    { label: t("placesSuggested"), value: stats?.submissions_count ?? 0, icon: Lightbulb, color: "#4ADE80" },
    { label: t("placesApproved"), value: stats?.approved_count ?? 0, icon: BadgeCheck, color: "#2DD4BF" },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <TopNav />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
        <h1 className="font-heading text-2xl font-bold">{t("dashboard")}</h1>

        {/* hero: points + level */}
        <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-6">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-8 -end-8 h-40 w-40 rounded-full opacity-20"
            style={{ background: "radial-gradient(circle, var(--primary), transparent 70%)" }}
          />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-center gap-4">
              {user.picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.picture}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-16 w-16 rounded-2xl object-cover"
                />
              ) : (
                <span className="grid h-16 w-16 place-items-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground">
                  {(user.username ?? user.name).charAt(0).toUpperCase()}
                </span>
              )}
              <div>
                <p className="font-heading text-xl font-bold">{user.username ?? user.name}</p>
                <p className="text-sm text-muted-foreground">
                  {t("level")} {level} · {t("contributor")}
                </p>
              </div>
            </div>
            <div className="text-end">
              <p className="text-3xl font-bold text-primary tabular-nums">
                {(stats?.points ?? 0).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">{t("yourPoints")}</p>
            </div>
          </div>

          {/* level progress */}
          <div className="relative mt-5">
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {t("level")} {level}
              </span>
              <span>{t("toNextLevel", { n: 100 - progress })}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </section>

        {/* rank + stat cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-2xl border border-border bg-card p-4">
            <span className="mb-3 grid h-9 w-9 place-items-center rounded-xl bg-[#FBBF24]/15 text-[#FBBF24]">
              <Trophy size={18} aria-hidden />
            </span>
            <p className="text-2xl font-bold tabular-nums">#{stats?.rank ?? "—"}</p>
            <p className="text-sm font-medium">{t("yourRank")}</p>
            <p className="text-xs text-muted-foreground">
              {t("of")} {stats?.total_contributors ?? 0} {t("contributors")}
            </p>
          </div>
          {statCards.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.label} className="rounded-2xl border border-border bg-card p-4">
                <span
                  className="mb-3 grid h-9 w-9 place-items-center rounded-xl"
                  style={{ backgroundColor: `${c.color}22`, color: c.color }}
                >
                  <Icon size={18} aria-hidden />
                </span>
                <p className="text-2xl font-bold tabular-nums">{c.value}</p>
                <p className="text-sm font-medium">{c.label}</p>
              </div>
            );
          })}
        </div>

        {/* how to earn */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 font-semibold">{t("howToEarn")}</h2>
          <ul className="space-y-2">
            {EARN.map(({ key, pts, icon: Icon, color }) => (
              <li key={key} className="flex items-center gap-3">
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                  style={{ backgroundColor: `${color}22`, color }}
                >
                  <Icon size={16} aria-hidden />
                </span>
                <span className="flex-1 text-sm">{t(key)}</span>
                <span className="text-sm font-bold text-primary tabular-nums">
                  +{pts}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* leaderboard preview */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">{t("leaderboard")}</h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/leaderboard">{t("all")}</Link>
            </Button>
          </div>
          <LeaderboardList entries={board} />
        </section>
      </main>
    </div>
  );
}
