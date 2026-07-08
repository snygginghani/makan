"use client";

import { CheckCheck, Flag, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import type { Report } from "@/lib/types";

export function ReportsPanel() {
  const { t } = useLang();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    api
      .adminReports()
      .then(setReports)
      .catch(() => toast.error(t("loadReportsError")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function resolve(report: Report) {
    setBusyId(report.id);
    try {
      const updated = await api.resolveReport(report.id);
      setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      toast.success(t("reportResolved"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("resolveFailed"));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="animate-spin" size={18} aria-hidden /> {t("loading")}
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-muted-foreground">
        <Flag size={32} aria-hidden />
        <p className="text-sm">{t("noReports")}</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {reports.map((report) => (
        <li
          key={report.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4"
        >
          <div>
            <div className="flex items-center gap-2">
              <Link
                href={`/places/${report.place_id}`}
                className="text-sm font-semibold text-accent hover:underline"
              >
                {t("placeRef", { id: report.place_id })}
              </Link>
              {report.resolved ? (
                <Badge className="bg-[#4ADE80]/15 text-[#4ADE80]">{t("resolved")}</Badge>
              ) : (
                <Badge className="bg-[#F87171]/15 text-[#F87171]">{t("open")}</Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{report.reason}</p>
          </div>
          {!report.resolved && (
            <Button
              size="sm"
              variant="secondary"
              disabled={busyId === report.id}
              onClick={() => resolve(report)}
            >
              {busyId === report.id ? (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              ) : (
                <CheckCheck size={14} aria-hidden />
              )}
              {t("markResolved")}
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
