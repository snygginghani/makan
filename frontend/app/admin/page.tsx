"use client";

import {
  Flag,
  Inbox,
  LayoutDashboard,
  Loader2,
  MapPinned,
  ShieldAlert,
  Tags,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { AnalyticsCards } from "@/components/admin/analytics-cards";
import { CategoriesPanel } from "@/components/admin/categories-panel";
import { PlacesTable } from "@/components/admin/places-table";
import { ReportsPanel } from "@/components/admin/reports-panel";
import { SubmissionsPanel } from "@/components/admin/submissions-panel";
import { UsersPanel } from "@/components/admin/users-panel";
import { TopNav } from "@/components/layout/nav";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useLang, type StrKey } from "@/lib/i18n";
import type { Analytics } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";

type Section = "overview" | "places" | "submissions" | "reports" | "categories" | "users";

const SECTIONS: { id: Section; labelKey: StrKey; icon: typeof LayoutDashboard }[] = [
  { id: "overview", labelKey: "overview", icon: LayoutDashboard },
  { id: "places", labelKey: "placesSection", icon: MapPinned },
  { id: "submissions", labelKey: "submissionsSection", icon: Inbox },
  { id: "reports", labelKey: "reportsSection", icon: Flag },
  { id: "categories", labelKey: "categoriesSection", icon: Tags },
  { id: "users", labelKey: "usersSection", icon: Users },
];

export default function AdminPage() {
  const { user, isAdmin, ready } = useAuth();
  const { t } = useLang();
  const [section, setSection] = useState<Section>("overview");
  const [stats, setStats] = useState<Analytics | null>(null);

  useEffect(() => {
    if (ready && isAdmin) {
      api.adminAnalytics().then(setStats).catch(() => {});
    }
  }, [ready, isAdmin, section]);

  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 className="animate-spin text-muted-foreground" size={24} aria-hidden />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="flex min-h-dvh flex-col">
        <TopNav />
        <div className="grid flex-1 place-items-center px-4">
          <div className="glass flex max-w-sm flex-col items-center gap-4 rounded-3xl p-8 text-center">
            <ShieldAlert size={36} className="text-destructive" aria-hidden />
            <h1 className="text-lg font-semibold">{t("adminOnly")}</h1>
            <p className="text-sm text-muted-foreground">{t("adminOnlyHint")}</p>
            <Button asChild>
              <Link href="/login">{t("login")}</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const pendingCount = stats?.pending_submissions ?? 0;
  const openReports = stats?.open_reports ?? 0;

  return (
    <div className="flex min-h-dvh flex-col">
      <TopNav />

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6 max-lg:flex-col lg:px-6">
        {/* Sidebar (top chips on mobile) */}
        <aside
          aria-label={t("adminPanel")}
          className="shrink-0 lg:w-56"
        >
          <h1 className="mb-4 hidden font-heading text-xl font-bold lg:block">
            {t("adminPanel")}
          </h1>
          <nav className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
            {SECTIONS.map(({ id, labelKey, icon: Icon }) => {
              const active = section === id;
              const badge =
                id === "submissions" ? pendingCount : id === "reports" ? openReports : 0;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSection(id)}
                  aria-current={active ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <Icon size={17} aria-hidden />
                  {t(labelKey)}
                  {badge > 0 && (
                    <span
                      className={`ms-auto grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold tabular-nums ${
                        active
                          ? "bg-primary-foreground/20"
                          : "bg-[#F87171]/15 text-[#F87171]"
                      }`}
                    >
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Content */}
        <main className="min-w-0 flex-1">
          <h2 className="mb-4 font-heading text-xl font-bold lg:mb-5">
            {t(SECTIONS.find((s) => s.id === section)!.labelKey)}
          </h2>

          {section === "overview" &&
            (stats ? (
              <AnalyticsCards stats={stats} />
            ) : (
              <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                <Loader2 className="animate-spin" size={18} aria-hidden /> {t("loading")}
              </div>
            ))}
          {section === "places" && <PlacesTable />}
          {section === "submissions" && <SubmissionsPanel />}
          {section === "reports" && <ReportsPanel />}
          {section === "categories" && <CategoriesPanel />}
          {section === "users" && <UsersPanel />}
        </main>
      </div>
    </div>
  );
}
