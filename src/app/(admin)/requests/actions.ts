"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { requests, services, tasks, REQUEST_TYPES } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { REQUEST_TYPE_SERVICE } from "@/lib/labels";

const newRequestSchema = z.object({
  clientId: z.string().min(1, "Pick a client."),
  type: z.enum(REQUEST_TYPES),
  title: z.string().trim().min(1, "Give the request a short title.").max(300),
  body: z.preprocess((v) => (v === "" ? null : v), z.string().max(10_000).nullable()),
});

export type RequestFormState = { ok?: boolean; error?: string };

/** Staff logging a request on a client's behalf (e.g. from a phone call). */
export async function createRequest(_prev: RequestFormState, formData: FormData): Promise<RequestFormState> {
  const user = await requireStaff();
  const parsed = newRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await db.insert(requests).values({
    id: randomUUID(),
    ...parsed.data,
    submittedById: user.id,
    status: "open",
    createdAt: new Date().toISOString(),
  });
  refresh();
  return { ok: true };
}

export async function replyToRequest(id: string, _prev: RequestFormState, formData: FormData): Promise<RequestFormState> {
  const user = await requireStaff();
  const reply = String(formData.get("reply") ?? "").trim();
  const decline = formData.get("decline") === "1";
  if (!reply) return { error: decline ? "Add a short reason for declining." : "Write a reply first." };

  await db
    .update(requests)
    .set({ reply: reply.slice(0, 10_000), status: decline ? "declined" : "replied", repliedById: user.id, repliedAt: new Date().toISOString() })
    .where(eq(requests.id, id));
  refresh();
  return { ok: true };
}

export async function convertRequestToTask(id: string) {
  const user = await requireStaff();
  const [request] = await db.select().from(requests).where(eq(requests.id, id));
  if (!request || request.status === "converted") return;

  const preferred = REQUEST_TYPE_SERVICE[request.type];
  const [service] = await db.select().from(services).where(eq(services.key, preferred));
  const taskId = randomUUID();
  const now = new Date().toISOString();

  await db.insert(tasks).values({
    id: taskId,
    clientId: request.clientId,
    serviceKey: service?.key ?? "ad_hoc",
    title: request.title,
    description: request.body,
    status: "todo",
    priority: "medium",
    clientVisible: true,
    createdById: user.id,
    createdAt: now,
  });
  await db
    .update(requests)
    .set({ status: "converted", convertedTaskId: taskId, repliedById: user.id, repliedAt: now })
    .where(eq(requests.id, id));
  refresh();
}

export async function reopenRequest(id: string) {
  await requireStaff();
  await db.update(requests).set({ status: "open" }).where(eq(requests.id, id));
  refresh();
}
