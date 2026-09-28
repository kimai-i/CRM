import "server-only";
import { and, asc, eq, gte, isNotNull, isNull, lte, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, services, tasks, timeEntries, users } from "@/db/schema";
import { toDateString } from "@/lib/dates";

export type RunningTimer = {
  id: string;
  startedAt: string;
  clientId: string;
  clientName: string;
  clientColor: string;
  serviceName: string;
  taskId: string | null;
  taskTitle: string | null;
  note: string | null;
};

export async function getRunningTimer(userId: string): Promise<RunningTimer | null> {
  const [row] = await db
    .select({
      id: timeEntries.id,
      startedAt: timeEntries.startedAt,
      clientId: timeEntries.clientId,
      clientName: clients.name,
      clientColor: clients.color,
      serviceName: services.name,
      taskId: timeEntries.taskId,
      taskTitle: tasks.title,
      note: timeEntries.note,
    })
    .from(timeEntries)
    .innerJoin(clients, eq(timeEntries.clientId, clients.id))
    .innerJoin(services, eq(timeEntries.serviceKey, services.key))
    .leftJoin(tasks, eq(timeEntries.taskId, tasks.id))
    .where(and(eq(timeEntries.userId, userId), isNotNull(timeEntries.startedAt), isNull(timeEntries.endedAt)))
    .limit(1);
  return row?.startedAt ? { ...row, startedAt: row.startedAt } : null;
}

export type EntryRow = {
  id: string;
  date: string;
  minutes: number;
  note: string | null;
  clientId: string;
  clientName: string;
  clientColor: string;
  serviceKey: string;
  serviceName: string;
  serviceColor: string;
  taskId: string | null;
  taskTitle: string | null;
  fromTimer: boolean;
};

/** Finished entries for one person between two dates (inclusive). */
export async function getEntries(userId: string, start: string, end: string): Promise<EntryRow[]> {
  const rows = await db
    .select({
      id: timeEntries.id,
      date: timeEntries.date,
      minutes: timeEntries.minutes,
      note: timeEntries.note,
      clientId: timeEntries.clientId,
      clientName: clients.name,
      clientColor: clients.color,
      serviceKey: timeEntries.serviceKey,
      serviceName: services.name,
      serviceColor: services.color,
      taskId: timeEntries.taskId,
      taskTitle: tasks.title,
      startedAt: timeEntries.startedAt,
      endedAt: timeEntries.endedAt,
    })
    .from(timeEntries)
    .innerJoin(clients, eq(timeEntries.clientId, clients.id))
    .innerJoin(services, eq(timeEntries.serviceKey, services.key))
    .leftJoin(tasks, eq(timeEntries.taskId, tasks.id))
    .where(and(eq(timeEntries.userId, userId), gte(timeEntries.date, start), lte(timeEntries.date, end)))
    .orderBy(asc(timeEntries.date), asc(timeEntries.createdAt));

  return rows
    .filter((r) => !(r.startedAt && !r.endedAt)) // running timers aren't finished time yet
    .map(({ startedAt, endedAt, ...r }) => ({ ...r, fromTimer: Boolean(startedAt && endedAt) }));
}

/** Minutes logged this calendar month per team member, with their target. */
export async function getMonthUtilization(today = toDateString(new Date())) {
  const monthStart = `${today.slice(0, 7)}-01`;
  const [team, totals] = await Promise.all([
    db.select({ id: users.id, name: users.name, initials: users.initials, color: users.color, target: users.utilizationTargetHours })
      .from(users)
      .where(and(ne(users.role, "client"), eq(users.isActive, true)))
      .orderBy(asc(users.name)),
    db.select({ userId: timeEntries.userId, minutes: sql<number>`sum(${timeEntries.minutes})` })
      .from(timeEntries)
      .where(and(gte(timeEntries.date, monthStart), lte(timeEntries.date, today)))
      .groupBy(timeEntries.userId),
  ]);
  const byUser = new Map(totals.map((t) => [t.userId, Number(t.minutes)]));
  return team.map((u) => ({ ...u, minutes: byUser.get(u.id) ?? 0 }));
}

export async function getTaskMinutes(taskId: string): Promise<number> {
  const [row] = await db.select({ minutes: sql<number>`coalesce(sum(${timeEntries.minutes}), 0)` }).from(timeEntries).where(eq(timeEntries.taskId, taskId));
  return Number(row?.minutes ?? 0);
}

/** Open tasks per client, for the "which task?" dropdowns. */
export async function getOpenTaskOptions() {
  return db
    .select({ id: tasks.id, title: tasks.title, clientId: tasks.clientId, serviceKey: tasks.serviceKey })
    .from(tasks)
    .where(and(ne(tasks.status, "done"), isNull(tasks.parentId)))
    .orderBy(asc(tasks.title));
}
export type TaskOption = Awaited<ReturnType<typeof getOpenTaskOptions>>[number];
