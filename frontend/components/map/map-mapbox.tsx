"use client";

import mapboxgl from "mapbox-gl";
import { useEffect, useRef } from "react";
import Map, {
  GeolocateControl,
  Marker,
  NavigationControl,
  Popup,
  type MapRef,
} from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

import { PlacePin } from "./pin";
import { PlacePopupCard } from "./place-popup";
import {
  DEFAULT_ZOOM,
  GEO_OPTIONS,
  JORDAN_CENTER,
  MAPBOX_TOKEN,
  RTL_TEXT_PLUGIN_URL,
  mapboxStyle,
  type MapSceneProps,
} from "./scene";

// Arabic labels render reversed/disconnected without the RTL text plugin.
if (
  typeof window !== "undefined" &&
  mapboxgl.getRTLTextPluginStatus() === "unavailable"
) {
  mapboxgl.setRTLTextPlugin(RTL_TEXT_PLUGIN_URL, () => {}, true);
}

export default function MapboxScene({
  places,
  highlightIds,
  selectedId,
  onSelect,
  userLocation,
  flyTo,
  initialView,
  theme = "dark",
  basemap = "standard",
}: MapSceneProps) {
  const mapRef = useRef<MapRef>(null);
  const selectedPlace =
    selectedId != null ? places.find((p) => p.id === selectedId) : undefined;

  // Keep the WebGL canvas matched to its container (see maplibre scene note).
  useEffect(() => {
    const resize = () => mapRef.current?.resize();
    const el = mapRef.current?.getMap().getContainer();
    const ro = el ? new ResizeObserver(resize) : null;
    if (el && ro) ro.observe(el);
    const timers = [100, 400, 1000].map((ms) => setTimeout(resize, ms));
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);
    return () => {
      ro?.disconnect();
      timers.forEach(clearTimeout);
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
    };
  }, []);

  useEffect(() => {
    if (flyTo && mapRef.current) {
      mapRef.current.flyTo({
        center: [flyTo.lng, flyTo.lat],
        zoom: flyTo.zoom ?? 12,
        duration: 1200,
        essential: true,
      });
    }
  }, [flyTo]);

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={MAPBOX_TOKEN}
      initialViewState={{
        latitude: initialView?.lat ?? JORDAN_CENTER.lat,
        longitude: initialView?.lng ?? JORDAN_CENTER.lng,
        zoom: initialView?.zoom ?? DEFAULT_ZOOM,
      }}
      mapStyle={mapboxStyle(theme, basemap)}
      style={{ width: "100%", height: "100%" }}
      onClick={() => onSelect(null)}
      onLoad={() => mapRef.current?.resize()}
    >
      <NavigationControl position="bottom-left" showCompass={false} />
      <GeolocateControl
        position="bottom-left"
        positionOptions={GEO_OPTIONS}
        trackUserLocation
      />
      {userLocation && (
        <Marker latitude={userLocation.lat} longitude={userLocation.lng}>
          <span
            aria-label="موقعك"
            className="block h-4 w-4 rounded-full border-2 border-white bg-[#2DD4BF] shadow-[0_0_12px_#2DD4BF]"
          />
        </Marker>
      )}
      {places.map(
        (place) =>
          place.lat != null &&
          place.lng != null && (
            <Marker
              key={place.id}
              latitude={place.lat}
              longitude={place.lng}
              anchor="center"
            >
              <PlacePin
                place={place}
                highlighted={highlightIds.includes(place.id)}
                selected={selectedId === place.id}
                onClick={() => onSelect(place)}
              />
            </Marker>
          ),
      )}
      {selectedPlace && selectedPlace.lat != null && selectedPlace.lng != null && (
        <Popup
          latitude={selectedPlace.lat}
          longitude={selectedPlace.lng}
          anchor="bottom"
          offset={26}
          closeButton={false}
          closeOnClick={false}
          maxWidth="304px"
          className="makan-popup"
          onClose={() => onSelect(null)}
        >
          <PlacePopupCard place={selectedPlace} onClose={() => onSelect(null)} />
        </Popup>
      )}
    </Map>
  );
}
