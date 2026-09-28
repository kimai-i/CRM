"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition, type DragEvent } from "react";
import { CheckCircle2, Circle, EyeOff, KanbanSquare, ListChecks, MessageSquare, Plus, Repeat, Search, Table2 } from "lucide-react";
import type { Lookups, TaskRow } from "@/lib/queries";
import { addDays, dueLabel, startOfWeek } from "@/lib/dates";
import { PRIORITY_LABEL, STATUS_LABEL } from "@/lib/labels";
import { updateTask, type TaskPatch } from "@/app/(admin)/tasks/actions";
import { AddTaskDialog, type TaskDefaults } from "@/components/task-form";

type Tab = "open" | "mine" | "overdue" | "week" | "completed" | "all";
type GroupBy = "none" | "client" | "service" | "owner" | "status" | "priority";
type View = "table" | "kanban";

const TAB_LABEL: Record<Tab, string> = {
  open: "Open", mine: "Mine", overdue: "Overdue", week: "This Week", completed: "Completed", all: "All",
};
const GROUP_LABEL: Record<GroupBy, string> = {
  none: "No grouping", client: "Client", service: "Channel", owner: "Owner", status: "Status", priority: "Priority",
};
const STATUS_ORDER = ["todo", "in_progress", "blocked", "done"] as const;
const PRIORITY_ORDER = ["urgent", "high", "medium", "low"] as const;
const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 } as const;

const STATUS_STYLE: Record<string, string> = {
  todo: "bg-slate-100 text-slate-700",
  in_progress: "bg-blue-100 text-blue-700",
  blocked: "bg-red-100 text-red-700",
  done: "bg-green-100 text-green-700",
};
const PRIORITY_STYLE: Record<string, string> = {
  urgent: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-amber-50 text-amber-700",
  low: "bg-slate-100 text-slate-600",
};

