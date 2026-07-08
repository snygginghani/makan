"use client";

import { useMemo, useState } from "react";

import { MakanMap } from "@/components/map/makan-map";
import { useLang } from "@/lib/i18n";
import type { Place, PlaceDetail } from "@/lib/types";
import { useTheme } from "@/lib/use-theme";

/** Small non-roaming map showing a single place on its detail page. */
export function PlaceMiniMap({ place }: { place: PlaceDetail }) {
  const { theme } = useTheme();
  const { t } = useLang();
  const [flyTo] = useState(null);
  const places = useMemo(() => [place as Place], [place]);
  const initialView =
    place.lat != null && place.lng != null
      ? { lat: place.lat, lng: place.lng, zoom: 11 }
      : undefined;

  if (place.lat == null || place.lng == null) {
    return (
      <div className="grid h-64 place-items-center bg-secondary text-sm text-muted-foreground">
        {t("noCoords")}
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <MakanMap
        places={places}
        highlightIds={[place.id]}
        selectedId={place.id}
        onSelect={() => {}}
        userLocation={null}
        flyTo={flyTo}
        initialView={initialView}
        theme={theme}
      />
    </div>
  );
}
