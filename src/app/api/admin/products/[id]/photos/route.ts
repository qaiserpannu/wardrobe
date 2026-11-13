import { NextResponse, type NextRequest } from "next/server";
import { MAX_PHOTO_BYTES } from "@/lib/product-form";
import { getAdmin } from "@/server/auth/session";
import { PhotoError } from "@/server/images/process";
import { AdminActionError, addProductPhoto } from "@/server/services/admin-products";

/**
 * Photo upload for the admin portal: one file per request. Signed-in
 * administrators only. The file's contents are checked and re-encoded by the
 * service; its name and claimed type are ignored.
 */

const json = (error: string, status: number) =>
  NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest, { params }: RouteContext<"/api/admin/products/[id]/photos">) {
  const admin = await getAdmin();
  if (!admin) return json("Please sign in again.", 401);
  if (!sameOrigin(request)) return json("Not allowed.", 403);

  // Refuse oversized uploads before reading them (a little room for the form wrapping).
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (!declared || declared > MAX_PHOTO_BYTES + 100_000) return json("The photo is larger than 15 MB. Please choose a smaller one.", 413);

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return json("The upload could not be read.", 400);
  }
  if (!(file instanceof File)) return json("No photo was sent.", 400);
  if (file.size > MAX_PHOTO_BYTES) return json("The photo is larger than 15 MB. Please choose a smaller one.", 413);

  const { id } = await params;
  try {
    const image = await addProductPhoto(admin, id, Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ image }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof PhotoError || error instanceof AdminActionError) return json(error.message, 400);
    console.error("Photo upload failed", error);
    return json("The photo could not be saved. Please try again.", 500);
  }
}
