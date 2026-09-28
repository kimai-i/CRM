import { db } from "@/db";
import { users, clients, services, tasks, leads, requests } from "@/db/schema";
import type { Client, Service, Task, User } from "@/db/schema";
import { addDays, daysBetween, startOfWeek, toDateString } from "@/lib/dates";

export type TaskWithRefs = Task & { client: Client; service: Service; owner: User | null };

export type ClientAttention = {
  client: Client;
  overdueTasks: number;
  leads7d: number;
  leadTrendPct: number | null;
  openRequests: number;
  score: number;
};

export type WorkloadRow = {
  user: User | null; // null = unassigned
  totalHours: number;
  segments: { service: Service; hours: number }[];
};

const isRealLead = (status: string) => status !== "not_a_lead" && status !== "spam";
const localDate = (iso: string) => toDateString(new Date(iso));

export async function getDashboardData(currentUser: User, now = new Date()) {
  const today = toDateString(now);
  const yesterday = addDays(today, -1);
  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);

  const [allUsers, allClients, allServices, allTasks, allLeads, allRequests] = await Promise.all([
    db.select().from(users),
    db.select().from(clients),
    db.select().from(services),
    db.select().from(tasks),
    db.select().from(leads),
    db.select().from(requests),
  ]);

  const userById = new Map(allUsers.map((u) => [u.id, u]));
  const clientById = new Map(allClients.map((c) => [c.id, c]));
  const serviceByKey = new Map(allServices.map((s) => [s.key, s]));

  const withRefs = (t: Task): TaskWithRefs => ({
    ...t,
    client: clientById.get(t.clientId)!,
    service: serviceByKey.get(t.serviceKey)!,
    owner: t.ownerId ? (userById.get(t.ownerId) ?? null) : null,
  });

  // Subtasks are counted through their parent, not on their own.
  const topLevel = allTasks.filter((t) => t.parentId === null);
  const openTasks = topLevel.filter((t) => t.status !== "done").map(withRefs);
  const isOverdue = (t: Task) => t.dueDate !== null && t.dueDate < today;
  const overdueTasks = openTasks
    .filter(isOverdue)
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));

  // --- Daily brief tiles ---
  const brief = {
    newLeadsToday: allLeads.filter((l) => isRealLead(l.status) && localDate(l.occurredAt) === today).length,
    openRequests: allRequests.filter((r) => r.status === "open").length,
    doneYesterday: allTasks.filter((t) => t.completedAt && localDate(t.completedAt) === yesterday).length,
    overdueNow: overdueTasks.length,
  };

  // --- Clients that need attention ---
  const billable = allClients.filter((c) => !c.isInternal && c.lifecycle !== "churned");
  const attention: ClientAttention[] = billable
    .map((client) => {
      const clientLeads = allLeads.filter((l) => l.clientId === client.id && isRealLead(l.status));
      const age = (l: { occurredAt: string }) => daysBetween(localDate(l.occurredAt), today);
      const leads7d = clientLeads.filter((l) => age(l) < 7).length;
      const leadsPrior7d = clientLeads.filter((l) => age(l) >= 7 && age(l) < 14).length;
      const leadTrendPct = leadsPrior7d === 0 ? null : Math.round(((leads7d - leadsPrior7d) / leadsPrior7d) * 100);
      const overdue = overdueTasks.filter((t) => t.clientId === client.id).length;
      const openReq = allRequests.filter((r) => r.clientId === client.id && r.status === "open").length;
      // Weighting is a first guess; tune once real data is in.
      const score = overdue * 2 + openReq * 2 + (leadTrendPct !== null && leadTrendPct < -20 ? 3 : 0);
      return { client, overdueTasks: overdue, leads7d, leadTrendPct, openRequests: openReq, score };
    })
    .filter((a) => a.score > 0)
    .sort((a, b) => b.score - a.score);

  // --- Agency hub ---
  const hub = {
    activeClients: allClients.filter((c) => !c.isInternal && c.lifecycle === "active").length,
    onboardingClients: allClients.filter((c) => c.lifecycle === "onboarding").length,
    activeTasks: openTasks.length,
    oneOffTasks: openTasks.filter((t) => !t.isRoutine).length,
    routineTasks: openTasks.filter((t) => t.isRoutine).length,
    overdueTasks: overdueTasks.length,
    overdueClients: new Set(overdueTasks.map((t) => t.clientId)).size,
  };

  // --- Team workload: estimated hours of open tasks, split by service ---
  const workloadOwners: (User | null)[] = [...allUsers.filter((u) => u.role !== "client" && u.isActive), null];
  const workload: WorkloadRow[] = workloadOwners
    .map((user) => {
      const mine = openTasks.filter((t) => (user ? t.ownerId === user.id : t.ownerId === null));
      const byService = new Map<string, number>();
      for (const t of mine) byService.set(t.serviceKey, (byService.get(t.serviceKey) ?? 0) + (t.estHours ?? 0));
      const segments = [...byService.entries()]
        .map(([key, hours]) => ({ service: serviceByKey.get(key)!, hours }))
        .sort((a, b) => a.service.sort - b.service.sort);
      return { user, totalHours: segments.reduce((s, x) => s + x.hours, 0), segments };
    })
    .filter((row) => row.user !== null || row.totalHours > 0);

  // --- Lists ---
  const thisWeekTasks = openTasks
    .filter((t) => t.dueDate !== null && t.dueDate >= weekStart && t.dueDate <= weekEnd)
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));

  const overdueRoutines = overdueTasks.filter((t) => t.isRoutine);

  const onboardings = allClients
    .filter((c) => c.lifecycle === "onboarding")
    .map((client) => {
      const clientTasks = allTasks.filter((t) => t.clientId === client.id);
      const done = clientTasks.filter((t) => t.status === "done").length;
      return { client, done, total: clientTasks.length };
    });

  const lifecycleCounts = {
    onboarding: allClients.filter((c) => !c.isInternal && c.lifecycle === "onboarding").length,
    active: allClients.filter((c) => !c.isInternal && c.lifecycle === "active").length,
    paused: allClients.filter((c) => !c.isInternal && c.lifecycle === "paused").length,
    churned: allClients.filter((c) => !c.isInternal && c.lifecycle === "churned").length,
  };

  const team = allUsers.filter((u) => u.role !== "client" && u.isActive);

  return {
    today,
    currentUser,
    brief,
    attention,
    hub,
    workload,
    services: [...allServices].sort((a, b) => a.sort - b.sort),
    overdueTasks,
    overdueRoutines,
    thisWeekTasks,
    onboardings,
    lifecycleCounts,
    team,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