export function TaskBoard({
  tasks,
  lookups,
  today,
  currentUserId,
  defaults = {},
  defaultGroup = "none",
  defaultTab = "open",
  allowedServiceKeys,
  hideClient = false,
}: {
  tasks: TaskRow[];
  lookups: Lookups;
  today: string;
  currentUserId: string;
  defaults?: TaskDefaults;
  defaultGroup?: GroupBy;
  defaultTab?: Tab;
  allowedServiceKeys?: string[];
  hideClient?: boolean;
}) {
  const [rows, setRows] = useState(tasks);
  useEffect(() => {
    setRows(tasks);
  }, [tasks]);

  const [tab, setTab] = useState<Tab>(defaultTab);
  const [groupBy, setGroupBy] = useState<GroupBy>(defaultGroup);
  const [view, setView] = useState<View>("table");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const clientById = useMemo(() => new Map(lookups.clients.map((c) => [c.id, c])), [lookups.clients]);
  const serviceByKey = useMemo(() => new Map(lookups.services.map((s) => [s.key, s])), [lookups.services]);
  const staffById = useMemo(() => new Map(lookups.staff.map((u) => [u.id, u])), [lookups.staff]);
  const serviceOptions = allowedServiceKeys
    ? lookups.services.filter((s) => allowedServiceKeys.includes(s.key))
    : lookups.services;

  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);
  const isOpen = (t: TaskRow) => t.status !== "done";
  const isOverdue = (t: TaskRow) => isOpen(t) && t.dueDate !== null && t.dueDate < today;

  const tabFilter: Record<Tab, (t: TaskRow) => boolean> = {
    open: isOpen,
    mine: (t) => isOpen(t) && t.ownerId === currentUserId,
    overdue: isOverdue,
    week: (t) => isOpen(t) && t.dueDate !== null && t.dueDate >= weekStart && t.dueDate <= weekEnd,
    completed: (t) => !isOpen(t),
    all: () => true,
  };

  const q = search.trim().toLowerCase();
  const visible = rows
    .filter(tabFilter[tab])
    .filter((t) => !q || t.title.toLowerCase().includes(q) || clientById.get(t.clientId)?.name.toLowerCase().includes(q))
    .sort((a, b) => {
      if (tab === "completed") return (b.completedAt ?? "").localeCompare(a.completedAt ?? "");
      if (a.dueDate !== b.dueDate) {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      }
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    });

  function patch(id: string, change: TaskPatch) {
    setError(null);
    setRows((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              ...(change as Partial<TaskRow>),
              ...(change.status ? { completedAt: change.status === "done" ? new Date().toISOString() : null } : {}),
            }
          : t,
      ),
    );
    startTransition(async () => {
      const res = await updateTask(id, change);
      if (res.error) {
        setError(res.error);
        setRows(tasks);
      }
    });
  }

  const groups = groupRows(visible, groupBy, { clientById, serviceByKey, staffById });

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200">
        {(Object.keys(TAB_LABEL) as Tab[]).map((key) => {
          const count = rows.filter(tabFilter[key]).length;
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm ${
                active ? "border-indigo-600 font-medium text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {TAB_LABEL[key]}
              <span className={`rounded-full px-1.5 text-[11px] ${active ? "bg-indigo-100" : "bg-slate-100"} ${key === "overdue" && count > 0 ? "text-red-600" : ""}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks or clients…"
            className="input pl-8"
          />
        </div>
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          Group by
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)} className="input w-auto py-1.5">
            {(Object.keys(GROUP_LABEL) as GroupBy[])
              .filter((g) => !(hideClient && g === "client"))
              .map((g) => (
                <option key={g} value={g}>{GROUP_LABEL[g]}</option>
              ))}
          </select>
        </label>
        <div className="flex overflow-hidden rounded-lg border border-slate-300">
          <button
            type="button"
            onClick={() => setView("table")}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-sm ${view === "table" ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
          >
            <Table2 className="h-4 w-4" /> Table
          </button>
          <button
            type="button"
            onClick={() => setView("kanban")}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-sm ${view === "kanban" ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
          >
            <KanbanSquare className="h-4 w-4" /> Board
          </button>
        </div>
        <button type="button" onClick={() => setAdding(true)} className="btn-primary ml-auto">
          <Plus className="h-4 w-4" /> Add task
        </button>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {view === "table" ? (
        visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
            No tasks match this view. Try <button className="font-medium text-indigo-600 hover:underline" onClick={() => setTab("all")}>All</button> or add one.
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map((g) => (
              <div key={g.key} className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                {groupBy !== "none" && (
                  <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-3 py-2 text-sm font-semibold text-slate-800">
                    {g.color && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: g.color }} />}
                    {g.label}
                    <span className="font-normal text-slate-400">({g.rows.length})</span>
                  </div>
                )}
                <table className="w-full min-w-[980px] table-fixed text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                      <th className="w-11 px-3 py-2" />
                      <th className="px-2 py-2 font-medium">Task</th>
                      {!hideClient && <th className="w-[160px] px-2 py-2 font-medium">Client</th>}
                      <th className="w-[120px] px-2 py-2 font-medium">Channel</th>
                      <th className="w-[130px] px-2 py-2 font-medium">Owner</th>
                      <th className="w-[115px] px-2 py-2 font-medium">Status</th>
                      <th className="w-[130px] px-2 py-2 font-medium">Due</th>
                      <th className="w-[90px] px-2 py-2 font-medium">Priority</th>
                      <th className="w-[70px] px-2 py-2 font-medium">Est. hrs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {g.rows.map((t) => {
                      const client = clientById.get(t.clientId);
                      const due = t.status === "done" ? null : dueLabel(t.dueDate, today);
                      return (
                        <tr key={t.id} className="group" style={{ backgroundColor: client ? `${client.color}0d` : undefined }}>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              aria-label={t.status === "done" ? "Mark not done" : "Mark done"}
                              onClick={() => patch(t.id, { status: t.status === "done" ? "todo" : "done" })}
                              className="text-slate-300 hover:text-green-600"
                            >
                              {t.status === "done" ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <Circle className="h-5 w-5" />}
                            </button>
                          </td>
                          <td className="px-2 py-2">
                            <Link href={`/tasks/${t.id}`} title={t.title} className={`line-clamp-2 font-medium leading-snug hover:text-indigo-700 ${t.status === "done" ? "text-slate-400 line-through" : "text-slate-900"}`}>
                              {t.title}
                            </Link>
                            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                              {t.subtaskCount > 0 && (
                                <span className="flex items-center gap-0.5"><ListChecks className="h-3 w-3" />{t.subtaskDone}/{t.subtaskCount}</span>
                              )}
                              {t.commentCount > 0 && (
                                <span className="flex items-center gap-0.5"><MessageSquare className="h-3 w-3" />{t.commentCount}</span>
                              )}
                              {t.isRoutine && <span className="flex items-center gap-0.5"><Repeat className="h-3 w-3" />Routine</span>}
                              {t.assigneeType === "client" && <span className="rounded bg-amber-100 px-1 font-medium text-amber-800">Client to-do</span>}
                              {!t.clientVisible && (
                                <span className="flex items-center gap-0.5" title="Hidden from client"><EyeOff className="h-3 w-3" />Internal</span>
                              )}
                            </div>
                          </td>
                          {!hideClient && (
                            <td className="px-2 py-2">
                              <select value={t.clientId} onChange={(e) => patch(t.id, { clientId: e.target.value })} className="input-sm max-w-[160px]">
                                {lookups.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            </td>
                          )}
                          <td className="px-2 py-2">
                            <select
                              value={t.serviceKey}
                              onChange={(e) => patch(t.id, { serviceKey: e.target.value })}
                              className="input-sm font-medium"
                              style={{ color: serviceByKey.get(t.serviceKey)?.color }}
                            >
                              {lookups.services.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <select value={t.ownerId ?? ""} onChange={(e) => patch(t.id, { ownerId: e.target.value })} className="input-sm max-w-[130px]">
                              <option value="">Unassigned</option>
                              {lookups.staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <select
                              value={t.status}
                              onChange={(e) => patch(t.id, { status: e.target.value as TaskRow["status"] })}
                              className={`rounded-full border-0 px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[t.status]}`}
                            >
                              {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="date"
                              value={t.dueDate ?? ""}
                              onChange={(e) => patch(t.id, { dueDate: e.target.value })}
                              className="input-sm w-[120px]"
                            />
                            {due && due.text !== "No date" && (
                              <div className={`px-1.5 text-[11px] ${due.overdue ? "font-medium text-red-600" : "text-slate-400"}`}>{due.text}</div>
                            )}
                          </td>
                          <td className="px-2 py-2">
                            <select
                              value={t.priority}
                              onChange={(e) => patch(t.id, { priority: e.target.value as TaskRow["priority"] })}
                              className={`rounded-full border-0 px-2 py-0.5 text-[11px] font-medium ${PRIORITY_STYLE[t.priority]}`}
                            >
                              {PRIORITY_ORDER.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-2 text-slate-600">{t.estHours != null ? `${t.estHours}h` : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )
      ) : (
        <Kanban
          rows={rows
            // On the Open tab the board also shows the last week's completed tasks in the Done column.
            .filter((t) => tabFilter[tab](t) || (tab === "open" && t.completedAt !== null && t.completedAt >= addDays(today, -7)))
            .filter((t) => !q || t.title.toLowerCase().includes(q))}
          today={today}
          lookups={{ clientById, serviceByKey, staffById }}
          onMove={(id, status) => patch(id, { status })}
        />
      )}

      {adding && (
        <AddTaskDialog
          lookups={{ ...lookups, services: serviceOptions }}
          defaults={{ serviceKey: serviceOptions[0]?.key, ...defaults }}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}

type Maps = {
  clientById: Map<string, Lookups["clients"][number]>;
  serviceByKey: Map<string, Lookups["services"][number]>;
  staffById: Map<string, Lookups["staff"][number]>;
};

function groupRows(rows: TaskRow[], groupBy: GroupBy, maps: Maps) {
  if (groupBy === "none") return [{ key: "all", label: "", color: undefined as string | undefined, rows }];

  const keyOf = (t: TaskRow): string =>
    groupBy === "client" ? t.clientId
    : groupBy === "service" ? t.serviceKey
    : groupBy === "owner" ? (t.ownerId ?? "")
    : groupBy === "status" ? t.status
    : t.priority;

  const describe = (key: string): { label: string; color?: string; sort: string } => {
    switch (groupBy) {
      case "client": {
        const c = maps.clientById.get(key);
        return { label: c?.name ?? "Unknown client", color: c?.color, sort: (c?.isInternal ? "z" : "a") + (c?.name ?? "") };
      }
      case "service": {
        const s = maps.serviceByKey.get(key);
        return { label: s?.name ?? key, color: s?.color, sort: s?.name ?? key };
      }
      case "owner": {
        const u = maps.staffById.get(key);
        return { label: u?.name ?? "Unassigned", color: u?.color, sort: u ? `a${u.name}` : "z" };
      }
      case "status":
        return { label: STATUS_LABEL[key as TaskRow["status"]], sort: String(STATUS_ORDER.indexOf(key as TaskRow["status"])) };
      default:
        return { label: PRIORITY_LABEL[key as TaskRow["priority"]], sort: String(PRIORITY_ORDER.indexOf(key as TaskRow["priority"])) };
    }
  };

  const buckets = new Map<string, TaskRow[]>();
  for (const t of rows) {
    const k = keyOf(t);
    buckets.set(k, [...(buckets.get(k) ?? []), t]);
  }
  return [...buckets.entries()]
    .map(([key, groupRows]) => ({ key, ...describe(key), rows: groupRows }))
    .sort((a, b) => a.sort.localeCompare(b.sort));
}

function Kanban({
  rows,
  today,
  lookups,
  onMove,
}: {
  rows: TaskRow[];
  today: string;
  lookups: Maps;
  onMove: (id: string, status: TaskRow["status"]) => void;
}) {
  const [dragOver, setDragOver] = useState<string | null>(null);

  function onDrop(e: DragEvent, status: TaskRow["status"]) {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData("text/plain");
    const task = rows.find((t) => t.id === id);
    if (task && task.status !== status) onMove(id, status);
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {STATUS_ORDER.map((status) => {
        const col = rows.filter((t) => t.status === status);
        return (
          <div
            key={status}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(status);
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => onDrop(e, status)}
            className={`min-h-[200px] rounded-xl border p-3 transition-colors ${
              dragOver === status ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-slate-100/60"
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>
              <span className="text-xs text-slate-400">{col.length}</span>
            </div>
            <div className="space-y-2">
              {col.slice(0, 50).map((t) => {
                const client = lookups.clientById.get(t.clientId);
                const service = lookups.serviceByKey.get(t.serviceKey);
                const owner = t.ownerId ? lookups.staffById.get(t.ownerId) : undefined;
                const due = t.status === "done" ? null : dueLabel(t.dueDate, today);
                return (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                    className="cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm active:cursor-grabbing"
                  >
                    <Link href={`/tasks/${t.id}`} className="text-sm font-medium text-slate-900 hover:text-indigo-700">
                      {t.title}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="flex items-center gap-1 text-slate-500">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: client?.color }} />
                        {client?.name}
                      </span>
                      {service && (
                        <span className="rounded-full px-1.5 py-0.5 font-medium" style={{ backgroundColor: `${service.color}1a`, color: service.color }}>
                          {service.name}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ${PRIORITY_STYLE[t.priority]}`}>{PRIORITY_LABEL[t.priority]}</span>
                      <div className="flex items-center gap-2">
                        {due && due.text !== "No date" && (
                          <span className={`text-[11px] ${due.overdue ? "font-medium text-red-600" : "text-slate-400"}`}>{due.text}</span>
                        )}
                        {owner ? (
                          <span
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                            style={{ backgroundColor: owner.color }}
                            title={owner.name}
                          >
                            {owner.initials}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Unassigned</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {col.length > 50 && <p className="text-center text-xs text-slate-400">+ {col.length - 50} more</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
