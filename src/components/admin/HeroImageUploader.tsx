"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

/** Shows the large homepage picture and lets the owner replace it. */
export function HeroImageUploader({ currentUrl }: { currentUrl: string | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    const body = new FormData();
    body.set("file", file);
    try {
      const response = await fetch("/api/admin/settings/hero-image", { method: "POST", body });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(response.ok ? { text: "Picture replaced. The website is updated.", ok: true } : { text: data?.error ?? "The picture could not be uploaded.", ok: false });
    } catch {
      setMessage({ text: "The picture could not be uploaded. Check your connection.", ok: false });
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-start gap-5" data-testid="hero-uploader">
      <div className="relative aspect-[4/5] w-32 shrink-0 overflow-hidden rounded-lg border border-line bg-sand">
        {currentUrl ? (
          <Image src={currentUrl} alt="Current homepage picture" fill sizes="128px" className="object-cover" data-testid="hero-current" />
        ) : (
          <span className="flex h-full items-center justify-center p-2 text-center text-xs text-muted">No picture</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <label
          className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border border-accent px-6 text-sm font-medium text-accent hover:bg-accent hover:text-white ${
            busy ? "pointer-events-none opacity-50" : ""
          }`}
        >
          {busy ? "Uploading…" : "Replace picture"}
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={busy}
            onChange={(event) => upload(event.target.files?.[0])}
            data-testid="hero-input"
          />
        </label>
        <p className="mt-2 text-sm text-muted">JPEG, PNG or WebP, up to 15 MB. An upright picture (taller than wide) fits best.</p>
        {message && (
          <p role="status" className={`mt-2 text-sm ${message.ok ? "text-whatsapp-dark" : "text-accent"}`} data-testid="hero-message">
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}
