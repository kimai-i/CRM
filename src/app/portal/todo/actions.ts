"use server";

import { refresh } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { requireClientUser } from "@/lib/auth";

/** A client ticks off (or un-ticks) one of their own to-dos. */
export async function setMyTaskDone(taskId: string, done: boolean) {
  const viewer = await requireClientUser();
  await db
    .update(tasks)
    .set({ status: done ? "done" : "todo", completedAt: done ? new Date().toISOString() : null })
    .where(and(eq(tasks.id, taskId), eq(tasks.clientId, viewer.clientId), eq(tasks.assigneeType, "client")));
  refresh();
}
