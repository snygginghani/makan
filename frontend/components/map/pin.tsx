"use client";

import { categoryColor, categoryIcon, useCategories } from "@/lib/categories";
import { placeName, useLang } from "@/lib/i18n";
import type { Place } from "@/lib/types";

export function PlacePin({
  place,
  highlighted,
  selected,
  onClick,
}: {
  place: Place;
  highlighted: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  const { lang } = useLang();
  const { bySlug } = useCategories();
  const category = bySlug.get(place.category);
  const Icon = categoryIcon(category);
  const color = categoryColor(category);
  const size = selected ? 40 : highlighted ? 36 : 28;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={placeName(place, lang)}
      className={`group relative grid place-items-center rounded-full border transition-transform duration-200 hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] ${
        highlighted ? "pin-highlight" : ""
      }`}
      style={{
        width: size,
        height: size,
        backgroundColor: highlighted || selected ? color : "rgba(12,10,9,0.85)",
        borderColor: color,
        boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
      }}
    >
      <Icon
        size={size * 0.55}
        color={highlighted || selected ? "#0c0a09" : color}
        strokeWidth={2.2}
        aria-hidden
      />
    </button>
  );
}
