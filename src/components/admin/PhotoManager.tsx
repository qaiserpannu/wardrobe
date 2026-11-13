"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { removePhotoAction, reorderPhotosAction } from "@/app/admin/(portal)/products/actions";
import { MAX_PHOTO_BYTES, MAX_PHOTOS } from "@/lib/product-form";

type Photo = { id: string; url: string; width: number; height: number };

const smallButton =
  "inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-line bg-white px-2 text-sm hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink";

/** Upload, arrange and remove an item's photos. The first photo is the cover. */
export function PhotoManager({ productId, productName, photos }: { productId: string; productName: string; photos: Photo[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [busy, startTransition] = useTransition();
  const full = photos.length >= MAX_PHOTOS;

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const problems: string[] = [];
    const chosen = [...files];
    for (const [index, file] of chosen.entries()) {
      setUploading(`Uploading photo ${index + 1} of ${chosen.length}…`);
      if (file.size > MAX_PHOTO_BYTES) {
        problems.push(`${file.name}: larger than 15 MB.`);
        continue;
      }
      const body = new FormData();
      body.set("file", file);
      try {
        const response = await fetch(`/api/admin/products/${productId}/photos`, { method: "POST", body });
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { error?: string } | null;
          problems.push(`${file.name}: ${data?.error ?? "could not be uploaded."}`);
        }
      } catch {
        problems.push(`${file.name}: could not be uploaded. Check your connection.`);
      }
    }
    setUploading(null);
    setMessages(problems);
    if (input.current) input.current.value = "";
    router.refresh();
  }

  function run(task: () => Promise<{ error?: string }>) {
    startTransition(async () => {
      const result = await task();
      setMessages(result.error ? [result.error] : []);
    });
  }

  function move(index: number, by: -1 | 1) {
    const ids = photos.map((p) => p.id);
    const target = index + by;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    run(() => reorderPhotosAction(productId, ids));
  }

  return (
    <div data-testid="photo-manager">
      {photos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-white p-6 text-center text-sm text-muted">
          No photos yet. An item needs at least one photo before it can be published.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4" data-testid="photo-list">
          {photos.map((photo, index) => (
            <li key={photo.id} className="overflow-hidden rounded-lg border border-line bg-white" data-testid="photo">
              <div className="relative aspect-[4/5] bg-sand">
                <Image
                  src={photo.url}
                  alt={`${productName}, photo ${index + 1}`}
                  fill
                  sizes="(min-width: 1280px) 15vw, (min-width: 640px) 25vw, 45vw"
                  className="object-cover"
                />
                {index === 0 && (
                  <span className="absolute top-2 left-2 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-white">Cover</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-1 p-2">
                <div className="flex gap-1">
                  <button type="button" className={smallButton} disabled={busy || index === 0} onClick={() => move(index, -1)} aria-label={`Move photo ${index + 1} earlier`}>
                    ←
                  </button>
                  <button
                    type="button"
                    className={smallButton}
                    disabled={busy || index === photos.length - 1}
                    onClick={() => move(index, 1)}
                    aria-label={`Move photo ${index + 1} later`}
                  >
                    →
                  </button>
                </div>
                <button
                  type="button"
                  className={smallButton}
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm("Remove this photo?")) run(() => removePhotoAction(productId, photo.id));
                  }}
                  aria-label={`Remove photo ${index + 1}`}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        <label
          className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border border-accent px-6 text-sm font-medium text-accent hover:bg-accent hover:text-white ${
            full || uploading ? "pointer-events-none opacity-50" : ""
          }`}
        >
          {uploading ?? "Add photos"}
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            disabled={full || uploading !== null}
            onChange={(event) => upload(event.target.files)}
            data-testid="photo-input"
          />
        </label>
        <p className="mt-2 text-sm text-muted">
          JPEG, PNG or WebP, up to 15 MB each, up to {MAX_PHOTOS} photos. Upright photos (taller than wide) look best. Location and other
          hidden details are removed from every photo.
        </p>
      </div>

      {messages.length > 0 && (
        <ul role="alert" className="mt-3 space-y-1 text-sm text-accent" data-testid="photo-errors">
          {messages.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
