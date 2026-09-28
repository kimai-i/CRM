"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { eq, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { taskComments, tasks, TASK_PRIORITIES, TASK_STATUSES } from "@/db/schema";
import { requireStaff } from "@/lib/auth";

const emptyToNull = (v: unknown) => (v === "" || v === undefined ? null : v);

const taskFields = z.object({
  title: z.string().trim().min(1, "Give the task a title.").max(300),
  description: z.preprocess(emptyToNull, z.string().max(10_000).nullable()),
  clientId: z.string().min(1, "Pick a client."),
  serviceKey: z.string().min(1, "Pick a channel."),
  ownerId: z.preprocess(emptyToNull, z.string().nullable()),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  dueDate: z.preprocess(emptyToNull, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()),
  estHours: z.preprocess(emptyToNull, z.coerce.number().min(0).max(1000).nullable()),
  clientVisible: z.boolean(),
  assigneeType: z.enum(["agency", "client"]).default("agency"),
});

export type TaskFormState = { ok?: boolean; error?: string };

export async function createTask(_prev: TaskFormState, formData: FormData): Promise<TaskFormState> {
  const user = await requireStaff();
  const parsed = taskFields.safeParse({
    ...Object.fromEntries(formData),
    clientVisible: formData.get("clientVisible") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const now = new Date().toISOString();
  await db.insert(tasks).values({
    id: randomUUID(),
    ...parsed.data,
    completedAt: parsed.data.status === "done" ? now : null,
    createdById: user.id,
    createdAt: now,
  });
  refresh();
  return { ok: true };
}

const patchSchema = taskFields.partial();
export type TaskPatch = z.input<typeof patchSchema>;

export async function updateTask(id: string, patch: TaskPatch): Promise<{ error?: string }> {
  await requireStaff();
  const parsed = patchSchema.safeParse(patch);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const values: Partial<typeof tasks.$inferInsert> = { ...parsed.data };
  if (parsed.data.status) {
    values.completedAt = parsed.data.status === "done" ? new Date().toISOString() : null;
  }
  await db.update(tasks).set(values).where(eq(tasks.id, id));
  refresh();
  return {};
}

export async function saveTaskDetails(id: string, _prev: TaskFormState, formData: FormData): Promise<TaskFormState> {
  await requireStaff();
  const parsed = taskFields.safeParse({
    ...Object.fromEntries(formData),
    clientVisible: formData.get("clientVisible") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const [existing] = await db.select({ status: tasks.status, completedAt: tasks.completedAt }).from(tasks).where(eq(tasks.id, id));
  if (!existing) return { error: "This task no longer exists." };
  const completedAt =
    parsed.data.status === "done" ? (existing.status === "done" ? existing.completedAt : new Date().toISOString()) : null;

  await db.update(tasks).set({ ...parsed.data, completedAt }).where(eq(tasks.id, id));
  refresh();
  return { ok: true };
}

export async function deleteTask(id: string, returnTo: string) {
  await requireStaff();
  await db.delete(tasks).where(or(eq(tasks.id, id), eq(tasks.parentId, id)));
  redirect(returnTo.startsWith("/") ? returnTo : "/my-work");
}

export async function addSubtask(parentId: string, formData: FormData) {
  const user = await requireStaff();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const [parent] = await db.select().from(tasks).where(eq(tasks.id, parentId));
  if (!parent) return;
  await db.insert(tasks).values({
    id: randomUUID(),
    parentId,
    title: title.slice(0, 300),
    clientId: parent.clientId,
    serviceKey: parent.serviceKey,
    ownerId: parent.ownerId,
    status: "todo",
    priority: parent.priority,
    clientVisible: parent.clientVisible,
    createdById: user.id,
    createdAt: new Date().toISOString(),
  });
  refresh();
}

export async function addComment(taskId: string, formData: FormData) {
  const user = await requireStaff();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;
  await db.insert(taskComments).values({
    id: randomUUID(),
    taskId,
    authorId: user.id,
    body: body.slice(0, 5000),
    createdAt: new Date().toISOString(),
  });
  refresh();
}
