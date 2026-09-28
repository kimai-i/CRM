import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { clients, meetingActionItems, meetings, users } from "@/db/schema";
import type { ActionItemView } from "@/app/(admin)/meetings/action-items";

export type MeetingListRow = {
  id: string;
  title: string;
  startsAt: string;
  durationMin: number | null;
  visibility: "internal" | "client";
  clientId: string | null;
  clientName: string | null;
  clientColor: string | null;
  createdBy: string | null;
  openItems: number;
  totalItems: number;
};

export async function getMeetingList(opts: { clientId?: string; visibleToClientOnly?: boolean } = {}): Promise<MeetingListRow[]> {
  const conditions = [];
  if (opts.clientId) conditions.push(eq(meetings.clientId, opts.clientId));
  if (opts.visibleToClientOnly) conditions.push(eq(meetings.visibility, "client"));
  const rows = await db
    .select({
      id: meetings.id,
      title: meetings.title,
      startsAt: meetings.startsAt,
      durationMin: meetings.durationMin,
      visibility: meetings.visibility,
      clientId: meetings.clientId,
      clientName: clients.name,
      clientColor: clients.color,
      createdBy: users.name,
    })
    .from(meetings)
    .leftJoin(clients, eq(meetings.clientId, clients.id))
    .leftJoin(users, eq(meetings.createdById, users.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(meetings.startsAt));
  const items = rows.length
    ? await db.select({ meetingId: meetingActionItems.meetingId, doneAt: meetingActionItems.doneAt }).from(meetingActionItems).where(inArray(meetingActionItems.meetingId, rows.map((r) => r.id)))
    : [];
  return rows.map((r) => {
    const mine = items.filter((i) => i.meetingId === r.id);
    return { ...r, totalItems: mine.length, openItems: mine.filter((i) => !i.doneAt).length };
  });
}

export async function getActionItems(meetingIds: string[]): Promise<Map<string, ActionItemView[]>> {
  if (meetingIds.length === 0) return new Map();
  const rows = await db.select().from(meetingActionItems).where(inArray(meetingActionItems.meetingId, meetingIds)).orderBy(asc(meetingActionItems.createdAt));
  const map = new Map<string, ActionItemView[]>();
  for (const r of rows) {
    map.set(r.meetingId, [...(map.get(r.meetingId) ?? []), { id: r.id, text: r.text, assignee: r.assignee, doneAt: r.doneAt, taskId: r.taskId }]);
  }
  return map;
}
