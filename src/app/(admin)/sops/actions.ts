"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { sops } from "@/db/schema";
import { requireStaff } from "@/lib/auth";

export type SopState = { ok?: boolean; error?: string };

const sopSchema = z.object({
  category: z.string().trim().min(1, "Give it a category, like General.").max(100),
  title: z.string().trim().min(1, "Give it a title.").max(300),
  body: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().max(50_000).nullable()),
  videoUrl: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().url("Video link must be a full web address.").max(1000).nullable()),
  visibility: z.enum(["team", "client", "both"]),
  published: z.boolean(),
});

export async function saveSop(id: string | null, _prev: SopState, formData: FormData): Promise<SopState> {
  const user = await requireStaff();
  const parsed = sopSchema.safeParse({ ...Object.fromEntries(formData), published: formData.get("published") === "on" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const now = new Date().toISOString();
  if (id) await db.update(sops).set({ ...parsed.data, updatedAt: now }).where(eq(sops.id, id));
  else await db.insert(sops).values({ id: randomUUID(), ...parsed.data, createdById: user.id, updatedAt: now, createdAt: now });
  refresh();
  return { ok: true };
}

export async function deleteSop(id: string) {
  await requireStaff();
  await db.delete(sops).where(eq(sops.id, id));
  refresh();
}
