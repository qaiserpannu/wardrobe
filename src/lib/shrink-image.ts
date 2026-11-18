/**
 * Makes a photo small enough to upload before it leaves the browser (D49).
 * The host refuses any request over 4.5 MB, and phone photos are often larger.
 * The server still checks and re-encodes whatever arrives; this only saves
 * the trip. Browser only. If anything goes wrong the original is returned
 * and the server decides.
 */

/** Comfortably under the host's 4.5 MB request limit, leaving room for the form wrapping. */
export const UPLOAD_TARGET_BYTES = 3.5 * 1024 * 1024;
const LONGEST_SIDE = 2400;

const toBlob = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));

export async function shrinkForUpload(file: File): Promise<File> {
  if (file.size <= UPLOAD_TARGET_BYTES) return file;
  try {
    // Respects the photo's rotation, so upright photos stay upright.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    let scale = Math.min(1, LONGEST_SIDE / Math.max(bitmap.width, bitmap.height));
    for (let attempt = 0; attempt < 6; attempt++) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) return file;
      context.fillStyle = "#ffffff"; // JPEG has no see-through areas
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await toBlob(canvas, attempt < 2 ? 0.9 : 0.8);
      if (blob && blob.size <= UPLOAD_TARGET_BYTES) {
        bitmap.close();
        return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
      }
      scale *= 0.8;
    }
    bitmap.close();
  } catch {
    // fall through
  }
  return file;
}
