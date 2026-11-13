import "server-only";
import { createHash } from "node:crypto";
import sharp, { type Metadata } from "sharp";
import { MAX_PHOTO_BYTES } from "@/lib/product-form";

/**
 * Checks and prepares an uploaded product photo.
 *
 * The file's real contents decide whether it is accepted, not its name or the
 * type the browser claims. Every accepted photo is re-encoded, which also
 * removes hidden information such as the GPS location a phone adds.
 */

const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp", "heif"]);
const MAX_PIXELS = 60_000_000;
const MIN_SIDE = 400;
const MAX_WIDTH = 2000;
const MAX_HEIGHT = 2500;

export class PhotoError extends Error {}

export type ProcessedPhoto = { data: Buffer; width: number; height: number; fingerprint: string };

export async function processProductPhoto(input: Buffer): Promise<ProcessedPhoto> {
  if (input.length === 0) throw new PhotoError("The file is empty.");
  if (input.length > MAX_PHOTO_BYTES) throw new PhotoError("The photo is larger than 15 MB. Please choose a smaller one.");

  let meta: Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: MAX_PIXELS, failOn: "error" }).metadata();
  } catch {
    throw new PhotoError("This file is not a photo we can read. Please use a JPEG, PNG or WebP picture.");
  }
  if (!meta.format || !ALLOWED_FORMATS.has(meta.format) || (meta.pages ?? 1) > 1) {
    throw new PhotoError("Please use a JPEG, PNG or WebP picture.");
  }

  try {
    const { data, info } = await sharp(input, { limitInputPixels: MAX_PIXELS, failOn: "error" })
      .rotate() // turn the picture the right way up, as the phone recorded it
      .resize({ width: MAX_WIDTH, height: MAX_HEIGHT, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84 })
      .toBuffer({ resolveWithObject: true });
    if (Math.min(info.width, info.height) < MIN_SIDE) {
      throw new PhotoError(`The photo is too small. It needs to be at least ${MIN_SIDE} pixels on each side.`);
    }
    return {
      data,
      width: info.width,
      height: info.height,
      fingerprint: createHash("sha256").update(data).digest("hex").slice(0, 16),
    };
  } catch (error) {
    if (error instanceof PhotoError) throw error;
    throw new PhotoError("This photo could not be read. It may be damaged; please try another.");
  }
}
