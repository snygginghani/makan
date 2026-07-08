import type { Place } from "@/lib/types";

export type BasemapKind = "standard" | "satellite";

export interface MapSceneProps {
  places: Place[];
  highlightIds: number[];
  selectedId: number | null;
  onSelect: (place: Place | null) => void;
  userLocation: { lat: number; lng: number } | null;
  /** imperative fly-to request; change the key to retrigger */
  flyTo: { lat: number; lng: number; zoom?: number; key: number } | null;
  /** optional initial camera (defaults to Jordan overview) */
  initialView?: { lat: number; lng: number; zoom: number };
  theme?: "dark" | "light";
  basemap?: BasemapKind;
}

export const JORDAN_CENTER = { lat: 31.4, lng: 36.1 };
export const DEFAULT_ZOOM = 7;

export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
export const HAS_MAPBOX = MAPBOX_TOKEN.length > 0;

/** Correct Arabic text shaping for map labels (MapLibre/Mapbox render Arabic
 *  reversed and disconnected without this plugin). */
export const RTL_TEXT_PLUGIN_URL =
  "https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.2.3/mapbox-gl-rtl-text.min.js";

/** Satellite imagery + place-name overlay (Esri, keyless). The "nature" view —
 *  Jordan's deserts, wadis and forests in real color. */
export const ESRI_SATELLITE_STYLE = {
  version: 8 as const,
  name: "makan-satellite",
  sources: {
    imagery: {
      type: "raster" as const,
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: "Esri, Maxar, Earthstar Geographics",
    },
    labels: {
      type: "raster" as const,
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 19,
    },
  },
  layers: [
    { id: "imagery", type: "raster" as const, source: "imagery" },
    { id: "labels", type: "raster" as const, source: "labels" },
  ],
};

/** Keyless vector basemaps:
 *  - light: OpenFreeMap "Liberty" — rich, colorful city/terrain cartography
 *  - dark: Carto Dark Matter */
export const MAPLIBRE_STYLES = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  light: "https://tiles.openfreemap.org/styles/liberty",
} as const;

export const MAPBOX_STYLES = {
  dark: "mapbox://styles/mapbox/dark-v11",
  light: "mapbox://styles/mapbox/streets-v12",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
} as const;

export function maplibreStyle(theme: "dark" | "light", basemap: BasemapKind) {
  if (basemap === "satellite") return ESRI_SATELLITE_STYLE;
  return MAPLIBRE_STYLES[theme];
}

export function mapboxStyle(theme: "dark" | "light", basemap: BasemapKind): string {
  if (basemap === "satellite") return MAPBOX_STYLES.satellite;
  return MAPBOX_STYLES[theme];
}

/** Ask the browser for a real GPS fix, not the IP-based estimate. */
export const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0,
};
