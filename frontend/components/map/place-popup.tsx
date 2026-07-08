"use client";

import { MessageSquare, Navigation, Star, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { api, mediaUrl } from "@/lib/api";
import { categoryColor, categoryIcon, categoryName, useCategories } from "@/lib/categories";
import { placeName, useLang } from "@/lib/i18n";
import type { Place, Review } from "@/lib/types";

/** Premium map popup: photo hero with the name overlaid, then a tidy body of
 *  rating, category, description, one top review, and clear actions. */
export function PlacePopupCard({
  place,
  onClose,
}: {
  place: Place;
  onClose: () => void;
}) {
  const { lang, t } = useLang();
  const { bySlug } = useCategories();
  const category = bySlug.get(place.category);
  const Icon = categoryIcon(category);
  const color = categoryColor(category);
  const photo = place.images[0];
  const name = placeName(place, lang);

  const [topReview, setTopReview] = useState<Review | null | undefined>(undefined);

  useEffect(() => {
    let on = true;
    api
      .listReviews(place.id, 1)
      .then((p) => on && setTopReview(p.items[0] ?? null))
      .catch(() => on && setTopReview(null));
    return () => {
      on = false;
    };
  }, [place.id]);

  return (
    <div className="w-full max-w-[19rem] overflow-hidden rounded-2xl border border-border bg-popover text-start text-popover-foreground shadow-2xl">
      {/* hero */}
      <div className="relative h-32">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl(photo)} alt={name} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center" style={{ backgroundColor: `${color}1f` }}>
            <Icon size={34} style={{ color }} aria-hidden />
          </div>
        )}
        {/* gradient + name overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
        <h3 className="absolute inset-x-3 bottom-2 text-base font-bold leading-tight text-white drop-shadow">
          {name}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="absolute top-2 end-2 grid h-7 w-7 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition-colors hover:bg-black/70"
        >
          <X size={15} />
        </button>
        {place.rating > 0 && (
          <span className="absolute top-2 start-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur tabular-nums">
            <Star size={11} className="fill-[#FBBF24] text-[#FBBF24]" aria-hidden />
            {place.rating.toFixed(1)}
          </span>
        )}
      </div>

      {/* body */}
      <div className="space-y-2.5 p-3.5">
        {/* meta row */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span
            className="flex items-center gap-1 rounded-full px-2 py-0.5 font-medium"
            style={{ backgroundColor: `${color}1f`, color }}
          >
            <Icon size={12} aria-hidden />
            {categoryName(category, lang) || place.category}
          </span>
          {place.region && <span className="text-muted-foreground">{place.region}</span>}
        </div>

        {place.description && (
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {place.description}
          </p>
        )}

        {/* one top review */}
        {topReview && (
          <div className="flex items-start gap-2 rounded-xl bg-secondary/60 px-2.5 py-2">
            <MessageSquare size={13} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
            <p className="line-clamp-2 text-xs leading-relaxed">
              <span className="font-semibold">{topReview.user_name}: </span>
              {topReview.comment ?? `${topReview.rating}/5`}
            </p>
          </div>
        )}

        {/* actions */}
        <div className="flex items-center gap-2 pt-0.5">
          <Link
            href={`/places/${place.id}`}
            className="flex h-9 flex-1 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            {t("details")}
          </Link>
          {place.lat != null && place.lng != null && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("directions")}
              title={t("directions")}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground transition-opacity hover:opacity-90"
            >
              <Navigation size={15} aria-hidden />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
