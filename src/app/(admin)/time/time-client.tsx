"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Pencil, Play, Plus, Square, Trash2, X } from "lucide-react";
import type { Lookups } from "@/lib/queries";
import type { EntryRow, RunningTimer, TaskOption } from "@/lib/time-queries";
import { formatMinutes } from "@/lib/time";
import { toDateString } from "@/lib/dates";
import { deleteEntry, discardTimer, saveEntry, startTimer, stopTimer, type TimeActionState } from "./actions";
import { ActionForm } from "@/components/action-form";

/** Live "1:23:45" since a start time, updated every second. */
export function useElapsed(startedAt: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return "0:00:00";
  const secs = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  return `${Math.floor(secs / 3600)}:${String(Math.floor((secs % 3600) / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
}

function ClientServiceTaskFields({
  lookups,
  taskOptions,
  defaults,
}: {
  lookups: Lookups;
  taskOptions: TaskOption[];
  defaults?: { clientId?: string; serviceKey?: string; taskId?: string | null };
}) {
  const [clientId, setClientId] = useState(defaults?.clientId ?? "");
  const [serviceKey, setServiceKey] = useState(defaults?.serviceKey ?? "");
  const [taskId, setTaskId] = useState(defaults?.taskId ?? "");
  const clientTasks = taskOptions.filter((t) => t.clientId === clientId);

  return (
    <>
      <label>
        <span className="label">Client</span>
        <select
          name="clientId"
          required
          value={clientId}
          onChange={(e) => {
            setClientId(e.target.value);
            setTaskId("");
          }}
          className="input mt-1"
        >
          <option value="" disabled>Choose a client…</option>
          {lookups.clients.filter((c) => c.lifecycle !== "churned" || c.id === clientId).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </label>
      <label>
        <span className="label">Task (optional)</span>
        <select
          name="taskId"
          value={taskId}
          disabled={!clientId}
          onChange={(e) => {
            setTaskId(e.target.value);
            const task = taskOptions.find((t) => t.id === e.target.value);
            if (task) setServiceKey(task.serviceKey);
          }}
          className="input mt-1"
        >
          <option value="">{clientId ? (clientTasks.length ? "No specific task" : "No open tasks") : "Pick a client first"}</option>
          {clientTasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          {/* Keep an already-linked task that has since been closed. */}
          {defaults?.taskId && !clientTasks.some((t) => t.id === defaults.taskId) && clientId === defaults.clientId && (
            <option value={defaults.taskId}>Linked task</option>
          )}
        </select>
      </label>
      <label>
        <span className="label">Channel</span>
        <select name="serviceKey" required value={serviceKey} onChange={(e) => setServiceKey(e.target.value)} className="input mt-1">
          <option value="" disabled>Choose a channel…</option>
          {lookups.services.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
        </select>
      </label>
    </>
  );
}

export function TimerCard({ running, lookups, taskOptions }: { running: RunningTimer | null; lookups: Lookups; taskOptions: TaskOption[] }) {
  const elapsed = useElapsed(running?.startedAt ?? null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [state, action, starting] = useActionState<TimeActionState, FormData>(startTimer, {});

  useEffect(() => {
    if (state.message) setMessage(state.message);
  }, [state]);

  if (running) {
    return (
      <section className="rounded-xl border-2 border-indigo-200 bg-indigo-50/50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-indigo-600">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> Timer running
            </div>
            <div className="mt-1 flex items-center gap-2 text-lg font-semibold text-slate-900">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: running.clientColor }} />
              {running.clientName} · {running.serviceName}
            </div>
            {running.taskId && (
              <Link href={`/tasks/${running.taskId}`} className="text-sm text-indigo-700 hover:underline">{running.taskTitle}</Link>
            )}
            {running.note && <p className="text-sm text-slate-600">{running.note}</p>}
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-3xl font-semibold tabular-nums text-slate-900">{elapsed}</span>
            <button
              type="button"
              disabled={pending}
              onClick={() => startTransition(async () => setMessage((await stopTimer()).message ?? null))}
              className="btn-primary bg-red-600 hover:bg-red-700"
            >
              <Square className="h-4 w-4" /> Stop
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (window.confirm("Discard this timer without saving the time?")) startTransition(() => discardTimer());
              }}
              className="btn-ghost text-slate-500"
            >
              Discard
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-900">Start a timer</h2>
      <ActionForm action={action} className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_1fr_1.2fr_auto] md:items-end">
        <ClientServiceTaskFields lookups={lookups} taskOptions={taskOptions} />
        <label>
          <span className="label">What are you working on?</span>
          <input name="note" maxLength={1000} placeholder="Optional" className="input mt-1" />
        </label>
        <button type="submit" disabled={starting} className="btn-primary">
          <Play className="h-4 w-4" /> Start
        </button>
      </ActionForm>
      {state.error && <p className="mt-3 text-sm text-red-600">{state.error}</p>}
      {message && <p className="mt-3 text-sm text-green-700">{message}</p>}
    </section>
  );
}

export function EntryDialog({
  entry,
  lookups,
  taskOptions,
  onClose,
}: {
  entry: EntryRow | null;
  lookups: Lookups;
  taskOptions: TaskOption[];
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<TimeActionState, FormData>(saveEntry.bind(null, entry?.id ?? null), {});
  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-[8vh]" onMouseDown={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold text-slate-900">{entry ? "Edit time" : "Add time"}</h2>
          <button type="button" onClick={onClose} className="btn-ghost p-1" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <ActionForm action={action} className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="label">Date</span>
              <input name="date" type="date" required max={toDateString(new Date())} defaultValue={entry?.date ?? toDateString(new Date())} className="input mt-1" />
            </label>
            <label>
              <span className="label">How long?</span>
              <input
                name="duration"
                required
                placeholder="1:30, 1.5h or 90m"
                defaultValue={entry ? formatMinutes(entry.minutes) : ""}
                autoFocus
                className="input mt-1"
              />
            </label>
            <ClientServiceTaskFields
              lookups={lookups}
              taskOptions={taskOptions}
              defaults={entry ? { clientId: entry.clientId, serviceKey: entry.serviceKey, taskId: entry.taskId } : undefined}
            />
            <label className="sm:col-span-2">
              <span className="label">Note</span>
              <input name="note" maxLength={1000} defaultValue={entry?.note ?? ""} className="input mt-1" />
            </label>
          </div>
          {state.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={pending} className="btn-primary">{pending ? "Saving…" : "Save"}</button>
          </div>
        </ActionForm>
      </div>
    </div>
  );
}

export function AddTimeButton({ lookups, taskOptions }: { lookups: Lookups; taskOptions: TaskOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary">
        <Plus className="h-4 w-4" /> Add time
      </button>
      {open && <EntryDialog entry={null} lookups={lookups} taskOptions={taskOptions} onClose={() => setOpen(false)} />}
    </>
  );
}

export function EntryList({
  entries,
  lookups,
  taskOptions,
  editable,
}: {
  entries: EntryRow[];
  lookups: Lookups;
  taskOptions: TaskOption[];
  editable: boolean;
}) {
  const [editing, setEditing] = useState<EntryRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const days = [...new Set(entries.map((e) => e.date))].sort().reverse();
  if (entries.length === 0) return <p className="px-4 py-8 text-center text-sm text-slate-500">No time logged this week.</p>;

  return (
    <div className="divide-y divide-slate-100">
      {error && <p className="px-4 py-2 text-sm text-red-600">{error}</p>}
      {days.map((day) => {
        const dayEntries = entries.filter((e) => e.date === day);
        return (
          <div key={day}>
            <div className="flex items-center justify-between bg-slate-50/60 px-4 py-1.5 text-xs font-semibold text-slate-600">
              <span>{new Date(`${day}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</span>
              <span>{formatMinutes(dayEntries.reduce((s, e) => s + e.minutes, 0))}</span>
            </div>
            <ul className="divide-y divide-slate-50">
              {dayEntries.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: e.clientColor }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-slate-900">
                      {e.clientName} <span className="text-slate-400">·</span>{" "}
                      <span style={{ color: e.serviceColor }}>{e.serviceName}</span>
                      {e.taskId && (
                        <> <span className="text-slate-400">·</span> <Link href={`/tasks/${e.taskId}`} className="text-indigo-700 hover:underline">{e.taskTitle}</Link></>
                      )}
                    </div>
                    {e.note && <div className="truncate text-xs text-slate-500">{e.note}</div>}
                  </div>
                  <span className="text-xs text-slate-400">{e.fromTimer ? "Timer" : "Manual"}</span>
                  <span className="w-12 text-right font-mono font-medium tabular-nums text-slate-900">{formatMinutes(e.minutes)}</span>
                  {editable && (
                    <span className="flex gap-1">
                      <button type="button" onClick={() => setEditing(e)} className="btn-ghost p-1" aria-label="Edit entry"><Pencil className="h-4 w-4" /></button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          if (window.confirm("Delete this time entry?")) {
                            startTransition(async () => setError((await deleteEntry(e.id)).error ?? null));
                          }
                        }}
                        className="btn-ghost p-1 text-red-600 hover:bg-red-50"
                        aria-label="Delete entry"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {editing && <EntryDialog entry={editing} lookups={lookups} taskOptions={taskOptions} onClose={() => setEditing(null)} />}
    </div>
  );
}

/** Small ticking pill for the top bar while a timer runs. */
export function RunningTimerPill({ startedAt, label }: { startedAt: string; label: string }) {
  const elapsed = useElapsed(startedAt);
  return (
    <Link
      href="/time"
      className="hidden items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm text-red-700 hover:bg-red-100 sm:flex"
      title={`Timer running: ${label}`}
    >
      <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
      <span className="font-mono tabular-nums">{elapsed}</span>
      <span className="max-w-[140px] truncate text-xs">{label}</span>
    </Link>
  );
}

