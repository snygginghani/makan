"use client";

import { Flag, Heart, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError, getToken } from "@/lib/api";
import { placeName, useLang } from "@/lib/i18n";
import type { PlaceDetail } from "@/lib/types";

export function PlaceActions({ place }: { place: PlaceDetail }) {
  const router = useRouter();
  const { lang, t } = useLang();
  const [favorite, setFavorite] = useState(place.is_favorite);
  const [favLoading, setFavLoading] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reportLoading, setReportLoading] = useState(false);

  function requireAuth(): boolean {
    if (!getToken()) {
      toast.info(t("loginFirst"));
      router.push("/login");
      return false;
    }
    return true;
  }

  async function toggleFavorite() {
    if (!requireAuth()) return;
    setFavLoading(true);
    try {
      if (favorite) {
        await api.removeFavorite(place.id);
        setFavorite(false);
      } else {
        await api.addFavorite(place.id);
        setFavorite(true);
        toast.success(t("favoriteAdded"));
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("error"));
    } finally {
      setFavLoading(false);
    }
  }

  async function submitReport() {
    if (!requireAuth()) return;
    setReportLoading(true);
    try {
      await api.reportPlace(place.id, reason);
      toast.success(t("reportSent"));
      setReportOpen(false);
      setReason("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("error"));
    } finally {
      setReportLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={favorite ? "default" : "secondary"}
        onClick={toggleFavorite}
        disabled={favLoading}
        aria-pressed={favorite}
        className="gap-1.5 rounded-xl"
      >
        {favLoading ? (
          <Loader2 size={16} className="animate-spin" aria-hidden />
        ) : (
          <Heart size={16} className={favorite ? "fill-current" : ""} aria-hidden />
        )}
        {favorite ? t("favorited") : t("addFavorite")}
      </Button>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t("reportPlace")}>
            <Flag size={16} />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("reportTitle", { name: placeName(place, lang) })}</DialogTitle>
            <DialogDescription>{t("reportDescription")}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("reportPlaceholder")}
            rows={4}
            minLength={3}
          />
          <DialogFooter>
            <Button
              onClick={submitReport}
              disabled={reportLoading || reason.trim().length < 3}
              variant="destructive"
            >
              {reportLoading && <Loader2 size={16} className="animate-spin" aria-hidden />}
              {t("reportSend")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
