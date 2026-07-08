"use client";

import {
  BookOpen,
  Camera,
  Coffee,
  Droplets,
  Footprints,
  Gem,
  Landmark,
  MapPin,
  Mountain,
  MountainSnow,
  Tent,
  Trees,
  UtensilsCrossed,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

import { api } from "./api";
import type { Category } from "./types";
import type { Lang } from "./i18n";

/** lucide icon lookup by the icon name stored on the category row */
const ICON_MAP: Record<string, LucideIcon> = {
  "mountain-snow": MountainSnow,
  mountain: Mountain,
  waves: Waves,
  droplets: Droplets,
  camera: Camera,
  footprints: Footprints,
  tent: Tent,
  coffee: Coffee,
  utensils: UtensilsCrossed,
  "book-open": BookOpen,
  gem: Gem,
  trees: Trees,
  landmark: Landmark,
  "map-pin": MapPin,
};

/** Selectable icons for the category editor (name + component). */
export const ICON_OPTIONS: { name: string; Icon: LucideIcon }[] = Object.entries(
  ICON_MAP,
).map(([name, Icon]) => ({ name, Icon }));

const FALLBACK_COLORS = [
  "#E2725B", "#2DD4BF", "#A78BFA", "#FBBF24", "#4ADE80",
  "#38BDF8", "#F472B6", "#FB923C", "#818CF8", "#E879F9",
];

export function categoryIcon(category: Category | undefined): LucideIcon {
  return (category?.icon && ICON_MAP[category.icon]) || MapPin;
}

/** Category color: the admin-set color, else a distinct fallback derived from
 *  the category id so each category is stably colored (no caller index needed). */
export function categoryColor(category: Category | undefined): string {
  if (category?.color) return category.color;
  const seed = category?.id ?? 0;
  return FALLBACK_COLORS[seed % FALLBACK_COLORS.length];
}

export function categoryName(category: Category | undefined, lang: Lang): string {
  if (!category) return "";
  return lang === "ar" ? category.name_ar : category.name_en;
}

// Module-level cache so the list is fetched once per page load.
let cache: Category[] | null = null;
let inflight: Promise<Category[]> | null = null;

async function fetchCategories(): Promise<Category[]> {
  if (cache) return cache;
  inflight ??= api
    .listCategories()
    .then((rows) => {
      cache = rows;
      return rows;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function invalidateCategories() {
  cache = null;
}

/** Categories from the API (admin-managed). */
export function useCategories(): { categories: Category[]; bySlug: Map<string, Category> } {
  const [categories, setCategories] = useState<Category[]>(cache ?? []);

  useEffect(() => {
    let mounted = true;
    fetchCategories()
      .then((rows) => mounted && setCategories(rows))
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  return { categories, bySlug: new Map(categories.map((c) => [c.slug, c])) };
}
