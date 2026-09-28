"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { and, eq, max } from "drizzle-orm";
import { db } from "@/db";
import { businessProfiles, clients, onboardingItems } from "@/db/schema";
import { requireClientUser, requireStaff } from "@/lib/auth";
import { ALL_QUESTIONS, DEFAULT_CHECKLIST } from "@/lib/onboarding";

export type ProfileState = { ok?: boolean; error?: string; submitted?: boolean };

// ---------- Team ----------

export async function applyStandardChecklist(clientId: string) {
  await requireStaff();
  const [client] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, clientId));
  if (!client) return;
  const existing = new Set(
    (await db.select({ title: onboardingItems.title }).from(onboardingItems).where(eq(onboardingItems.clientId, clientId))).map((r) => r.title.toLowerCase()),
  );
  const now = new Date().toISOString();
  const [{ top }] = await db.select({ top: max(onboardingItems.sort) }).from(onboardingItems).where(eq(onboardingItems.clientId, clientId));
  const rows = DEFAULT_CHECKLIST.filter((i) => !existing.has(i.title.toLowerCase())).map((i, n) => ({
    id: randomUUID(),
    clientId,
    title: i.title,
    description: i.description ?? null,
    assignee: i.assignee,
    sort: (top ?? 0) + n + 1,
    createdAt: now,
  }));
  if (rows.length) await db.insert(onboardingItems).values(rows);
  refresh();
}

export async function addChecklistItem(clientId: string, formData: FormData) {
  await requireStaff();
  const title = String(formData.get("title") ?? "").trim().slice(0, 300);
  const assignee = formData.get("assignee") === "client" ? "client" : "agency";
  if (!title) return;
  const [{ top }] = await db.select({ top: max(onboardingItems.sort) }).from(onboardingItems).where(eq(onboardingItems.clientId, clientId));
  await db.insert(onboardingItems).values({ id: randomUUID(), clientId, title, assignee, sort: (top ?? 0) + 1, createdAt: new Date().toISOString() });
  refresh();
}

export async function setChecklistItemDone(id: string, done: boolean) {
  const user = await requireStaff();
  await db.update(onboardingItems).set(done ? { doneAt: new Date().toISOString(), doneById: user.id } : { doneAt: null, doneById: null }).where(eq(onboardingItems.id, id));
  refresh();
}

export async function deleteChecklistItem(id: string) {
  await requireStaff();
  await db.delete(onboardingItems).where(eq(onboardingItems.id, id));
  refresh();
}

function readAnswers(formData: FormData): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const q of ALL_QUESTIONS) {
    const v = String(formData.get(q.id) ?? "").trim().slice(0, 5000);
    if (v) answers[q.id] = v;
  }
  return answers;
}

async function upsertProfile(clientId: string, userId: string, formData: FormData): Promise<ProfileState> {
  const submit = formData.get("intent") === "submit";
  const now = new Date().toISOString();
  const values = {
    answers: JSON.stringify(readAnswers(formData)),
    updatedAt: now,
    updatedById: userId,
    ...(submit ? { submittedAt: now } : {}),
  };
  await db
    .insert(businessProfiles)
    .values({ clientId, ...values })
    .onConflictDoUpdate({ target: businessProfiles.clientId, set: values });
  if (submit) {
    // Tick the matching checklist item, if the client has one.
    await db
      .update(onboardingItems)
      .set({ doneAt: now, doneById: userId })
      .where(and(eq(onboardingItems.clientId, clientId), eq(onboardingItems.title, DEFAULT_CHECKLIST[0].title)));
  }
  refresh();
  return { ok: true, submitted: submit };
}

export async function saveProfileAsStaff(clientId: string, _prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const user = await requireStaff();
  return upsertProfile(clientId, user.id, formData);
}

// ---------- Client portal ----------

export async function saveMyProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const viewer = await requireClientUser();
  return upsertProfile(viewer.clientId, viewer.id, formData);
}

/** Clients can tick off only their own items. */
export async function setMyChecklistItemDone(id: string, done: boolean) {
  const viewer = await requireClientUser();
  await db
    .update(onboardingItems)
    .set(done ? { doneAt: new Date().toISOString(), doneById: viewer.id } : { doneAt: null, doneById: null })
    .where(and(eq(onboardingItems.id, id), eq(onboardingItems.clientId, viewer.clientId), eq(onboardingItems.assignee, "client")));
  refresh();
}
