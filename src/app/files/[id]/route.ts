import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assets } from "@/db/schema";
import { canViewAsset, getFileViewer } from "@/lib/file-access";
import { isImage, readStoredFile } from "@/lib/files";

/** Serves an uploaded file to people allowed to see it. ?download=1 forces a download. */
export async function GET(request: Request, { params }: RouteContext<"/files/[id]">) {
  const viewer = await getFileViewer();
  if (!viewer) return new Response("Not logged in", { status: 401 });

  const { id } = await params;
  const [asset] = await db.select().from(assets).where(eq(assets.id, id));
  if (!asset || !canViewAsset(viewer, asset)) return new Response("Not found", { status: 404 });

  let bytes: Buffer;
  try {
    bytes = await readStoredFile(asset.storedName);
  } catch {
    return new Response("File is missing from storage", { status: 404 });
  }

  const download = new URL(request.url).searchParams.get("download") === "1";
  // Only images and PDFs are shown inline; everything else downloads, so nothing uploaded can run in the page.
  const inline = !download && (isImage(asset.mime) || asset.mime === "application/pdf");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": inline ? asset.mime : "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(asset.filename)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=300",
    },
  });
}
