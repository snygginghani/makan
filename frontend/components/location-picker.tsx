"use client";

import { Check, Link2, LocateFixed, Loader2, MapPin, MapPinned, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { toast } from "sonner";

import { MapSearchBox } from "@/components/map/map-search-box";
import { GEO_OPTIONS } from "@/components/map/scene";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { useTheme } from "@/lib/use-theme";

const PickerMap = dynamic(() => import("@/components/map/location-picker-map"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center bg-secondary">
      <Loader2 className="animate-spin text-muted-foreground" size={20} aria-hidden />
    </div>
  ),
});

/** Two ways to set a place location: tap a map, or paste a Google Maps link.
 *  Client-side regex covers full URLs; short links resolve via the backend. */
export function LocationPicker({
  lat,
  lng,
  onChange,
}: {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number | null, lng: number | null) => void;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const [mode, setMode] = useState<"map" | "link">("map");
  const [link, setLink] = useState("");
  const [resolving, setResolving] = useState(false);
  const [locating, setLocating] = useState(false);

  const value = lat != null && lng != null ? { lat, lng } : null;

  function useMyLocation() {
    if (!navigator.geolocation) {
      toast.error(t("geoUnsupported"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange(pos.coords.latitude, pos.coords.longitude);
        setLocating(false);
        toast.success(t("locationSet"));
      },
      (err) => {
        setLocating(false);
        toast.error(err.code === err.PERMISSION_DENIED ? t("geoDenied") : t("geoFailed"));
      },
      GEO_OPTIONS,
    );
  }

  function tryLocalParse(url: string): { lat: number; lng: number } | null {
    const decoded = decodeURIComponent(url);
    const patterns = [
      /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/,
      /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/,
      /[?&](?:q|query|ll|center|destination)=(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/,
    ];
    for (const p of patterns) {
      const m = decoded.match(p);
      if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
    }
    return null;
  }

  async function resolveLink() {
    const url = link.trim();
    if (!url) return;
    const local = tryLocalParse(url);
    if (local) {
      onChange(local.lat, local.lng);
      toast.success(t("locationSet"));
      return;
    }
    setResolving(true);
    try {
      const { lat: rlat, lng: rlng } = await api.resolveGeoLink(url);
      onChange(rlat, rlng);
      toast.success(t("locationSet"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("linkResolveFailed"));
    } finally {
      setResolving(false);
    }
  }

  return (
    <div className="space-y-2.5">
      {/* mode toggle */}
      <div className="flex rounded-xl bg-secondary/60 p-1">
        {(["map", "link"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors ${
              mode === m ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {m === "map" ? <MapPinned size={15} aria-hidden /> : <Link2 size={15} aria-hidden />}
            {m === "map" ? t("pickOnMap") : t("pasteGoogleLink")}
          </button>
        ))}
      </div>

      {mode === "map" ? (
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <MapSearchBox
              className="flex-1"
              inputClassName="h-11"
              bias={value}
              placeholder={t("searchAddressOrPlace")}
              onPick={(r) => {
                onChange(r.lat, r.lng);
                toast.success(t("locationSet"));
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={useMyLocation}
              disabled={locating}
              aria-label={t("useMyLocation")}
              title={t("useMyLocation")}
              className="h-11 shrink-0 rounded-xl px-3"
            >
              {locating ? (
                <Loader2 size={16} className="animate-spin" aria-hidden />
              ) : (
                <LocateFixed size={16} aria-hidden />
              )}
            </Button>
          </div>
          <div className="h-56 overflow-hidden rounded-xl border border-border">
            <PickerMap value={value} onChange={(la, ln) => onChange(la, ln)} theme={theme} />
          </div>
          <p className="text-xs text-muted-foreground">{t("tapMapToSet")}</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <Input
              dir="ltr"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  resolveLink();
                }
              }}
              placeholder={t("googleLinkPlaceholder")}
              className="h-11"
              inputMode="url"
            />
            <Button
              type="button"
              onClick={resolveLink}
              disabled={resolving || !link.trim()}
              className="h-11 shrink-0 rounded-xl"
            >
              {resolving ? (
                <Loader2 size={16} className="animate-spin" aria-hidden />
              ) : (
                <Check size={16} aria-hidden />
              )}
              {t("extractLocation")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("googleLinkHint")}</p>
        </div>
      )}

      {/* current coordinate readout */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2">
        {value ? (
          <span className="flex items-center gap-1.5 text-sm text-[#4ADE80]">
            <MapPin size={14} aria-hidden />
            <span dir="ltr" className="tabular-nums">
              {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
            </span>
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">{t("noLocationYet")}</span>
        )}
        {value && (
          <button
            type="button"
            onClick={() => onChange(null, null)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
          >
            <X size={13} aria-hidden />
            {t("clearLocation")}
          </button>
        )}
      </div>
    </div>
  );
}
