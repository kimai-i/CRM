"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { applicants, APPLICANT_STATUSES, assets } from "@/db/schema";
import { requireClientUser, requireStaff } from "@/lib/auth";
import { deleteStoredFile } from "@/lib/files";
import { normalizeEmail } from "@/lib/leads";

export type ApplicantState = { ok?: boolean; error?: string };

const optional = (max: number) => z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(max).nullable());
const schema = z.object({
  name: z.string().trim().min(1, "Enter the applicant's name.").max(200),
  email: optional(200),
  phone: optional(50),
  role: optional(200),
  notes: optional(5000),
});

/** Staff add an applicant for a client (e.g. from an email or a careers-page export). */
export async function addApplicant(clientId: string, _prev: ApplicantState, formData: FormData): Promise<ApplicantState> {
  await requireStaff();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.email && !normalizeEmail(parsed.data.email)) return { error: "That email doesn't look right." };
  await db.insert(applicants).values({ id: randomUUID(), clientId, ...parsed.data, status: "new", submittedAt: new Date().toISOString() });
  refresh();
  return { ok: true };
}

/** Both the team and the client (it's their hire) can move an applicant along. */
export async function setApplicantStatus(id: string, status: (typeof APPLICANT_STATUSES)[number], as: "team" | "client") {
  if (!APPLICANT_STATUSES.includes(status)) return;
  if (as === "team") {
    await requireStaff();
    await db.update(applicants).set({ status }).where(eq(applicants.id, id));
  } else {
    const viewer = await requireClientUser();
    await db.update(applicants).set({ status }).where(and(eq(applicants.id, id), eq(applicants.clientId, viewer.clientId)));
  }
  refresh();
}

export async function deleteApplicant(id: string) {
  await requireStaff();
  const [row] = await db.select().from(applicants).where(eq(applicants.id, id));
  if (!row) return;
  await db.delete(applicants).where(eq(applicants.id, id));
  if (row.resumeAssetId) {
    const [file] = await db.select().from(assets).where(eq(assets.id, row.resumeAssetId));
    if (file) {
      await db.delete(assets).where(eq(assets.id, file.id));
      await deleteStoredFile(file.storedName);
    }
  }
  refresh();
}

/** Links an uploaded resume (purpose "resume") to an applicant of the same client. */
export async function attachResume(applicantId: string, assetId: string) {
  await requireStaff();
  const [row] = await db.select({ clientId: applicants.clientId }).from(applicants).where(eq(applicants.id, applicantId));
  const [file] = await db.select({ clientId: assets.clientId, purpose: assets.purpose }).from(assets).where(eq(assets.id, assetId));
  if (!row || !file || file.clientId !== row.clientId || file.purpose !== "resume") return;
  await db.update(applicants).set({ resumeAssetId: assetId }).where(eq(applicants.id, applicantId));
  refresh();
}
