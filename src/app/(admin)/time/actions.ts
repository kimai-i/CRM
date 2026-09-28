"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { and, eq, isNull, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { clients, services, tasks, timeEntries } from "@/db/schema";
import { isAdmin, requireStaff } from "@/lib/auth";
import { toDateString } from "@/lib/dates";
import { formatMinutes, MAX_TIMER_MINUTES, minutesBetween, parseDuration } from "@/lib/time";

export type TimeActionState = { ok?: boolean; error?: string; message?: string };

const runningFor = (userId: string) =>
  and(eq(timeEntries.userId, userId), isNotNull(timeEntries.startedAt), isNull(timeEntries.endedAt));

/** Stops the user's running timer, if any. Returns the minutes saved (0 if nothing was running or it was under a minute). */
async function stopRunning(userId: string): Promise<{ minutes: number; capped: boolean } | null> {
  const [running] = await db.select().from(timeEntries).where(runningFor(userId));
  if (!running?.startedAt) return null;
  const endedAt = new Date().toISOString();
  const elapsed = minutesBetween(running.startedAt, endedAt);
  if (elapsed < 1) {
    await db.delete(timeEntries).where(eq(timeEntries.id, running.id));
    return { minutes: 0, capped: false };
  }
  const capped = elapsed > MAX_TIMER_MINUTES;
  const minutes = capped ? MAX_TIMER_MINUTES : elapsed;
  const note = capped
    ? [running.note, `Timer ran ${formatMinutes(elapsed)} — saved as ${formatMinutes(MAX_TIMER_MINUTES)}. Please check.`].filter(Boolean).join(" · ")
    : running.note;
  await db
    .update(timeEntries)
    .set({ endedAt, minutes, note, date: toDateString(new Date(running.startedAt)) })
    .where(eq(timeEntries.id, running.id));
  return { minutes, capped };
}

async function resolveTarget(input: { clientId?: string; serviceKey?: string; taskId?: string | null }) {
  if (input.taskId) {
    const [task] = await db.select({ id: tasks.id, clientId: tasks.clientId, serviceKey: tasks.serviceKey }).from(tasks).where(eq(tasks.id, input.taskId));
    if (!task) return { error: "That task no longer exists." } as const;
    return { clientId: task.clientId, serviceKey: task.serviceKey, taskId: task.id } as const;
  }
  if (!input.clientId) return { error: "Pick a client." } as const;
  if (!input.serviceKey) return { error: "Pick a channel." } as const;
  const [[client], [service]] = await Promise.all([
    db.select({ id: clients.id }).from(clients).where(eq(clients.id, input.clientId)),
    db.select({ key: services.key }).from(services).where(eq(services.key, input.serviceKey)),
  ]);
  if (!client) return { error: "That client no longer exists." } as const;
  if (!service) return { error: "Unknown channel." } as const;
  return { clientId: client.id, serviceKey: service.key, taskId: null } as const;
}

export async function startTimer(_prev: TimeActionState, formData: FormData): Promise<TimeActionState> {
  const user = await requireStaff();
  const target = await resolveTarget({
    clientId: String(formData.get("clientId") ?? ""),
    serviceKey: String(formData.get("serviceKey") ?? ""),
    taskId: String(formData.get("taskId") ?? "") || null,
  });
  if ("error" in target) return { error: target.error };

  const previous = await stopRunning(user.id);
  const now = new Date();
  await db.insert(timeEntries).values({
    id: randomUUID(),
    userId: user.id,
    ...target,
    date: toDateString(now),
    minutes: 0,
    note: String(formData.get("note") ?? "").trim().slice(0, 1000) || null,
    startedAt: now.toISOString(),
    createdAt: now.toISOString(),
  });
  refresh();
  return { ok: true, message: previous?.minutes ? `Saved ${formatMinutes(previous.minutes)} from your previous timer.` : undefined };
}

/** From a task page: start a timer on that task. */
export async function startTimerForTask(taskId: string) {
  const formData = new FormData();
  formData.set("taskId", taskId);
  await startTimer({}, formData);
}

export async function stopTimer(): Promise<TimeActionState> {
  const user = await requireStaff();
  const stopped = await stopRunning(user.id);
  refresh();
  if (!stopped) return { error: "No timer is running." };
  if (stopped.minutes === 0) return { ok: true, message: "Under a minute — nothing was saved." };
  return {
    ok: true,
    message: stopped.capped
      ? `Timer ran over ${MAX_TIMER_MINUTES / 60} hours, so it was saved as ${formatMinutes(stopped.minutes)}. Edit the entry if that's wrong.`
      : `Saved ${formatMinutes(stopped.minutes)}.`,
  };
}

export async function discardTimer() {
  const user = await requireStaff();
  await db.delete(timeEntries).where(runningFor(user.id));
  refresh();
}

const entrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date."),
  clientId: z.string().min(1, "Pick a client."),
  serviceKey: z.string().min(1, "Pick a channel."),
  taskId: z.preprocess((v) => (v === "" ? null : v), z.string().nullable()),
  duration: z.string().min(1, "Enter how long, like 1:30 or 1.5h."),
  note: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(1000).nullable()),
});

export async function saveEntry(id: string | null, _prev: TimeActionState, formData: FormData): Promise<TimeActionState> {
  const user = await requireStaff();
  const parsed = entrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const minutes = parseDuration(d.duration);
  if (minutes === null || minutes <= 0) return { error: `Couldn't read "${d.duration}". Try 1:30, 1.5h or 90m.` };
  if (minutes > 24 * 60) return { error: "One entry can't be more than 24 hours." };
  if (d.date > toDateString(new Date())) return { error: "You can't log time in the future." };

  const target = await resolveTarget({ clientId: d.clientId, serviceKey: d.serviceKey, taskId: d.taskId });
  if ("error" in target) return { error: target.error };
  // A task picked from another client's list would be confusing — keep the chosen client/channel.
  const values = { date: d.date, minutes, note: d.note, clientId: d.clientId, serviceKey: d.serviceKey, taskId: target.taskId };

  if (id) {
    const [existing] = await db.select().from(timeEntries).where(eq(timeEntries.id, id));
    if (!existing) return { error: "That entry no longer exists." };
    if (existing.userId !== user.id && !isAdmin(user.role)) return { error: "You can only edit your own time." };
    if (existing.startedAt && !existing.endedAt) return { error: "Stop the timer before editing this entry." };
    await db.update(timeEntries).set(values).where(eq(timeEntries.id, id));
  } else {
    await db.insert(timeEntries).values({ id: randomUUID(), userId: user.id, ...values, createdAt: new Date().toISOString() });
  }
  refresh();
  return { ok: true };
}

export async function deleteEntry(id: string): Promise<TimeActionState> {
  const user = await requireStaff();
  const [existing] = await db.select().from(timeEntries).where(eq(timeEntries.id, id));
  if (!existing) return {};
  if (existing.userId !== user.id && !isAdmin(user.role)) return { error: "You can only delete your own time." };
  await db.delete(timeEntries).where(eq(timeEntries.id, id));
  refresh();
  return { ok: true };
}
