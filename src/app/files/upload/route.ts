import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ASSET_CATEGORIES, assets, clients } from "@/db/schema";
import { getFileViewer } from "@/lib/file-access";
import { checkUpload, storeFile } from "@/lib/files";

const PURPOSES = ["asset", "photo", "resume"] as const;
type Purpose = (typeof PURPOSES)[number];
const MAX_FILES = 20;

/**
 * Uploads one or more files (multipart field "files"). Uses a route handler rather than a server
 * action so files larger than 1 MB work. Clients can only upload to their own client.
 */
export async function POST(request: Request) {
  const viewer = await getFileViewer();
  if (!viewer) return Response.json({ error: "Not logged in." }, { status: 401 });

  const form = await request.formData();
  const purpose = String(form.get("purpose") ?? "asset") as Purpose;
  if (!PURPOSES.includes(purpose)) return Response.json({ error: "Unknown upload type." }, { status: 400 });

  // Staff choose the client; clients (and admins previewing as a client) always upload to their own.
  const clientId = viewer.staff && !viewer.clientId ? String(form.get("clientId") ?? "") : viewer.clientId;
  if (!clientId) return Response.json({ error: "Pick a client." }, { status: 400 });
  const [client] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, clientId));
  if (!client) return Response.json({ error: "That client doesn't exist." }, { status: 400 });

  const rawCategory = String(form.get("category") ?? (purpose === "photo" ? "photo" : "other"));
  const category = (ASSET_CATEGORIES as readonly string[]).includes(rawCategory) ? (rawCategory as (typeof ASSET_CATEGORIES)[number]) : "other";
  const note = String(form.get("note") ?? "").trim().slice(0, 1000) || null;
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return Response.json({ error: "Choose at least one file." }, { status: 400 });
  if (files.length > MAX_FILES) return Response.json({ error: `Upload at most ${MAX_FILES} files at a time.` }, { status: 400 });
  if (purpose === "photo" && files.some((f) => !f.type.startsWith("image/"))) {
    return Response.json({ error: "Photo Drop only accepts images." }, { status: 400 });
  }

  const problems = files.map(checkUpload).filter(Boolean);
  if (problems.length) return Response.json({ error: problems.join(" ") }, { status: 400 });

  const saved: { id: string; filename: string }[] = [];
  for (const file of files) {
    const storedName = await storeFile(file);
    const id = randomUUID();
    await db.insert(assets).values({
      id,
      clientId,
      purpose,
      category,
      filename: file.name.slice(0, 250),
      storedName,
      mime: file.type || "application/octet-stream",
      size: file.size,
      notes: note,
      // Resumes are private to the agency and the client; photos start in review.
      clientVisible: true,
      photoStatus: purpose === "photo" ? "needs_review" : null,
      uploadedById: viewer.userId,
      createdAt: new Date().toISOString(),
    });
    saved.push({ id, filename: file.name });
  }
  return Response.json({ saved });
}
