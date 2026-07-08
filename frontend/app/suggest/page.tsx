"use client";

import { ImagePlus, Loader2, Send, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { LocationPicker } from "@/components/location-picker";
import { TopNav } from "@/components/layout/nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import { categoryName, useCategories } from "@/lib/categories";
import { useLang } from "@/lib/i18n";
import type { Submission } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";

const STATUS_BADGE: Record<Submission["status"], string> = {
  pending: "bg-[#FBBF24]/15 text-[#FBBF24]",
  approved: "bg-[#4ADE80]/15 text-[#4ADE80]",
  rejected: "bg-[#F87171]/15 text-[#F87171]",
};

export default function SuggestPage() {
  const { user, ready } = useAuth();
  const { lang, t } = useLang();
  const { categories } = useCategories();

  const [form, setForm] = useState({
    name_ar: "",
    name_en: "",
    description: "",
    category: "",
    region: "",
    lat: "",
    lng: "",
    tags: "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [mine, setMine] = useState<Submission[]>([]);

  useEffect(() => {
    if (ready && user) {
      api.mySubmissions().then(setMine).catch(() => {});
    }
  }, [ready, user]);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) {
      toast.error(t("photoRequired"));
      return;
    }
    setSubmitting(true);
    try {
      const imageUrls = await api.uploadSuggestionImages(files);
      const submission = await api.submitPlace({
        name_ar: form.name_ar,
        name_en: form.name_en,
        description: form.description || null,
        category: form.category,
        region: form.region || null,
        lat: form.lat ? Number(form.lat) : null,
        lng: form.lng ? Number(form.lng) : null,
        tags: form.tags.split(",").map((s) => s.trim()).filter(Boolean),
        images: imageUrls,
      });
      setMine((prev) => [submission, ...prev]);
      setForm({ name_ar: "", name_en: "", description: "", category: "", region: "", lat: "", lng: "", tags: "" });
      setFiles([]);
      toast.success(t("suggestSubmitted"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("error"));
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 className="animate-spin text-muted-foreground" size={24} aria-hidden />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-dvh flex-col">
        <TopNav />
        <div className="grid flex-1 place-items-center px-4">
          <div className="glass flex max-w-sm flex-col items-center gap-4 rounded-3xl p-8 text-center">
            <h1 className="text-lg font-semibold">{t("suggestLoginRequired")}</h1>
            <Button asChild>
              <Link href="/login">{t("login")}</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopNav />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="font-heading text-2xl font-bold">{t("suggestTitle")}</h1>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">{t("suggestIntro")}</p>

        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="name_ar">{t("nameAr")} *</Label>
              <Input id="name_ar" required dir="rtl" value={form.name_ar} onChange={(e) => set("name_ar", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name_en">{t("nameEn")} *</Label>
              <Input id="name_en" required dir="ltr" value={form.name_en} onChange={(e) => set("name_en", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">{t("description")}</Label>
            <Textarea id="description" rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("category")} *</Label>
              <Select value={form.category} onValueChange={(v) => set("category", v)} required>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.slug} value={c.slug}>
                      {categoryName(c, lang)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="region">{t("region")}</Label>
              <Input id="region" value={form.region} onChange={(e) => set("region", e.target.value)} placeholder={t("regionPlaceholder")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("location")}</Label>
            <LocationPicker
              lat={form.lat ? Number(form.lat) : null}
              lng={form.lng ? Number(form.lng) : null}
              onChange={(la, ln) => {
                set("lat", la != null ? String(la) : "");
                set("lng", ln != null ? String(ln) : "");
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tags">{t("tags")}</Label>
            <Input id="tags" value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder={t("tagsPlaceholder")} />
          </div>

          {/* photos — mandatory */}
          <div className="space-y-2">
            <Label>
              {t("photos")} * <span className="text-xs font-normal text-muted-foreground">({t("photoRequired")})</span>
            </Label>
            {files.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {files.map((file, i) => (
                  <div key={i} className="group relative overflow-hidden rounded-lg border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={URL.createObjectURL(file)} alt="" className="aspect-square w-full object-cover" />
                    <button
                      type="button"
                      aria-label={t("delete")}
                      onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute top-1 start-1 grid h-6 w-6 place-items-center rounded-md bg-black/60 text-white"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm text-muted-foreground transition-colors hover:border-[color:var(--primary)]/50 hover:text-foreground">
              <ImagePlus size={16} aria-hidden />
              {t("addPhotos")}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                className="hidden"
                onChange={(e) => {
                  const chosen = Array.from(e.target.files ?? []);
                  setFiles((prev) => [...prev, ...chosen].slice(0, 5));
                  e.target.value = "";
                }}
              />
            </label>
          </div>

          <Button
            type="submit"
            disabled={submitting || !form.category || files.length === 0}
            className="h-11 w-full rounded-xl"
          >
            {submitting ? (
              <Loader2 size={16} className="animate-spin" aria-hidden />
            ) : (
              <Send size={16} aria-hidden />
            )}
            {t("suggestSubmit")}
          </Button>
        </form>

        {/* my submissions */}
        {mine.length > 0 && (
          <section className="mt-8" aria-label={t("mySubmissions")}>
            <h2 className="mb-3 font-semibold">{t("mySubmissions")}</h2>
            <ul className="space-y-2">
              {mine.map((submission) => {
                const data = submission.place_json as { name_ar?: string; name_en?: string };
                return (
                  <li
                    key={submission.id}
                    className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {lang === "ar" ? data.name_ar : data.name_en}
                      </p>
                      {submission.review_note && (
                        <p className="text-xs text-muted-foreground">
                          {t("reviewNote", { note: submission.review_note })}
                        </p>
                      )}
                    </div>
                    <Badge className={STATUS_BADGE[submission.status]}>
                      {t(submission.status)}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
