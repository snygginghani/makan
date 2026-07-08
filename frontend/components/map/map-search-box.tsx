"use client";

import { Loader2, MapPin, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import type { GeoSearchResult } from "@/lib/types";

/** Debounced real-world place search (keyless OSM geocoder). Reused by the
 *  location picker (to drop a precise pin) and the main map (to fly somewhere). */
export function MapSearchBox({
  onPick,
  bias,
  placeholder,
  className,
  inputClassName = "h-10",
  autoFocus = false,
}: {
  onPick: (result: GeoSearchResult) => void;
  bias?: { lat: number; lng: number } | null;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  autoFocus?: boolean;
}) {
  const { lang, t } = useLang();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const reqId = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = ++reqId.current;
    const handle = setTimeout(async () => {
      try {
        const res = await api.geoSearch(q, { lat: bias?.lat, lng: bias?.lng, lang });
        if (id === reqId.current) {
          setResults(res);
          setOpen(true);
        }
      } catch {
        if (id === reqId.current) setResults([]);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 320);
    return () => clearTimeout(handle);
  }, [query, bias?.lat, bias?.lng, lang]);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  function choose(result: GeoSearchResult) {
    onPick(result);
    setQuery(result.name);
    setResults([]);
    setOpen(false);
  }

  return (
    <div ref={boxRef} className={`relative ${className ?? ""}`}>
      <div
        className={`flex items-center gap-2 rounded-xl border border-input bg-background/80 px-3 ${inputClassName}`}
      >
        {loading ? (
          <Loader2 size={15} className="shrink-0 animate-spin text-muted-foreground" aria-hidden />
        ) : (
          <Search size={15} className="shrink-0 text-muted-foreground" aria-hidden />
        )}
        <input
          value={query}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus={autoFocus}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder ?? t("searchMapPlaces")}
          aria-label={placeholder ?? t("searchMapPlaces")}
          className="w-full bg-transparent text-start text-sm outline-none placeholder:text-muted-foreground"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setResults([]);
              setOpen(false);
            }}
            aria-label={t("close")}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && query.trim().length >= 2 && (results.length > 0 || !loading) && (
        <ul
          className="glass absolute inset-x-0 top-full z-30 mt-1.5 max-h-64 overflow-y-auto rounded-2xl p-1.5 shadow-lg"
          role="listbox"
        >
          {results.length === 0 ? (
            <li className="px-3 py-3 text-center text-sm text-muted-foreground">
              {t("noMapResults")}
            </li>
          ) : (
            results.map((result, i) => (
              <li key={`${result.lat},${result.lng},${i}`}>
                <button
                  type="button"
                  onClick={() => choose(result)}
                  className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-start transition-colors hover:bg-secondary"
                >
                  <MapPin size={15} className="shrink-0 text-primary" aria-hidden />
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
            ))
          )}
        </ul>
      )}
    </div>
  );
}
