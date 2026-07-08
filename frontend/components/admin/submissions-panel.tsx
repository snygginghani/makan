"use client";

import { Check, Inbox, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError, mediaUrl } from "@/lib/api";
import { categoryName, useCategories } from "@/lib/categories";
import { useLang } from "@/lib/i18n";
import type { Submission } from "@/lib/types";

const STATUS_BADGE: Record<Submission["status"], string> = {
  pending: "bg-[#FBBF24]/15 text-[#FBBF24]",
  approved: "bg-[#4ADE80]/15 text-[#4ADE80]",
  rejected: "bg-[#F87171]/15 text-[#F87171]",
};

export function SubmissionsPanel() {
  const { lang, t } = useLang();
  const { bySlug } = useCategories();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState<Submission | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    api
      .adminSubmissions()
      .then(setSubmissions)
      .catch(() => toast.error(t("loadSubmissionsError")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function review(submission: Submission, action: "approve" | "reject", reviewNote?: string) {
    setBusyId(submission.id);
    try {
      const updated = await api.reviewSubmission(submission.id, action, reviewNote);
      setSubmissions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      toast.success(action === "approve" ? t("approvedToast") : t("rejectedToast"));
      setRejecting(null);
      setNote("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("reviewFailed"));
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

  if (submissions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-muted-foreground">
        <Inbox size={32} aria-hidden />
        <p className="text-sm">{t("noSubmissions")}</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {submissions.map((submission) => {
        const data = submission.place_json as {
          name_ar?: string;
          name_en?: string;
          category?: string;
          region?: string;
          description?: string;
          images?: string[];
        };
        const category = bySlug.get(data.category ?? "");
        const badgeClass = STATUS_BADGE[submission.status];
        const busy = busyId === submission.id;
        const images = data.images ?? [];

        return (
          <li key={submission.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 gap-3">
                {images[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mediaUrl(images[0])}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-xl object-cover"
                  />
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">
                      {(lang === "ar" ? data.name_ar : data.name_en) ?? "—"}
                    </h3>
                    <Badge className={badgeClass}>{t(submission.status)}</Badge>
                    {category && (
                      <Badge variant="secondary" style={{ color: category.color ?? undefined }}>
                        {categoryName(category, lang)}
                      </Badge>
                    )}
                    {data.region && (
                      <span className="text-xs text-muted-foreground">{data.region}</span>
                    )}
                  </div>
                  {data.description && (
                    <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
                      {data.description}
                    </p>
                  )}
                  {images.length > 1 && (
                    <div className="mt-2 flex gap-1.5">
                      {images.slice(1, 5).map((url) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={url}
                          src={mediaUrl(url)}
                          alt=""
                          className="h-10 w-10 rounded-lg object-cover"
                        />
                      ))}
                    </div>
                  )}
                  {submission.review_note && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t("reviewNote", { note: submission.review_note })}
                    </p>
                  )}
                </div>
              </div>
              {submission.status === "pending" && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => review(submission, "approve", "شكراً لمساهمتك! / Thanks for contributing!")}
                  >
                    {busy ? (
                      <Loader2 size={14} className="animate-spin" aria-hidden />
                    ) : (
                      <Check size={14} aria-hidden />
                    )}
                    {t("approveAndPublish")}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    onClick={() => setRejecting(submission)}
                  >
                    <X size={14} aria-hidden />
                    {t("reject")}
                  </Button>
                </div>
              )}
            </div>
          </li>
        );
      })}

      <Dialog open={rejecting !== null} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("rejectReason")}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("rejectReasonPlaceholder")}
            rows={3}
          />
          <DialogFooter>
            <Button
              variant="destructive"
              disabled={note.trim().length < 3 || busyId !== null}
              onClick={() => rejecting && review(rejecting, "reject", note)}
            >
              {t("confirmReject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ul>
  );
}
