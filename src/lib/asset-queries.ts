import "server-only";
import { and, desc, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { assets, clients, users } from "@/db/schema";

export type AssetView = {
  id: string;
  clientId: string | null;
  clientName: string | null;
  clientColor: string | null;
  purpose: "asset" | "photo" | "resume" | "sop";
  category: string;
  filename: string;
  mime: string;
  size: number;
  label: string | null;
  notes: string | null;
  clientVisible: boolean;
  photoStatus: "needs_review" | "approved" | "passed" | "posted" | null;
  uploadedBy: string | null;
  uploadedByClient: boolean;
  uploadedById: string | null;
  createdAt: string;
};

export async function getAssets(opts: { clientId?: string; purpose?: AssetView["purpose"]; clientVisibleOnly?: boolean }): Promise<AssetView[]> {
  const conditions: SQL[] = [];
  if (opts.clientId) conditions.push(eq(assets.clientId, opts.clientId));
  if (opts.purpose) conditions.push(eq(assets.purpose, opts.purpose));
  if (opts.clientVisibleOnly) conditions.push(eq(assets.clientVisible, true));
  const rows = await db
    .select({
      asset: assets,
      clientName: clients.name,
      clientColor: clients.color,
      uploadedBy: users.name,
      uploaderRole: users.role,
    })
    .from(assets)
    .leftJoin(clients, eq(assets.clientId, clients.id))
    .leftJoin(users, eq(assets.uploadedById, users.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(assets.createdAt));
  return rows.map(({ asset: a, clientName, clientColor, uploadedBy, uploaderRole }) => ({
    id: a.id,
    clientId: a.clientId,
    clientName,
    clientColor,
    purpose: a.purpose,
    category: a.category,
    filename: a.filename,
    mime: a.mime,
    size: a.size,
    label: a.label,
    notes: a.notes,
    clientVisible: a.clientVisible,
    photoStatus: a.photoStatus,
    uploadedBy,
    uploadedByClient: uploaderRole === "client",
    uploadedById: a.uploadedById,
    createdAt: a.createdAt,
  }));
}
