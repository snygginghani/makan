"use client";

import { X } from "lucide-react";
import { useState } from "react";

import { mediaUrl } from "@/lib/api";
import { useLang } from "@/lib/i18n";

/** Photo grid with a simple full-screen lightbox. */
export function PlaceGallery({ images, name }: { images: string[]; name: string }) {
  const { t } = useLang();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const photoAlt = (i: number) => `${t("photoOf", { name })} ${i + 1}`;

  return (
    <>
      <div
        className={`grid gap-2 ${
          images.length === 1 ? "grid-cols-1" : images.length === 2 ? "grid-cols-2" : "grid-cols-2 md:grid-cols-3"
        }`}
      >
        {images.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => setOpenIndex(i)}
            className="group overflow-hidden rounded-xl border border-border focus-visible:outline-2 focus-visible:outline-[var(--ring)]"
            aria-label={photoAlt(i)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mediaUrl(url)}
              alt={photoAlt(i)}
              loading={i < 3 ? "eager" : "lazy"}
              className="aspect-[4/3] w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
            />
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("photoOf", { name })}
          className="fixed inset-0 z-[100] grid place-items-center bg-black/85 p-4"
          onClick={() => setOpenIndex(null)}
        >
          <button
            type="button"
            onClick={() => setOpenIndex(null)}
            aria-label={t("close")}
            className="absolute top-4 left-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X size={20} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaUrl(images[openIndex])}
            alt={photoAlt(openIndex)}
            className="max-h-[85dvh] max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
