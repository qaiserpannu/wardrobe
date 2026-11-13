import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { MAX_PHOTO_BYTES } from "@/lib/product-form";
import { getAdmin } from "@/server/auth/session";
import { PhotoError } from "@/server/images/process";
import { setHeroImage } from "@/server/services/admin-settings";
import { CACHE_TAGS } from "@/server/services/cached";

/** Upload of the large homepage picture. Signed-in administrators only. */

const json = (body: Record<string, unknown>, status: number) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  const admin = await getAdmin();
  if (!admin) return json({ error: "Please sign in again." }, 401);
  const origin = request.headers.get("origin");
  if (!origin || !URL.canParse(origin) || new URL(origin).host !== request.headers.get("host")) return json({ error: "Not allowed." }, 403);

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (!declared || declared > MAX_PHOTO_BYTES + 100_000) return json({ error: "The picture is larger than 15 MB." }, 413);
  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return json({ error: "The upload could not be read." }, 400);
  }
  if (!(file instanceof File)) return json({ error: "No picture was sent." }, 400);

  try {
    await setHeroImage(admin, Buffer.from(await file.arrayBuffer()));
  } catch (error) {
    if (error instanceof PhotoError) return json({ error: error.message }, 400);
    console.error("Homepage picture upload failed", error);
    return json({ error: "The picture could not be saved. Please try again." }, 500);
  }
  revalidateTag(CACHE_TAGS.settings, { expire: 0 });
  return json({ ok: true }, 201);
}
