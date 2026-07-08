"use client";

import { Compass, Loader2, MapPin, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { api } from "@/lib/api";
import { categoryColor, categoryIcon, useCategories } from "@/lib/categories";
import { placeName, useLang } from "@/lib/i18n";
import type { GeoSearchResult, Place } from "@/lib/types";

/** Search-as-you-type over the loaded places, plus real-world locations from
 *  the geocoder. Selecting a place flies to it and opens its popup; selecting a
 *  map location flies there. Positioned top-center on the map. */
export function PlaceSearch({
  places,
  onSelect,
  onGeoSelect,
  bias,
}: {
  places: Place[];
  onSelect: (place: Place) => void;
  onGeoSelect?: (result: GeoSearchResult) => void;
  bias?: { lat: number; lng: number } | null;
}) {
  const { lang, t } = useLang();
  const { bySlug } = useCategories();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [geoResults, setGeoResults] = useState<GeoSearchResult[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const geoReqId = useRef(0);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return places
      .filter(
        (p) =>
          p.name_ar.toLowerCase().includes(q) ||
          p.name_en.toLowerCase().includes(q) ||
          (p.region?.toLowerCase().includes(q) ?? false),
      )
      .slice(0, 8);
  }, [query, places]);

  // Real-world geocoder results (debounced), only when the map wants them.
  useEffect(() => {
    if (!onGeoSelect) return;
    const q = query.trim();
    if (q.length < 2) {
      setGeoResults([]);
      setGeoLoading(false);
      return;
    }
    setGeoLoading(true);
    const id = ++geoReqId.current;
    const handle = setTimeout(async () => {
      try {
        const res = await api.geoSearch(q, { lat: bias?.lat, lng: bias?.lng, lang });
        if (id === geoReqId.current) setGeoResults(res);
      } catch {
        if (id === geoReqId.current) setGeoResults([]);
      } finally {
        if (id === geoReqId.current) setGeoLoading(false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [query, onGeoSelect, bias?.lat, bias?.lng, lang]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function choose(place: Place) {
    onSelect(place);
    setQuery(placeName(place, lang));
    setOpen(false);
  }

  function chooseGeo(result: GeoSearchResult) {
    onGeoSelect?.(result);
    setQuery(result.name);
    setGeoResults([]);
    setOpen(false);
  }

  return (
    <div
      ref={boxRef}
      className="pointer-events-auto absolute top-16 left-1/2 z-20 w-[min(92vw,26rem)] -translate-x-1/2 md:top-3"
    >
      <div className="glass flex items-center gap-2 rounded-full px-3.5 py-2.5">
        <Search size={16} className="shrink-0 text-muted-foreground" aria-hidden />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={t("searchPlaces")}
          aria-label={t("searchPlaces")}
          className="w-full bg-transparent text-start text-sm outline-none placeholder:text-muted-foreground"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setOpen(false);
            }}
            aria-label={t("close")}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {open && query.trim() && (
        <ul className="glass mt-2 max-h-80 overflow-y-auto rounded-2xl p-1.5" role="listbox">
          {results.length === 0 && geoResults.length === 0 && !geoLoading ? (
            <li className="px-3 py-3 text-center text-sm text-muted-foreground">
              {t("noPlacesFound")}
            </li>
          ) : (
            results.map((place) => {
              const category = bySlug.get(place.category);
              const Icon = categoryIcon(category);
              const color = categoryColor(category);
              return (
                <li key={place.id}>
                  <button
                    type="button"
                    onClick={() => choose(place)}
                    className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-start transition-colors hover:bg-secondary"
                  >
                    <span
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                      style={{ backgroundColor: `${color}22`, color }}
                    >
                      <Icon size={15} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {placeName(place, lang)}
                      </span>
                      {place.region && (
                        <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                          <MapPin size={11} aria-hidden />
                          {place.region}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })
          )}

          {/* Real-world map locations (geocoder) */}
          {onGeoSelect && (geoResults.length > 0 || geoLoading) && (
            <li className="flex items-center gap-2 px-3 pt-2.5 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              <Compass size={12} aria-hidden />
              {t("onTheMap")}
              {geoLoading && <Loader2 size={11} className="animate-spin" aria-hidden />}
            </li>
          )}
          {onGeoSelect &&
            geoResults.map((result, i) => (
              <li key={`geo-${result.lat},${result.lng},${i}`}>
                <button
                  type="button"
                  onClick={() => chooseGeo(result)}
                  className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-start transition-colors hover:bg-secondary"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground">
                    <MapPin size={15} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{result.name}</span>
                    {result.label && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {result.label}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
