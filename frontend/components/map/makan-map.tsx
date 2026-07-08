"use client";

import dynamic from "next/dynamic";

import { HAS_MAPBOX, type MapSceneProps } from "./scene";

const MapLibreScene = dynamic(() => import("./map-maplibre"), { ssr: false });
const MapboxScene = dynamic(() => import("./map-mapbox"), { ssr: false });

/** Renders Mapbox GL when NEXT_PUBLIC_MAPBOX_TOKEN is set,
 *  otherwise keyless MapLibre (OpenFreeMap/Carto/Esri styles). */
export function MakanMap(props: MapSceneProps) {
  return HAS_MAPBOX ? <MapboxScene {...props} /> : <MapLibreScene {...props} />;
}
