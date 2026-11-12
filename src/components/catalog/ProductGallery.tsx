"use client";

import Image from "next/image";
import { useState } from "react";
import type { PublicImage } from "@/server/services/types";

/** Large photo with clickable thumbnails. */
export function ProductGallery({ images, sold }: { images: PublicImage[]; sold: boolean }) {
  const [index, setIndex] = useState(0);
  const current = images[index];

  if (!current) {
    return (
      <div className="flex aspect-[4/5] items-center justify-center rounded-sm bg-sand text-sm text-muted">
        No photos yet
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row-reverse">
      <div className="relative aspect-[4/5] flex-1 overflow-hidden rounded-sm bg-sand">
        <Image
          key={current.url}
          src={current.url}
          alt={current.alt}
          fill
          loading="eager"
          fetchPriority="high"
          sizes="(min-width: 1024px) 45vw, 100vw"
          className={`object-cover ${sold ? "opacity-70 grayscale-[35%]" : ""}`}
          data-testid="gallery-main"
        />
      </div>
      {images.length > 1 && (
        <ul className="flex gap-3 sm:w-20 sm:flex-col" aria-label="Product photos">
          {images.map((img, i) => (
            <li key={img.url} className="w-16 sm:w-full">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show photo ${i + 1} of ${images.length}`}
                aria-current={i === index}
                className={`relative block aspect-[4/5] w-full overflow-hidden rounded-sm bg-sand ring-offset-2 ring-offset-canvas ${i === index ? "ring-2 ring-accent" : "opacity-70 hover:opacity-100"}`}
              >
                <Image src={img.url} alt="" fill sizes="80px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
