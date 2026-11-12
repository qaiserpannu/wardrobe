import { readLocalFile } from "@/server/storage/local";

/**
 * Serves images saved by the local storage driver (development and tests).
 * In production, images come straight from cloud storage instead.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const file = await readLocalFile(path.join("/"));
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
