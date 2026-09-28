import "server-only";
import { and, asc, desc, eq, inArray, isNull, ne, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { clients, clientOwners, clientServices, requests, services, taskComments, tasks, users } from "@/db/schema";
import type { RequestView } from "@/components/request-card";

/** Plain, serializable lookup lists that task/client UIs need for names and colors. */
export type Lookups = {
  clients: { id: string; name: string; color: string; lifecycle: string; isInternal: boolean }[];
  services: { key: string; name: string; color: string }[];
  staff: { id: string; name: string; initials: string; color: string }[];
};

export async function getLookups(): Promise<Lookups> {
  const [clientRows, serviceRows, staffRows] = await Promise.all([
    db.select({
      id: clients.id, name: clients.name, color: clients.color, lifecycle: clients.lifecycle, isInternal: clients.isInternal,
    }).from(clients).orderBy(asc(clients.name)),
    db.select({ key: services.key, name: services.name, color: services.color }).from(services).orderBy(asc(services.sort)),
    db.select({ id: users.id, name: users.name, initials: users.initials, color: users.color })
      .from(users)
      .where(and(ne(users.role, "client"), eq(users.isActive, true)))
      .orderBy(asc(users.name)),
  ]);
  return { clients: clientRows, services: serviceRows, staff: staffRows };
}

export type TaskRow = {
  id: string;
  title: string;
  clientId: string;
  serviceKey: string;
  ownerId: string | null;
  status: "todo" | "in_progress" | "blocked" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: string | null;
  completedAt: string | null;
  estHours: number | null;
  clientVisible: boolean;
  isRoutine: boolean;
  assigneeType: "agency" | "client";
  createdAt: string;
  subtaskCount: number;
  subtaskDone: number;
  commentCount: number;
};

/** Top-level tasks (not subtasks) matching the scope, with subtask and comment counts. */
export async function getTaskRows(scope: { ownerId?: string; clientId?: string; serviceKeys?: string[] } = {}): Promise<TaskRow[]> {
  const conditions: SQL[] = [isNull(tasks.parentId)];
  if (scope.ownerId) conditions.push(eq(tasks.ownerId, scope.ownerId));
  if (scope.clientId) conditions.push(eq(tasks.clientId, scope.clientId));
  if (scope.serviceKeys?.length) conditions.push(inArray(tasks.serviceKey, scope.serviceKeys));

  const [rows, subRows, commentRows] = await Promise.all([
    db.select().from(tasks).where(and(...conditions)),
    db.select({
      parentId: tasks.parentId,
      total: sql<number>`count(*)`,
      done: sql<number>`sum(case when ${tasks.status} = 'done' then 1 else 0 end)`,
    }).from(tasks).where(sql`${tasks.parentId} is not null`).groupBy(tasks.parentId),
    db.select({ taskId: taskComments.taskId, total: sql<number>`count(*)` })
      .from(taskComments).groupBy(taskComments.taskId),
  ]);
  const subByParent = new Map(subRows.map((r) => [r.parentId, r]));
  const commentsByTask = new Map(commentRows.map((r) => [r.taskId, Number(r.total)]));

  return rows.map((task) => ({
    id: task.id,
    title: task.title,
    clientId: task.clientId,
    serviceKey: task.serviceKey,
    ownerId: task.ownerId,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    completedAt: task.completedAt,
    estHours: task.estHours,
    clientVisible: task.clientVisible,
    isRoutine: task.isRoutine,
    assigneeType: task.assigneeType,
    createdAt: task.createdAt,
    subtaskCount: Number(subByParent.get(task.id)?.total ?? 0),
    subtaskDone: Number(subByParent.get(task.id)?.done ?? 0),
    commentCount: commentsByTask.get(task.id) ?? 0,
  }));
}

/** Clients with their service keys, owner ids and open-task counts. */
export async function getClientsOverview() {
  const [clientRows, svcRows, ownerRows, openCounts] = await Promise.all([
    db.select().from(clients).orderBy(asc(clients.name)),
    db.select().from(clientServices),
    db.select().from(clientOwners),
    db.select({ clientId: tasks.clientId, n: sql<number>`count(*)` })
      .from(tasks)
      .where(and(ne(tasks.status, "done"), isNull(tasks.parentId)))
      .groupBy(tasks.clientId),
  ]);
  const openByClient = new Map(openCounts.map((r) => [r.clientId, Number(r.n)]));
  return clientRows.map((c) => ({
    ...c,
    serviceKeys: svcRows.filter((s) => s.clientId === c.id).map((s) => s.serviceKey),
    ownerIds: ownerRows.filter((o) => o.clientId === c.id).map((o) => o.userId),
    openTasks: openByClient.get(c.id) ?? 0,
  }));
}

export type ClientOverview = Awaited<ReturnType<typeof getClientsOverview>>[number];

/** Requests shaped for RequestCard, newest first. */
export async function getRequestViews(scope: { clientId?: string } = {}): Promise<RequestView[]> {
  const [rows, clientRows, userRows] = await Promise.all([
    db.select().from(requests)
      .where(scope.clientId ? eq(requests.clientId, scope.clientId) : undefined)
      .orderBy(desc(requests.createdAt)),
    db.select({ id: clients.id, name: clients.name, color: clients.color }).from(clients),
    db.select({ id: users.id, name: users.name }).from(users),
  ]);
  const clientById = new Map(clientRows.map((c) => [c.id, c]));
  const nameById = new Map(userRows.map((u) => [u.id, u.name]));
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    status: r.status,
    title: r.title,
    body: r.body,
    reply: r.reply,
    createdAt: r.createdAt,
    repliedAt: r.repliedAt,
    convertedTaskId: r.convertedTaskId,
    client: clientById.get(r.clientId) ?? { id: r.clientId, name: "Unknown client", color: "#94a3b8" },
    submittedBy: r.submittedById ? (nameById.get(r.submittedById) ?? null) : null,
    repliedBy: r.repliedById ? (nameById.get(r.repliedById) ?? null) : null,
  }));
}
