"use client";

import { BrainCircuit, Flag, Inbox, MapPinned, Users } from "lucide-react";

import { categoryColor, categoryName, useCategories } from "@/lib/categories";
import { useLang } from "@/lib/i18n";
import type { Analytics } from "@/lib/types";

export function AnalyticsCards({ stats }: { stats: Analytics }) {
  const { lang, t } = useLang();
  const { bySlug } = useCategories();

  const cards = [
    { label: t("publishedPlaces"), value: stats.approved_places, sub: t("ofTotal", { n: stats.total_places }), icon: MapPinned, color: "#E2725B" },
    { label: t("users"), value: stats.total_users, sub: t("registeredAccount"), icon: Users, color: "#2DD4BF" },
    { label: t("indexedPlaces"), value: stats.indexed_places, sub: t("knowledgeChunks", { n: stats.total_chunks }), icon: BrainCircuit, color: "#A78BFA" },
    { label: t("pendingSubmissions"), value: stats.pending_submissions, sub: t("awaitingReview"), icon: Inbox, color: "#FBBF24" },
    { label: t("openReports"), value: stats.open_reports, sub: t("needsAction"), icon: Flag, color: "#F87171" },
  ];

  const maxCount = Math.max(1, ...Object.values(stats.places_by_category));
  const sortedCategories = Object.entries(stats.places_by_category).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-2xl border border-border bg-card p-4">
              <span
                className="mb-3 grid h-9 w-9 place-items-center rounded-xl"
                style={{ backgroundColor: `${card.color}22`, color: card.color }}
              >
                <Icon size={18} aria-hidden />
              </span>
              <p className="text-2xl font-bold tabular-nums">{card.value}</p>
              <p className="text-sm font-medium">{card.label}</p>
              <p className="text-xs text-muted-foreground">{card.sub}</p>
            </div>
          );
        })}
      </div>

      {sortedCategories.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="mb-4 font-semibold">{t("placesByCategory")}</h3>
          <ul className="space-y-2.5">
            {sortedCategories.map(([slug, count]) => {
              const category = bySlug.get(slug);
              const color = categoryColor(category);
              return (
                <li key={slug} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-sm">
                    {categoryName(category, lang) || slug}
                  </span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${(count / maxCount) * 100}%`, backgroundColor: color }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-end text-sm tabular-nums text-muted-foreground">
                    {count}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
