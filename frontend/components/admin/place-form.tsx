"use client";

import { ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
import { LocationPicker } from "@/components/location-picker";
import { api, ApiError, mediaUrl } from "@/lib/api";
import { categoryName, useCategories } from "@/lib/categories";
import { useLang } from "@/lib/i18n";
import type { Place } from "@/lib/types";

/** Create/edit place form. Photos are mandatory on create; on edit the
 *  existing photos are managed inline (upload/delete apply immediately). */
export function PlaceForm({
  place,
  onSaved,
}: {
  place: Place | null;
  onSaved: (place: Place) => void;
}) {
  const { lang, t } = useLang();
  const { categories } = useCategories();
  const [form, setForm] = useState({
    name_ar: place?.name_ar ?? "",
    name_en: place?.name_en ?? "",
    description: place?.description ?? "",
    category: place?.category ?? "",
    region: place?.region ?? "",
    lat: place?.lat?.toString() ?? "",
    lng: place?.lng?.toString() ?? "",
    tags: place?.tags.join(", ") ?? "",
    coords_verified: place?.coords_verified ?? false,
  });
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>(place?.images ?? []);
  const [loading, setLoading] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!place && newFiles.length === 0) {
      toast.error(t("photoRequired"));
      return;
    }
    setLoading(true);
    const payload = {
      name_ar: form.name_ar,
      name_en: form.name_en,
      description: form.description || null,
      category: form.category,
      region: form.region || null,
      lat: form.lat ? Number(form.lat) : null,
      lng: form.lng ? Number(form.lng) : null,
      tags: form.tags.split(",").map((s) => s.trim()).filter(Boolean),
      coords_verified: form.coords_verified,
    };
    try {
      let saved = place
        ? await api.updatePlace(place.id, payload as Partial<Place>)
        : await api.createPlace(payload as Partial<Place>);
      if (newFiles.length > 0) {
        saved = await api.uploadPlaceImages(saved.id, newFiles);
      }
      toast.success(place ? t("placeSaved") : t("placeCreated"));
      onSaved(saved);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("saveFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function removeExistingImage(url: string) {
    if (!place) return;
    setPhotoBusy(true);
    try {
      const saved = await api.deletePlaceImage(place.id, url);
      setExistingImages(saved.images);
      toast.success(t("photoDeleted"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("photoDeleteFailed"));
    } finally {
      setPhotoBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="name_ar">{t("nameAr")} *</Label>
          <Input id="name_ar" dir="rtl" required value={form.name_ar} onChange={(e) => set("name_ar", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name_en">{t("nameEn")} *</Label>
          <Input id="name_en" dir="ltr" required value={form.name_en} onChange={(e) => set("name_en", e.target.value)} />
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

      {/* photos */}
      <div className="space-y-2">
        <Label>
          {t("photos")} {place ? "" : "*"}{" "}
          <span className="text-xs font-normal text-muted-foreground">
            ({place ? t("photosDialogHint") : t("photoRequired")})
          </span>
        </Label>

        {(existingImages.length > 0 || newFiles.length > 0) && (
          <div className="grid grid-cols-4 gap-2">
            {existingImages.map((url) => (
              <div key={url} className="group relative overflow-hidden rounded-lg border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl(url)} alt="" className="aspect-square w-full object-cover" />
                <button
                  type="button"
                  aria-label={t("delete")}
                  disabled={photoBusy}
                  onClick={() => removeExistingImage(url)}
                  className="absolute top-1 start-1 grid h-6 w-6 place-items-center rounded-md bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {newFiles.map((file, i) => (
              <div key={`new-${i}`} className="relative overflow-hidden rounded-lg border-2 border-dashed border-[color:var(--accent)]/50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={URL.createObjectURL(file)} alt="" className="aspect-square w-full object-cover" />
                <button
                  type="button"
                  aria-label={t("delete")}
                  onClick={() => setNewFiles((prev) => prev.filter((_, j) => j !== i))}
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
              setNewFiles((prev) => [...prev, ...chosen].slice(0, 12));
              e.target.value = "";
            }}
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.coords_verified}
          onChange={(e) => set("coords_verified", e.target.checked)}
          className="h-4 w-4 accent-[var(--primary)]"
        />
        {t("coordsVerified")}
      </label>

      <Button type="submit" disabled={loading || !form.category} className="w-full">
        {loading && <Loader2 size={16} className="animate-spin" aria-hidden />}
        {place ? t("save") : t("newPlace")}
      </Button>
    </form>
  );
}
