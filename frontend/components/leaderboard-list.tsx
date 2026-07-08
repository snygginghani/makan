"use client";

import { Crown, Medal, User2 } from "lucide-react";

import { useLang } from "@/lib/i18n";
import type { LeaderboardEntry } from "@/lib/types";

const MEDAL = ["#FBBF24", "#CBD5E1", "#D19661"]; // gold, silver, bronze

export function LeaderboardList({ entries }: { entries: LeaderboardEntry[] }) {
  const { t } = useLang();

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border py-14 text-center text-sm text-muted-foreground">
        {t("leaderboardEmpty")}
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {entries.map((e) => {
        const medal = e.rank <= 3 ? MEDAL[e.rank - 1] : null;
        return (
          <li
            key={e.id}
            className={`flex items-center gap-3 rounded-2xl border p-3 transition-colors ${
              e.is_me
                ? "border-[color:var(--primary)]/60 bg-[color:var(--primary)]/5"
                : "border-border bg-card"
            }`}
          >
            <span
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold tabular-nums"
              style={
                medal
                  ? { backgroundColor: `${medal}22`, color: medal }
                  : { backgroundColor: "var(--secondary)", color: "var(--muted-foreground)" }
              }
            >
              {e.rank === 1 ? <Crown size={15} /> : medal ? <Medal size={15} /> : e.rank}
            </span>

            {e.picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={e.picture}
                alt=""
                referrerPolicy="no-referrer"
                className="h-9 w-9 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
                <User2 size={16} aria-hidden />
              </span>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {e.username ?? e.name}
                {e.is_me && <span className="ms-2 text-xs text-primary">· {t("you")}</span>}
              </p>
            </div>

            <span className="shrink-0 text-sm font-bold text-primary tabular-nums">
              {e.points.toLocaleString()}{" "}
              <span className="text-xs font-normal text-muted-foreground">{t("points")}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
