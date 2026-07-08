import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PlaceDetailView } from "@/components/place/place-detail-view";
import { API_BASE } from "@/lib/api";
import type { PlaceDetail } from "@/lib/types";

async function fetchPlace(id: string): Promise<PlaceDetail | null> {
  try {
    const resp = await fetch(`${API_BASE}/places/${id}`, { cache: "no-store" });
    if (!resp.ok) return null;
    return (await resp.json()) as PlaceDetail;
  } catch {
    return null;
  }
}

export async function generateMetadata(props: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await props.params;
  const place = await fetchPlace(id);
  return { title: place ? `${place.name_ar} — مكان · Makan` : "مكان · Makan" };
}

export default async function PlacePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const place = await fetchPlace(id);
  if (!place) notFound();
  return <PlaceDetailView place={place} />;
}
