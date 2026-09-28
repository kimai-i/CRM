import type { Metadata } from "next";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { clients, services, tasks } from "@/db/schema";
import { requireClientUser } from "@/lib/auth";
import { dueLabel, toDateString } from "@/lib/dates";
import { timeAgo } from "@/lib/labels";
import { EmptyState, PriorityBadge, StatusBadge } from "@/components/ui";

export const metadata: Metadata = { title: "Active Work" };

export default async function PortalWorkPage() {
  const user = await requireClientUser();
  const today = toDateString(new Date());

  // Only this client's top-level tasks that are marked visible to the client.
  const [[client], rows, serviceRows] = await Promise.all([
    db.select().from(clients).where(eq(clients.id, user.clientId)),
    // Client to-dos have their own page; this one is the team's work.
    db.select().from(tasks).where(and(eq(tasks.clientId, user.clientId), eq(tasks.clientVisible, true), eq(tasks.assigneeType, "agency"), isNull(tasks.parentId))),
    db.select().from(services),
  ]);
  const serviceByKey = new Map(serviceRows.map((s) => [s.key, s]));

  const open = rows.filter((t) => t.status !== "done");
  const done = rows
    .filter((t) => t.status === "done")
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  const byService = [...new Set(open.map((t) => t.serviceKey))]
    .map((key) => ({ service: serviceByKey.get(key), tasks: open.filter((t) => t.serviceKey === key) }))
    .sort((a, b) => (a.service?.sort ?? 0) - (b.service?.sort ?? 0));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Active Work</h1>
        <p className="mt-1 text-sm text-slate-500">Everything your team is working on for {client?.name}.</p>
      </div>

      {byService.length === 0 ? (
        <EmptyState>Nothing in progress right now.</EmptyState>
      ) : (
        byService.map(({ service, tasks: group }) => (
          <section key={service?.key} className="rounded-xl border border-slate-200 bg-white">
            <header className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: service?.color }} />
              {service?.name} <span className="font-normal text-slate-400">· {group.length}</span>
            </header>
            <ul className="divide-y divide-slate-100">
              {group
                .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
                .map((t) => {
                  const due = dueLabel(t.dueDate, today);
                  return (
                    <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                      <span className="min-w-0 flex-1 text-sm text-slate-900">{t.title}</span>
                      <StatusBadge status={t.status} />
                      <PriorityBadge priority={t.priority} />
                      {t.dueDate && (
                        <span className={`w-24 text-right text-xs ${due.overdue ? "font-medium text-red-600" : "text-slate-500"}`}>{due.text}</span>
                      )}
                    </li>
                  );
                })}
            </ul>
          </section>
        ))
      )}

      {done.length > 0 && (
        <details className="rounded-xl border border-slate-200 bg-white">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900">Recently completed ({done.length})</summary>
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {done.slice(0, 50).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="text-slate-600">{t.title}</span>
                {t.completedAt && <span className="shrink-0 text-xs text-slate-400">Done {timeAgo(t.completedAt)}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
