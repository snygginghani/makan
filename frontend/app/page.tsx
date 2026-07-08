"use client";

import { MessageCircle, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AIChat } from "@/components/chat/ai-chat";
import { FiltersBar } from "@/components/map/filters-bar";
import { MakanMap } from "@/components/map/makan-map";
import { PlaceSearch } from "@/components/map/place-search";
import { GEO_OPTIONS } from "@/components/map/scene";
import { TopNav } from "@/components/layout/nav";
import { PlaceCard } from "@/components/place/place-card";
import { Button } from "@/components/ui/button";
import { api, getToken } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import type { AIPlaceRef, AIQueryOut, Place } from "@/lib/types";
import { useTheme } from "@/lib/use-theme";

type FlyTo = { lat: number; lng: number; zoom?: number; key: number };

export default function MapPage() {
  const { theme } = useTheme();
  const { t } = useLang();
  const [places, setPlaces] = useState<Place[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [satellite, setSatellite] = useState(false);
  const [highlightIds, setHighlightIds] = useState<number[]>([]);
  const [selected, setSelected] = useState<Place | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [flyTo, setFlyTo] = useState<FlyTo | null>(null);
  const flyKey = useRef(0);
  const askedLocation = useRef(false);

  const fly = useCallback((lat: number, lng: number, zoom = 12) => {
    flyKey.current += 1;
    setFlyTo({ lat, lng, zoom, key: flyKey.current });
  }, []);

  useEffect(() => {
    api
      .listPlaces({ page_size: 200 })
      .then((page) => setPlaces(page.items))
      .catch(() => toast.error(t("loadPlacesError")));
    try {
      setSatellite(localStorage.getItem("makan_basemap") === "satellite");
    } catch {
      /* private mode */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleSatellite = useCallback(() => {
    setSatellite((current) => {
      const next = !current;
      try {
        localStorage.setItem("makan_basemap", next ? "satellite" : "standard");
      } catch {
        /* private mode */
      }
      return next;
    });
  }, []);

  const requestLocation = useCallback(
    (silent = false) => {
      askedLocation.current = true;
      if (!navigator.geolocation) {
        if (!silent) toast.error(t("geoUnsupported"));
        return;
      }
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
          setUserLocation(loc);
          setLocating(false);
          fly(loc.lat, loc.lng, 13);
          // Share with the server so an admin can see where signed-in users are.
          if (getToken()) api.reportLocation(loc.lat, loc.lng).catch(() => {});
          if (!silent) toast.success(t("geoSuccess", { m: Math.round(position.coords.accuracy) }));
        },
        (error) => {
          setLocating(false);
          if (!silent) {
            toast.error(
              error.code === error.PERMISSION_DENIED ? t("geoDenied") : t("geoFailed"),
            );
          }
        },
        GEO_OPTIONS,
      );
    },
    [t, fly],
  );

  // Chatbot is location-first: try to get the user's position the first time
  // the chat opens so "nearest to me" answers work without an extra tap.
  useEffect(() => {
    if (chatOpen && !userLocation && !askedLocation.current) {
      requestLocation(true);
    }
  }, [chatOpen, userLocation, requestLocation]);

  const visiblePlaces = useMemo(
    () => (category ? places.filter((p) => p.category === category) : places),
    [places, category],
  );

  const railPlaces = useMemo(() => {
    if (highlightIds.length > 0) {
      const byId = new Map(places.map((p) => [p.id, p]));
      return highlightIds.map((id) => byId.get(id)).filter((p): p is Place => Boolean(p));
    }
    return [...visiblePlaces].sort((a, b) => b.rating - a.rating).slice(0, 12);
  }, [highlightIds, places, visiblePlaces]);

  const selectPlace = useCallback(
    (place: Place | null) => {
      setSelected(place);
      if (place?.lat != null && place.lng != null) fly(place.lat, place.lng, 13);
    },
    [fly],
  );

  const handleAIResult = useCallback(
    (result: AIQueryOut) => {
      setHighlightIds(result.map_highlight_ids);
      const first = result.places.find((p) => p.lat != null && p.lng != null);
      if (first) fly(first.lat!, first.lng!, 11);
    },
    [fly],
  );

  const handlePickPlace = useCallback(
    (ref: AIPlaceRef) => {
      const place = places.find((p) => p.id === ref.id);
      if (place) selectPlace(place);
      else if (ref.lat != null && ref.lng != null) fly(ref.lat, ref.lng, 13);
    },
    [places, selectPlace, fly],
  );

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <div className="absolute inset-0">
        <MakanMap
          places={visiblePlaces}
          highlightIds={highlightIds}
          selectedId={selected?.id ?? null}
          onSelect={setSelected}
          userLocation={userLocation}
          flyTo={flyTo}
          theme={theme}
          basemap={satellite ? "satellite" : "standard"}
        />
      </div>

      <TopNav floating />
      <PlaceSearch
        places={places}
        onSelect={selectPlace}
        bias={userLocation}
        onGeoSelect={(r) => {
          setSelected(null);
          fly(r.lat, r.lng, 15);
        }}
      />
      <FiltersBar
        active={category}
        onChange={(slug) => {
          setCategory(slug);
          setHighlightIds([]);
        }}
        satellite={satellite}
        onToggleSatellite={toggleSatellite}
      />

      <AIChat
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        category={category}
        userLocation={userLocation}
        locating={locating}
        onRequestLocation={() => requestLocation(false)}
        onResult={handleAIResult}
        onPickPlace={handlePickPlace}
      />

      {!chatOpen && (
        <Button
          onClick={() => setChatOpen(true)}
          aria-label={t("askAboutPlace")}
          className="absolute bottom-24 end-4 z-30 h-12 gap-2 rounded-full px-5 shadow-lg md:bottom-6"
        >
          <MessageCircle size={18} aria-hidden />
          {t("askAboutPlace")}
        </Button>
      )}

      {/* place cards rail (with clear-results chip when AI has highlighted) */}
      <div
        className={`pointer-events-none absolute bottom-4 z-10 flex flex-col gap-2 ${
          chatOpen ? "max-md:hidden md:end-4 md:start-[420px]" : "end-4 start-4"
        }`}
      >
        {highlightIds.length > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setHighlightIds([])}
            className="pointer-events-auto glass w-fit rounded-full"
          >
            <X size={14} aria-hidden />
            {t("clearResults")}
          </Button>
        )}
        <div
          aria-label={t("suggestedPlaces")}
          className="pointer-events-auto flex gap-3 overflow-x-auto pb-1 [scrollbar-width:thin]"
        >
          {railPlaces.map((place) => (
            <PlaceCard
              key={place.id}
              place={place}
              active={highlightIds.includes(place.id) || selected?.id === place.id}
              onHover={() => setSelected(place)}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
