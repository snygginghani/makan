"use client";

import { Map as MapIcon, Satellite } from "lucide-react";

import { categoryColor, categoryIcon, categoryName, useCategories } from "@/lib/categories";
import { useLang } from "@/lib/i18n";

/** Horizontal chip toolbar under the nav: basemap switch + category filters.
 *  Full-width scroll row — nothing gets clipped, works in both directions. */
export function FiltersBar({
  active,
  onChange,
  satellite,
  onToggleSatellite,
}: {
  active: string | null;
  onChange: (slug: string | null) => void;
  satellite: boolean;
  onToggleSatellite: () => void;
}) {
  const { lang, t } = useLang();
  const { categories } = useCategories();

  return (
    <div
      role="toolbar"
      aria-label={t("map")}
      className="pointer-events-auto absolute top-28 right-0 left-0 z-20 overflow-x-auto px-3 pb-2 md:top-16 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="mx-auto flex w-max items-center gap-2 px-1">
        <button
          type="button"
          onClick={onToggleSatellite}
          aria-pressed={satellite}
          className={`glass flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors ${
            satellite ? "border-[color:var(--accent)]/70 text-accent" : ""
          }`}
          title={satellite ? t("mapView") : t("satellite")}
        >
          {satellite ? <MapIcon size={15} aria-hidden /> : <Satellite size={15} aria-hidden />}
          {satellite ? t("mapView") : t("satellite")}
        </button>

        <span aria-hidden className="h-6 w-px shrink-0 bg-border" />

        <button
          type="button"
          onClick={() => onChange(null)}
          aria-pressed={active === null}
          className={`glass h-10 shrink-0 rounded-full px-4 text-sm font-medium transition-colors ${
            active === null
              ? "border-[color:var(--primary)]/70 text-primary"
              : "hover:text-primary"
          }`}
        >
          {t("all")}
        </button>

        {categories.map((category) => {
          const Icon = categoryIcon(category);
          const color = categoryColor(category);
          const isActive = active === category.slug;
          return (
            <button
              key={category.slug}
              type="button"
              onClick={() => onChange(isActive ? null : category.slug)}
              aria-pressed={isActive}
              className={`glass flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors ${
                isActive ? "border-[color:var(--primary)]/70" : ""
              }`}
              style={isActive ? { color } : undefined}
            >
              <Icon size={15} aria-hidden style={{ color }} />
              {categoryName(category, lang)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
