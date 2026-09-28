"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { messages, threadParticipants, threads, users } from "@/db/schema";
import { requireStaff } from "@/lib/auth";

export type InboxState = { error?: string };

async function isParticipant(threadId: string, userId: string) {
  const [row] = await db
    .select({ userId: threadParticipants.userId })
    .from(threadParticipants)
    .where(and(eq(threadParticipants.threadId, threadId), eq(threadParticipants.userId, userId)));
  return Boolean(row);
}

/** Starts a conversation (or reuses the existing direct message with one person). */
export async function startThread(_prev: InboxState, formData: FormData): Promise<InboxState> {
  const me = await requireStaff();
  const memberIds = [...new Set(formData.getAll("members").map(String))].filter((id) => id !== me.id);
  const title = String(formData.get("title") ?? "").trim().slice(0, 200) || null;
  const body = String(formData.get("body") ?? "").trim().slice(0, 10_000);
  if (memberIds.length === 0) return { error: "Pick at least one teammate." };
  if (!body) return { error: "Write a message." };

  const valid = await db.select({ id: users.id }).from(users).where(and(inArray(users.id, memberIds), ne(users.role, "client"), eq(users.isActive, true)));
  if (valid.length !== memberIds.length) return { error: "Only active team members can be added." };

  let threadId: string | null = null;
  if (memberIds.length === 1 && !title) {
    // Reuse the existing untitled 1:1 conversation with this person, if there is one.
    const mine = await db.select({ threadId: threadParticipants.threadId }).from(threadParticipants).where(eq(threadParticipants.userId, me.id));
    const candidates = mine.length
      ? await db.select({ id: threads.id }).from(threads).where(and(inArray(threads.id, mine.map((m) => m.threadId)), isNull(threads.title)))
      : [];
    for (const c of candidates) {
      const people = await db.select({ userId: threadParticipants.userId }).from(threadParticipants).where(eq(threadParticipants.threadId, c.id));
      if (people.length === 2 && people.some((p) => p.userId === memberIds[0])) {
        threadId = c.id;
        break;
      }
    }
  }

  const now = new Date().toISOString();
  if (!threadId) {
    threadId = randomUUID();
    await db.insert(threads).values({ id: threadId, title, createdById: me.id, lastMessageAt: now, createdAt: now });
    await db.insert(threadParticipants).values([me.id, ...memberIds].map((userId) => ({ threadId: threadId!, userId, lastReadAt: userId === me.id ? now : null })));
  }
  await db.insert(messages).values({ id: randomUUID(), threadId, senderId: me.id, body, createdAt: now });
  await db.update(threads).set({ lastMessageAt: now }).where(eq(threads.id, threadId));
  // A new message brings the conversation back for anyone who archived it.
  await db.update(threadParticipants).set({ archived: false }).where(eq(threadParticipants.threadId, threadId));
  redirect(`/inbox?thread=${threadId}`);
}

export async function sendMessage(threadId: string, formData: FormData) {
  const me = await requireStaff();
  const body = String(formData.get("body") ?? "").trim().slice(0, 10_000);
  if (!body || !(await isParticipant(threadId, me.id))) return;
  const now = new Date().toISOString();
  await db.insert(messages).values({ id: randomUUID(), threadId, senderId: me.id, body, createdAt: now });
  await db.update(threads).set({ lastMessageAt: now }).where(eq(threads.id, threadId));
  await db.update(threadParticipants).set({ archived: false }).where(eq(threadParticipants.threadId, threadId));
  await db.update(threadParticipants).set({ lastReadAt: now }).where(and(eq(threadParticipants.threadId, threadId), eq(threadParticipants.userId, me.id)));
  refresh();
}

export async function markThreadRead(threadId: string) {
  const me = await requireStaff();
  await db
    .update(threadParticipants)
    .set({ lastReadAt: new Date().toISOString() })
    .where(and(eq(threadParticipants.threadId, threadId), eq(threadParticipants.userId, me.id)));
}

export async function setThreadArchived(threadId: string, archived: boolean) {
  const me = await requireStaff();
  await db.update(threadParticipants).set({ archived }).where(and(eq(threadParticipants.threadId, threadId), eq(threadParticipants.userId, me.id)));
  refresh();
}
