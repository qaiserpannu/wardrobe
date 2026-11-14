import { getStorage } from "@/server/storage";

/**
 * Serves stored photos, from the local folder in development or from cloud
 * storage when the site is hosted. File names contain a fingerprint of their
 * contents, so browsers and the hosting network may keep them indefinitely.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  let file;
  try {
    file = await getStorage().read(path.join("/"));
  } catch (error) {
    console.error("Could not read a stored photo", error);
    return new Response("Temporarily unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
