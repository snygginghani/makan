"use client";

import { ExternalLink, MapPin, Star } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { mediaUrl } from "@/lib/api";
import { categoryColor, categoryIcon, useCategories } from "@/lib/categories";
import { placeName, useLang } from "@/lib/i18n";
import type { Place } from "@/lib/types";

export function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/** Compact preview card used on the map page rail. */
export function PlaceCard({
  place,
  active,
  distanceKm,
  onHover,
}: {
  place: Place;
  active?: boolean;
  distanceKm?: number | null;
  onHover?: () => void;
}) {
  const { lang, t } = useLang();
  const { bySlug } = useCategories();
  const category = bySlug.get(place.category);
  const Icon = categoryIcon(category);
  const color = categoryColor(category);
  const photo = place.images[0];

  return (
    <div
      onMouseEnter={onHover}
      className={`glass relative w-64 shrink-0 overflow-hidden rounded-xl transition-colors ${
        active ? "border-[color:var(--primary)]/70" : "hover:border-[color:var(--primary)]/40"
      }`}
    >
      {photo && (
        <Link href={`/places/${place.id}`} tabIndex={-1} aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaUrl(photo)}
            alt=""
            loading="lazy"
            className="h-24 w-full object-cover"
          />
        </Link>
      )}
      <div className="flex items-start gap-2.5 p-3">
        {!photo && (
          <span
            className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg"
            style={{ backgroundColor: `${color}22`, color }}
          >
            <Icon size={18} aria-hidden />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <Link
            href={`/places/${place.id}`}
            className="focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
          >
            <h3 className="truncate text-sm font-semibold hover:text-primary">
              {placeName(place, lang)}
            </h3>
          </Link>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            {place.rating > 0 && (
              <span className="flex items-center gap-0.5 tabular-nums">
                <Star size={12} className="fill-[#FBBF24] text-[#FBBF24]" aria-hidden />
                {place.rating.toFixed(1)}
              </span>
            )}
            {place.region && (
              <span className="flex items-center gap-0.5 truncate">
                <MapPin size={12} aria-hidden />
                {place.region}
              </span>
            )}
            {distanceKm != null && (
              <Badge variant="secondary" className="tabular-nums text-[10px]">
                {distanceKm.toFixed(1)} {t("km")}
              </Badge>
            )}
          </div>
        </div>
        {place.lat != null && place.lng != null && (
          <a
            href={googleMapsUrl(place.lat, place.lng)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("openInGoogleMaps")}
            title={t("openInGoogleMaps")}
            className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <ExternalLink size={15} aria-hidden />
          </a>
        )}
      </div>
    </div>
  );
}
