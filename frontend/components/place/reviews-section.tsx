"use client";

import { Loader2, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import type { Review } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${value}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          aria-hidden
          className={i <= value ? "fill-[#FBBF24] text-[#FBBF24]" : "text-border"}
        />
      ))}
    </span>
  );
}

export function ReviewsSection({ placeId }: { placeId: number }) {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [average, setAverage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const page = await api.listReviews(placeId, 50);
      setReviews(page.items);
      setTotal(page.total);
      setAverage(page.average);
      const mine = page.items.find((r) => r.is_mine);
      if (mine) {
        setRating(mine.rating);
        setComment(mine.comment ?? "");
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [placeId]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) return;
    setSubmitting(true);
    try {
      await api.postReview(placeId, rating, comment || undefined);
      toast.success(t("reviewSaved"));
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("error"));
    } finally {
      setSubmitting(false);
    }
  }

  async function removeMine() {
    setSubmitting(true);
    try {
      await api.deleteMyReview(placeId);
      setRating(0);
      setComment("");
      toast.success(t("reviewDeleted"));
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("error"));
    } finally {
      setSubmitting(false);
    }
  }

  const hasMine = reviews.some((r) => r.is_mine);

  return (
    <section className="rounded-2xl border border-border bg-card p-6" aria-label={t("reviews")}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{t("reviews")}</h2>
        {total > 0 && (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground tabular-nums">
            <Stars value={Math.round(average)} />
            {average.toFixed(1)} · {t("reviewsCount", { n: total })}
          </span>
        )}
      </div>

      {/* write / edit */}
      {user ? (
        <form onSubmit={submit} className="mb-5 space-y-3 rounded-xl bg-secondary/50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{t("yourRating")}</p>
            <div className="flex items-center gap-1" role="radiogroup" aria-label={t("yourRating")}>
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={rating === i}
                  aria-label={`${i}/5`}
                  onClick={() => setRating(i)}
                  onMouseEnter={() => setHoverRating(i)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-0.5"
                >
                  <Star
                    size={22}
                    aria-hidden
                    className={
                      i <= (hoverRating || rating)
                        ? "fill-[#FBBF24] text-[#FBBF24]"
                        : "text-border"
                    }
                  />
                </button>
              ))}
            </div>
          </div>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t("commentPlaceholder")}
            aria-label={t("commentOptional")}
            rows={2}
            maxLength={2000}
          />
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={submitting || rating < 1}>
              {submitting && <Loader2 size={14} className="animate-spin" aria-hidden />}
              {t("submitReview")}
            </Button>
            {hasMine && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive"
                disabled={submitting}
                onClick={removeMine}
              >
                <Trash2 size={14} aria-hidden />
                {t("deleteMyReview")}
              </Button>
            )}
          </div>
        </form>
      ) : (
        <p className="mb-5 rounded-xl bg-secondary/50 p-4 text-sm text-muted-foreground">
          <Link href="/login" className="text-accent hover:underline">
            {t("loginToReview")}
          </Link>
        </p>
      )}

      {/* list */}
      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" aria-hidden /> {t("loading")}
        </div>
      ) : reviews.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">{t("noReviewsYet")}</p>
      ) : (
        <ul className="space-y-3">
          {reviews.map((review) => (
            <li key={review.id} className="rounded-xl border border-border p-4">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  {review.user_name}
                  {review.is_mine && (
                    <span className="rounded-full bg-[color:var(--accent)]/15 px-2 py-0.5 text-[10px] font-medium text-accent">
                      {t("yourReviewTag")}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Stars value={review.rating} size={12} />
                  <time dateTime={review.created_at}>
                    {new Date(review.created_at).toLocaleDateString(
                      lang === "ar" ? "ar-JO" : "en-GB",
                    )}
                  </time>
                </span>
              </div>
              {review.comment && (
                <p className="text-sm leading-relaxed text-muted-foreground">{review.comment}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
