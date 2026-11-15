"use client";

import { useState } from "react";

type Photo = { url: string };

interface Props {
  code: string;
  title: string;
  text: string;
  photos: Photo[];
}

/** Facebook and Instagram accept at most ten photos per listing. */
const MAX_SHARED_PHOTOS = 10;

const buttonClass =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-accent px-5 text-sm font-medium hover:bg-accent hover:text-white disabled:opacity-50";

/** Our photos are stored as WebP, which Facebook and Instagram often refuse, so they are handed over as JPEG. */
async function asJpeg(url: string, name: string): Promise<File> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("photo");
  const bitmap = await createImageBitmap(await response.blob());
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("photo");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  if (!blob) throw new Error("photo");
  return new File([blob], name, { type: "image/jpeg" });
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Helps the owner list an item elsewhere (Facebook Marketplace, Instagram,
 * a message): the words are written from the item, and the photos are handed
 * to the phone's share menu or downloaded. Nothing is posted by the site
 * itself; the owner posts it in the other app.
 */
export function SharePanel({ code, title, text, photos }: Props) {
  const [words, setWords] = useState(text);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const shared = photos.slice(0, MAX_SHARED_PHOTOS);
  const fileName = (index: number) => `${code.toLowerCase()}-${index + 1}.jpg`;

  async function share() {
    if (typeof navigator.share !== "function") {
      setMessage("This browser cannot open a share menu. Use “Copy the words” and “Download photos” instead.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      // Some apps keep the photos but drop the words, so the words are also copied, ready to paste.
      const copied = await copy(words);
      let files: File[] = [];
      try {
        files = await Promise.all(shared.map((photo, index) => asJpeg(photo.url, fileName(index))));
      } catch {
        files = [];
      }
      const withFiles = files.length > 0 && navigator.canShare?.({ files });
      await navigator.share(withFiles ? { files, text: words, title } : { text: words, title });
      setMessage(copied ? "The words were also copied. If the app left them out, press and hold in its text box and choose Paste." : "");
    } catch (error) {
      // Closing the share menu without choosing an app is not a problem.
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setMessage("Sharing did not work here. Use “Copy the words” and “Download photos” instead.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function copyWords() {
    setMessage((await copy(words)) ? "Copied. Paste it into your listing." : "Could not copy. Select the words above and copy them by hand.");
  }

  async function download() {
    setBusy(true);
    setMessage("");
    try {
      for (const [index, photo] of shared.entries()) {
        const file = await asJpeg(photo.url, fileName(index));
        const link = document.createElement("a");
        link.href = URL.createObjectURL(file);
        link.download = file.name;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
      }
      setMessage(`${shared.length} photo${shared.length === 1 ? "" : "s"} saved to your downloads.`);
    } catch {
      setMessage("The photos could not be prepared. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-testid="share-panel">
      <p className="text-sm text-muted">
        List this item on Facebook Marketplace, Instagram or in a message. You post it yourself in that app; the website only gets it ready.
      </p>
      <label htmlFor="share-words" className="mt-4 block text-sm font-medium">
        The words (you can change them here before sharing)
      </label>
      <textarea
        id="share-words"
        value={words}
        onChange={(event) => setWords(event.target.value)}
        rows={9}
        className="mt-1.5 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={`${buttonClass} bg-accent text-white`} onClick={share} disabled={busy}>
          {busy ? "Getting ready…" : "Share…"}
        </button>
        <button type="button" className={buttonClass} onClick={copyWords} disabled={busy}>
          Copy the words
        </button>
        {shared.length > 0 && (
          <button type="button" className={buttonClass} onClick={download} disabled={busy}>
            Download photos
          </button>
        )}
      </div>
      {photos.length > MAX_SHARED_PHOTOS && (
        <p className="mt-2 text-xs text-muted">Only the first {MAX_SHARED_PHOTOS} photos are shared, the most those apps accept.</p>
      )}
      <p className="mt-3 min-h-5 text-sm" role="status" data-testid="share-message">
        {message}
      </p>
    </div>
  );
}
