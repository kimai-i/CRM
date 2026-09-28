"use server";

import { refresh } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { ASSET_CATEGORIES, assets, brandKits, PHOTO_STATUSES } from "@/db/schema";
import { requireClientUser, requireStaff } from "@/lib/auth";
import { deleteStoredFile } from "@/lib/files";

type Category = (typeof ASSET_CATEGORIES)[number];

export async function updateAsset(id: string, change: { category?: Category; clientVisible?: boolean; label?: string | null }) {
  await requireStaff();
  if (change.category && !ASSET_CATEGORIES.includes(change.category)) return;
  await db
    .update(assets)
    .set({
      ...(change.category ? { category: change.category } : {}),
      ...(change.clientVisible !== undefined ? { clientVisible: change.clientVisible } : {}),
      ...(change.label !== undefined ? { label: change.label?.slice(0, 200) || null } : {}),
    })
    .where(eq(assets.id, id));
  refresh();
}

export async function deleteAsset(id: string) {
  await requireStaff();
  const [asset] = await db.select().from(assets).where(eq(assets.id, id));
  if (!asset) return;
  await db.delete(assets).where(eq(assets.id, id));
  await deleteStoredFile(asset.storedName);
  refresh();
}

/** Clients can delete files they uploaded themselves. */
export async function deleteMyAsset(id: string) {
  const viewer = await requireClientUser();
  const [asset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.id, id), eq(assets.clientId, viewer.clientId), eq(assets.uploadedById, viewer.id)));
  if (!asset) return;
  await db.delete(assets).where(eq(assets.id, id));
  await deleteStoredFile(asset.storedName);
  refresh();
}

export async function setPhotoStatus(ids: string[], status: (typeof PHOTO_STATUSES)[number]) {
  await requireStaff();
  if (!PHOTO_STATUSES.includes(status)) return;
  for (const id of ids.slice(0, 500)) {
    await db.update(assets).set({ photoStatus: status }).where(and(eq(assets.id, id), eq(assets.purpose, "photo")));
  }
  refresh();
}

export type BrandKitState = { ok?: boolean; error?: string };

const hex = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s : null;
};

export async function saveBrandKit(clientId: string, _prev: BrandKitState, formData: FormData): Promise<BrandKitState> {
  await requireStaff();
  const values = {
    barColor: hex(formData.get("barColor")),
    textColor: hex(formData.get("textColor")),
    accentColor: hex(formData.get("accentColor")),
    callNowPhone: String(formData.get("callNowPhone") ?? "").trim().slice(0, 40) || null,
    captionVoice: String(formData.get("captionVoice") ?? "").trim().slice(0, 1000) || null,
    updatedAt: new Date().toISOString(),
  };
  await db.insert(brandKits).values({ clientId, ...values }).onConflictDoUpdate({ target: brandKits.clientId, set: values });
  refresh();
  return { ok: true };
}
