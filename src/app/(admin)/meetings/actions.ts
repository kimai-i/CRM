"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { meetingActionItems, meetings, services, tasks } from "@/db/schema";
import { requireClientUser, requireStaff } from "@/lib/auth";

export type MeetingState = { ok?: boolean; error?: string; id?: string };

const optional = (max: number) => z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(max).nullable());

const meetingSchema = z.object({
  title: z.string().trim().min(1, "Give the meeting a title.").max(300),
  clientId: optional(100),
  startsAt: z.string().min(1, "Pick when the meeting happened."),
  durationMin: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.number().int().min(0).max(24 * 60).nullable()),
  attendees: optional(1000),
  summary: optional(20_000),
  internalNotes: optional(20_000),
  visibility: z.enum(["internal", "client"]),
  recordingUrl: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().url("Recording link must be a full web address.").max(1000).nullable()),
});

function parseMeeting(formData: FormData) {
  const parsed = meetingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message } as const;
  const startsAt = new Date(parsed.data.startsAt);
  if (Number.isNaN(startsAt.getTime())) return { error: "That date doesn't look right." } as const;
  if (parsed.data.visibility === "client" && !parsed.data.clientId) return { error: "Pick a client before sharing a meeting with them." } as const;
  return { values: { ...parsed.data, startsAt: startsAt.toISOString() } } as const;
}

export async function createMeeting(_prev: MeetingState, formData: FormData): Promise<MeetingState> {
  const user = await requireStaff();
  const result = parseMeeting(formData);
  if ("error" in result) return { error: result.error };
  const id = randomUUID();
  await db.insert(meetings).values({ id, ...result.values, createdById: user.id, createdAt: new Date().toISOString() });
  redirect(`/meetings/${id}`);
}

export async function updateMeeting(id: string, _prev: MeetingState, formData: FormData): Promise<MeetingState> {
  await requireStaff();
  const result = parseMeeting(formData);
  if ("error" in result) return { error: result.error };
  await db.update(meetings).set(result.values).where(eq(meetings.id, id));
  refresh();
  return { ok: true };
}

export async function deleteMeeting(id: string) {
  await requireStaff();
  await db.delete(meetings).where(eq(meetings.id, id));
  redirect("/meetings");
}

export async function addActionItem(meetingId: string, formData: FormData) {
  await requireStaff();
  const text = String(formData.get("text") ?? "").trim().slice(0, 1000);
  if (!text) return;
  await db.insert(meetingActionItems).values({
    id: randomUUID(),
    meetingId,
    text,
    assignee: formData.get("assignee") === "client" ? "client" : "agency",
    createdAt: new Date().toISOString(),
  });
  refresh();
}

export async function setActionItemDone(id: string, done: boolean) {
  await requireStaff();
  await db.update(meetingActionItems).set({ doneAt: done ? new Date().toISOString() : null }).where(eq(meetingActionItems.id, id));
  refresh();
}

export async function deleteActionItem(id: string) {
  await requireStaff();
  await db.delete(meetingActionItems).where(eq(meetingActionItems.id, id));
  refresh();
}

/** Turns an action item into a real task on the meeting's client. */
export async function convertActionItemToTask(id: string): Promise<{ error?: string }> {
  const user = await requireStaff();
  const [item] = await db.select().from(meetingActionItems).where(eq(meetingActionItems.id, id));
  if (!item) return { error: "That action item no longer exists." };
  if (item.taskId) return {};
  const [meeting] = await db.select().from(meetings).where(eq(meetings.id, item.meetingId));
  if (!meeting?.clientId) return { error: "Link the meeting to a client first." };
  const [adHoc] = await db.select({ key: services.key }).from(services).where(eq(services.key, "ad_hoc"));
  const [anyService] = adHoc ? [adHoc] : await db.select({ key: services.key }).from(services).limit(1);
  if (!anyService) return { error: "Add a channel first." };

  const taskId = randomUUID();
  await db.insert(tasks).values({
    id: taskId,
    clientId: meeting.clientId,
    serviceKey: anyService.key,
    title: item.text.slice(0, 300),
    description: `From meeting: ${meeting.title}`,
    status: "todo",
    priority: "medium",
    assigneeType: item.assignee,
    clientVisible: true,
    createdById: user.id,
    createdAt: new Date().toISOString(),
  });
  await db.update(meetingActionItems).set({ taskId }).where(eq(meetingActionItems.id, id));
  refresh();
  return {};
}

/** Client portal: tick off an action item assigned to the client on a shared meeting. */
export async function setMyActionItemDone(id: string, done: boolean) {
  const viewer = await requireClientUser();
  const [row] = await db
    .select({ id: meetingActionItems.id })
    .from(meetingActionItems)
    .innerJoin(meetings, eq(meetingActionItems.meetingId, meetings.id))
    .where(and(eq(meetingActionItems.id, id), eq(meetingActionItems.assignee, "client"), eq(meetings.clientId, viewer.clientId), eq(meetings.visibility, "client")));
  if (!row) return;
  await db.update(meetingActionItems).set({ doneAt: done ? new Date().toISOString() : null }).where(eq(meetingActionItems.id, id));
  refresh();
}
