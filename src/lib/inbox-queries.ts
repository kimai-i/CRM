import "server-only";
import { and, asc, desc, eq, gt, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { messages, threadParticipants, threads, users } from "@/db/schema";

export type ThreadSummary = {
  id: string;
  name: string;
  isGroup: boolean;
  lastMessageAt: string;
  preview: string | null;
  previewSender: string | null;
  unread: boolean;
  archived: boolean;
  people: { id: string; name: string; initials: string; color: string }[];
};

export async function getThreadsFor(userId: string): Promise<ThreadSummary[]> {
  const mine = await db.select().from(threadParticipants).where(eq(threadParticipants.userId, userId));
  if (mine.length === 0) return [];
  const ids = mine.map((m) => m.threadId);
  const [threadRows, people, lastMessages] = await Promise.all([
    db.select().from(threads).where(inArray(threads.id, ids)).orderBy(desc(threads.lastMessageAt)),
    db.select({ threadId: threadParticipants.threadId, id: users.id, name: users.name, initials: users.initials, color: users.color })
      .from(threadParticipants).innerJoin(users, eq(threadParticipants.userId, users.id)).where(inArray(threadParticipants.threadId, ids)),
    // Latest message per thread.
    db.select({ threadId: messages.threadId, body: messages.body, senderName: users.name, createdAt: messages.createdAt })
      .from(messages)
      .leftJoin(users, eq(messages.senderId, users.id))
      .where(and(inArray(messages.threadId, ids), sql`${messages.createdAt} = (select max(m2.created_at) from messages m2 where m2.thread_id = ${messages.threadId})`)),
  ]);
  const myRow = new Map(mine.map((m) => [m.threadId, m]));
  const lastByThread = new Map(lastMessages.map((m) => [m.threadId, m]));

  return threadRows.map((t) => {
    const members = people.filter((p) => p.threadId === t.id);
    const others = members.filter((p) => p.id !== userId);
    const last = lastByThread.get(t.id);
    const me = myRow.get(t.id)!;
    return {
      id: t.id,
      name: t.title ?? (others.map((o) => o.name).join(", ") || "Just you"),
      isGroup: members.length > 2 || Boolean(t.title),
      lastMessageAt: t.lastMessageAt,
      preview: last?.body ?? null,
      previewSender: last?.senderName ?? null,
      unread: !me.lastReadAt || t.lastMessageAt > me.lastReadAt,
      archived: me.archived,
      people: others.map(({ id, name, initials, color }) => ({ id, name, initials, color })),
    };
  });
}

export async function getThreadMessages(threadId: string, userId: string) {
  const [member] = await db.select().from(threadParticipants).where(and(eq(threadParticipants.threadId, threadId), eq(threadParticipants.userId, userId)));
  if (!member) return null;
  return db
    .select({ id: messages.id, body: messages.body, createdAt: messages.createdAt, senderId: messages.senderId, senderName: users.name, senderInitials: users.initials, senderColor: users.color })
    .from(messages)
    .leftJoin(users, eq(messages.senderId, users.id))
    .where(eq(messages.threadId, threadId))
    .orderBy(asc(messages.createdAt));
}

export async function markReadNow(threadId: string, userId: string) {
  await db
    .update(threadParticipants)
    .set({ lastReadAt: new Date().toISOString() })
    .where(and(eq(threadParticipants.threadId, threadId), eq(threadParticipants.userId, userId)));
}

/** How many conversations have messages the user hasn't read. */
export async function countUnreadThreads(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(threadParticipants)
    .innerJoin(threads, eq(threadParticipants.threadId, threads.id))
    .where(
      and(
        eq(threadParticipants.userId, userId),
        eq(threadParticipants.archived, false),
        or(isNull(threadParticipants.lastReadAt), gt(threads.lastMessageAt, threadParticipants.lastReadAt)),
      ),
    );
  return Number(row?.n ?? 0);
}

export async function getTeamForInbox(excludeUserId: string) {
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(ne(users.role, "client"), eq(users.isActive, true), ne(users.id, excludeUserId)))
    .orderBy(asc(users.name));
}
