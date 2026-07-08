"use client";

import { MapPin } from "lucide-react";
import { useEffect, useRef } from "react";
import Map, {
  GeolocateControl,
  Marker,
  NavigationControl,
  type MapRef,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

import { DEFAULT_ZOOM, GEO_OPTIONS, JORDAN_CENTER, maplibreStyle } from "./scene";

/** Small map where tapping sets a coordinate. Used by the location picker. */
export default function LocationPickerMap({
  value,
  onChange,
  theme = "dark",
}: {
  value: { lat: number; lng: number } | null;
  onChange: (lat: number, lng: number) => void;
  theme?: "dark" | "light";
}) {
  const mapRef = useRef<MapRef>(null);

  useEffect(() => {
    const resize = () => mapRef.current?.resize();
    const t = [120, 400].map((ms) => setTimeout(resize, ms));
    return () => t.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (value && mapRef.current) {
      mapRef.current.easeTo({ center: [value.lng, value.lat], duration: 500 });
    }
  }, [value]);

  return (
    <Map
      ref={mapRef}
      initialViewState={{
        latitude: value?.lat ?? JORDAN_CENTER.lat,
        longitude: value?.lng ?? JORDAN_CENTER.lng,
        zoom: value ? 13 : DEFAULT_ZOOM,
      }}
      mapStyle={maplibreStyle(theme, "standard")}
      style={{ width: "100%", height: "100%" }}
      onClick={(e) => onChange(e.lngLat.lat, e.lngLat.lng)}
      onLoad={() => mapRef.current?.resize()}
      attributionControl={{ compact: true }}
      cursor="crosshair"
    >
      <NavigationControl position="bottom-left" showCompass={false} />
      <GeolocateControl position="bottom-left" positionOptions={GEO_OPTIONS} />
      {value && (
        <Marker latitude={value.lat} longitude={value.lng} anchor="bottom">
          <MapPin
            size={34}
            className="fill-[var(--primary)] text-[var(--primary-foreground)] drop-shadow-lg"
            aria-hidden
          />
        </Marker>
      )}
    </Map>
  );
}
