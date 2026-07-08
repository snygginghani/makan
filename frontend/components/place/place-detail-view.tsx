"use client";

import { BadgeCheck, MapPin, Navigation, Star, TriangleAlert } from "lucide-react";

import { TopNav } from "@/components/layout/nav";
import { PlaceActions } from "@/components/place/place-actions";
import { PlaceGallery } from "@/components/place/place-gallery";
import { PlaceMiniMap } from "@/components/place/place-mini-map";
import { ReviewsSection } from "@/components/place/reviews-section";
import { Badge } from "@/components/ui/badge";
import { categoryColor, categoryIcon, categoryName, useCategories } from "@/lib/categories";
import { placeAltName, placeName, useLang } from "@/lib/i18n";
import type { PlaceDetail } from "@/lib/types";

export function PlaceDetailView({ place }: { place: PlaceDetail }) {
  const { lang, t } = useLang();
  const { bySlug } = useCategories();
  const category = bySlug.get(place.category);
  const Icon = categoryIcon(category);
  const color = categoryColor(category);
  const hasCoords = place.lat != null && place.lng != null;

  return (
    <div className="flex min-h-dvh flex-col">
      <TopNav />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:py-10">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span
                className="grid h-11 w-11 place-items-center rounded-xl"
                style={{ backgroundColor: `${color}22`, color }}
              >
                <Icon size={22} aria-hidden />
              </span>
              <div>
                <h1 className="font-heading text-2xl font-bold sm:text-3xl">{placeName(place, lang)}</h1>
                <p
                  className="text-sm text-muted-foreground"
                  dir={lang === "ar" ? "ltr" : "rtl"}
                >
                  {placeAltName(place, lang)}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary" style={{ color }}>
                {categoryName(category, lang) || place.category}
              </Badge>
              {place.region && (
                <span className="flex items-center gap-1">
                  <MapPin size={14} aria-hidden />
                  {place.region}
                </span>
              )}
              {place.rating > 0 && (
                <span className="flex items-center gap-1 tabular-nums">
                  <Star size={14} className="fill-[#FBBF24] text-[#FBBF24]" aria-hidden />
                  {place.rating.toFixed(1)}
                  <span className="text-xs">({place.rating_count})</span>
                </span>
              )}
              {place.coords_verified ? (
                <span className="flex items-center gap-1 text-[#4ADE80]">
                  <BadgeCheck size={14} aria-hidden /> {t("verifiedCoords")}
                </span>
              ) : (
                hasCoords && (
                  <span className="flex items-center gap-1 text-xs">
                    <TriangleAlert size={13} aria-hidden /> {t("approxCoords")}
                  </span>
                )
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 max-sm:w-full">
            {hasCoords && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 sm:flex-none"
              >
                <Navigation size={15} aria-hidden />
                {t("directions")}
              </a>
            )}
            <PlaceActions place={place} />
          </div>
        </div>

        {/* Photos */}
        {place.images.length > 0 && (
          <div className="mt-6">
            <PlaceGallery images={place.images} name={placeName(place, lang)} />
          </div>
        )}

        {/* Body */}
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {place.description && (
              <section className="rounded-2xl border border-border bg-card p-6">
                <h2 className="mb-2 font-semibold">{t("about")}</h2>
                <p className="leading-relaxed text-muted-foreground">{place.description}</p>
                {place.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {place.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </section>
            )}

            <ReviewsSection placeId={place.id} />
          </div>

          <aside className="space-y-3">
            <div className="overflow-hidden rounded-2xl border border-border">
              <PlaceMiniMap place={place} />
            </div>
            {hasCoords && (
              <p className="text-center text-xs text-muted-foreground tabular-nums" dir="ltr">
                {place.lat!.toFixed(5)}, {place.lng!.toFixed(5)}
              </p>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
