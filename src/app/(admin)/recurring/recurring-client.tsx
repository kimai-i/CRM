"use client";

import { useActionState, useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { Pause, Pencil, Play, Plus, RefreshCw, Sparkles, Trash2, X } from "lucide-react";
import type { Lookups } from "@/lib/queries";
import type { RecurrenceFrequency, TaskPriority } from "@/db/schema";
import { PRIORITY_LABEL } from "@/lib/labels";
import { describeSchedule, repeatKeyFor, REPEAT_OPTIONS, WEEKDAY_SHORT } from "@/lib/recurrence";
import { toDateString } from "@/lib/dates";
import { ActionForm } from "@/components/action-form";
import {
  applyPreset,
  deleteTemplate,
  runRecurringNow,
  saveTemplate,
  setTemplateActive,
  type PresetState,
  type TemplateFormState,
} from "./actions";

export type TemplateView = {
  id: string;
  title: string;
  description: string | null;
  clientId: string;
  serviceKey: string;
  ownerId: string | null;
  priority: TaskPriority;
  estHours: number | null;
  clientVisible: boolean;
  frequency: RecurrenceFrequency;
  interval: number;
  weekdays: number[];
  dayOfMonth: number | null;
  startsOn: string;
  nextDueOn: string;
  leadDays: number;
  active: boolean;
};

type PresetView = { key: string; name: string; serviceKey: string; titles: string[] };

const PRIORITY_STYLE: Record<string, string> = {
  urgent: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-amber-50 text-amber-700",
  low: "bg-slate-100 text-slate-600",
};

/** Rough hours per month a routine adds, for the workload estimate. */
function monthlyHours(t: TemplateView): number {
  const hours = t.estHours ?? 0;
  if (t.frequency === "weekly") return (hours * t.weekdays.length * 52) / 12 / t.interval;
  return hours / t.interval;
}

const formatDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

export function RecurringBoard({ templates, lookups, presets }: { templates: TemplateView[]; lookups: Lookups; presets: PresetView[] }) {
  const [clientFilter, setClientFilter] = useState("");
  const [showPaused, setShowPaused] = useState(true);
  const [editing, setEditing] = useState<TemplateView | "new" | null>(null);
  const [presetOpen, setPresetOpen] = useState(false);

  const clientById = useMemo(() => new Map(lookups.clients.map((c) => [c.id, c])), [lookups.clients]);
  const serviceByKey = useMemo(() => new Map(lookups.services.map((s) => [s.key, s])), [lookups.services]);
  const staffById = useMemo(() => new Map(lookups.staff.map((u) => [u.id, u])), [lookups.staff]);

  const visible = templates.filter((t) => (!clientFilter || t.clientId === clientFilter) && (showPaused || t.active));
  const active = templates.filter((t) => t.active);
  const hoursPerMonth = active.reduce((sum, t) => sum + monthlyHours(t), 0);

  const groups = [...new Set(visible.map((t) => t.clientId))]
    .map((clientId) => ({ client: clientById.get(clientId), rows: visible.filter((t) => t.clientId === clientId) }))
    .sort((a, b) => (a.client?.name ?? "").localeCompare(b.client?.name ?? ""));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Active routines" value={String(active.length)} sub={`${templates.length - active.length} paused`} />
        <Stat label="Clients with routines" value={String(new Set(active.map((t) => t.clientId)).size)} sub="Across all channels" />
        <Stat label="Estimated hours / month" value={`~${Math.round(hoursPerMonth)}h`} sub="From routines' estimated hours" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className="input w-auto py-1.5">
          <option value="">All clients</option>
          {lookups.clients.filter((c) => c.lifecycle !== "churned").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showPaused} onChange={(e) => setShowPaused(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
          Show paused
        </label>
        <div className="ml-auto flex flex-wrap gap-2">
          <RunNowButton />
          <button type="button" onClick={() => setPresetOpen(true)} className="btn-secondary">
            <Sparkles className="h-4 w-4" /> Apply preset
          </button>
          <button type="button" onClick={() => setEditing("new")} className="btn-primary">
            <Plus className="h-4 w-4" /> New routine
          </button>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
          No routines yet. Start with <button className="font-medium text-indigo-600 hover:underline" onClick={() => setPresetOpen(true)}>Apply preset</button> to
          add a standard cadence for a client, or create one from scratch.
        </div>
      ) : (
        groups.map(({ client, rows }) => (
          <section key={client?.id} className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2 text-sm font-semibold text-slate-800">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: client?.color }} />
              {client?.name ?? "Unknown client"} <span className="font-normal text-slate-400">({rows.length})</span>
            </div>
            <table className="w-full min-w-[900px] table-fixed text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2 font-medium">Routine</th>
                  <th className="w-[110px] px-2 py-2 font-medium">Channel</th>
                  <th className="w-[190px] px-2 py-2 font-medium">Repeats</th>
                  <th className="w-[120px] px-2 py-2 font-medium">Next due</th>
                  <th className="w-[120px] px-2 py-2 font-medium">Owner</th>
                  <th className="w-[80px] px-2 py-2 font-medium">Priority</th>
                  <th className="w-[60px] px-2 py-2 font-medium">Hrs</th>
                  <th className="w-[120px] px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((t) => (
                  <TemplateRow
                    key={t.id}
                    t={t}
                    service={serviceByKey.get(t.serviceKey)}
                    owner={t.ownerId ? staffById.get(t.ownerId) : undefined}
                    onEdit={() => setEditing(t)}
                  />
                ))}
              </tbody>
            </table>
          </section>
        ))
      )}

      {editing && (
        <TemplateDialog
          template={editing === "new" ? null : editing}
          lookups={lookups}
          defaultClientId={clientFilter || undefined}
          onClose={() => setEditing(null)}
        />
      )}
      {presetOpen && <PresetDialog lookups={lookups} presets={presets} defaultClientId={clientFilter || undefined} onClose={() => setPresetOpen(false)} />}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{sub}</div>
    </div>
  );
}

function TemplateRow({
  t,
  service,
  owner,
  onEdit,
}: {
  t: TemplateView;
  service?: Lookups["services"][number];
  owner?: Lookups["staff"][number];
  onEdit: () => void;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <tr className={t.active ? "" : "bg-slate-50 text-slate-400"}>
      <td className="px-4 py-2.5">
        <div className={`font-medium ${t.active ? "text-slate-900" : "text-slate-500"}`}>{t.title}</div>
        <div className="text-xs text-slate-400">
          {!t.active && "Paused · "}
          {t.leadDays > 0 && `Created ${t.leadDays} day${t.leadDays === 1 ? "" : "s"} early · `}
          {t.clientVisible ? "Client can see" : "Internal"}
        </div>
      </td>
      <td className="px-2 py-2.5">
        {service && (
          <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: `${service.color}1a`, color: service.color }}>
            {service.name}
          </span>
        )}
      </td>
      <td className="px-2 py-2.5 text-xs text-slate-700">{describeSchedule(t)}</td>
      <td className="px-2 py-2.5 text-xs text-slate-700">{t.active ? formatDate(t.nextDueOn) : "—"}</td>
      <td className="truncate px-2 py-2.5 text-xs text-slate-700">{owner?.name ?? <span className="text-slate-400">Unassigned</span>}</td>
      <td className="px-2 py-2.5">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PRIORITY_STYLE[t.priority]}`}>{PRIORITY_LABEL[t.priority]}</span>
      </td>
      <td className="px-2 py-2.5 text-xs text-slate-600">{t.estHours != null ? `${t.estHours}h` : "—"}</td>
      <td className="px-4 py-2.5">
        <div className="flex justify-end gap-1">
          <button type="button" onClick={onEdit} className="btn-ghost p-1.5" title="Edit" aria-label="Edit">
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => setTemplateActive(t.id, !t.active))}
            className="btn-ghost p-1.5"
            title={t.active ? "Pause" : "Resume"}
            aria-label={t.active ? "Pause" : "Resume"}
          >
            {t.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (window.confirm(`Delete the routine "${t.title}"? Tasks it already created are kept.`)) {
                startTransition(() => deleteTemplate(t.id));
              }
            }}
            className="btn-ghost p-1.5 text-red-600 hover:bg-red-50"
            title="Delete"
            aria-label="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function RunNowButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-2">
      {message && <span className="text-sm text-slate-600">{message}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await runRecurringNow();
            setMessage(r.created === 0 ? "Nothing new was due." : `Created ${r.created} task${r.created === 1 ? "" : "s"}.`);
          })
        }
        className="btn-secondary"
        title="Create any routine tasks that are due now"
      >
        <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} /> Run now
      </button>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-[6vh]" onMouseDown={onClose}>
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="btn-ghost p-1" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function TemplateDialog({
  template,
  lookups,
  defaultClientId,
  onClose,
}: {
  template: TemplateView | null;
  lookups: Lookups;
  defaultClientId?: string;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<TemplateFormState, FormData>(saveTemplate.bind(null, template?.id ?? null), {});
  const [repeat, setRepeat] = useState(template ? repeatKeyFor(template.frequency, template.interval) : "w1");
  const [weekdays, setWeekdays] = useState<number[]>(template?.weekdays ?? [1]);
  const [dayOfMonth, setDayOfMonth] = useState<number>(template?.dayOfMonth ?? 1);
  const isWeekly = REPEAT_OPTIONS.find((o) => o.key === repeat)?.frequency === "weekly";

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  const preview = describeSchedule({
    frequency: isWeekly ? "weekly" : "monthly",
    interval: REPEAT_OPTIONS.find((o) => o.key === repeat)?.interval ?? 1,
    weekdays: [...weekdays].sort(),
    dayOfMonth,
  });

  return (
    <Modal title={template ? "Edit routine" : "New routine"} onClose={onClose}>
      <ActionForm action={action} className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="label">What needs doing?</span>
            <input name="title" required maxLength={300} defaultValue={template?.title} autoFocus={!template} className="input mt-1" />
          </label>
          <label>
            <span className="label">Client</span>
            <select name="clientId" required defaultValue={template?.clientId ?? defaultClientId ?? ""} className="input mt-1">
              <option value="" disabled>Choose a client…</option>
              {lookups.clients.filter((c) => c.lifecycle !== "churned" || c.id === template?.clientId).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Channel</span>
            <select name="serviceKey" required defaultValue={template?.serviceKey ?? ""} className="input mt-1">
              <option value="" disabled>Choose a channel…</option>
              {lookups.services.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
            </select>
          </label>
        </div>

        <fieldset className="rounded-lg border border-slate-200 p-4">
          <legend className="px-1 text-sm font-medium text-slate-700">Schedule</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="label">Repeats</span>
              <select name="repeat" value={repeat} onChange={(e) => setRepeat(e.target.value as typeof repeat)} className="input mt-1">
                {REPEAT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </label>
            {isWeekly ? (
              <div>
                <span className="label">On</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {WEEKDAY_SHORT.map((label, day) => {
                    const on = weekdays.includes(day);
                    return (
                      <label key={day} className={`cursor-pointer rounded-md border px-2 py-1.5 text-xs font-medium ${on ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}>
                        <input
                          type="checkbox"
                          name="weekdays"
                          value={day}
                          checked={on}
                          onChange={() => setWeekdays((w) => (on ? w.filter((d) => d !== day) : [...w, day]))}
                          className="sr-only"
                        />
                        {label}
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : (
              <label>
                <span className="label">On day</span>
                <select name="dayOfMonth" value={dayOfMonth} onChange={(e) => setDayOfMonth(Number(e.target.value))} className="input mt-1">
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
                  <option value={-1}>Last day of the month</option>
                </select>
              </label>
            )}
            <label>
              <span className="label">Starting</span>
              <input name="startsOn" type="date" required defaultValue={template?.startsOn ?? toDateString(new Date())} className="input mt-1" />
            </label>
            <label>
              <span className="label">Create the task early</span>
              <select name="leadDays" defaultValue={template?.leadDays ?? 0} className="input mt-1">
                <option value={0}>On the due date</option>
                {[1, 2, 3, 5, 7, 14].map((n) => <option key={n} value={n}>{n} day{n === 1 ? "" : "s"} before it's due</option>)}
              </select>
            </label>
          </div>
          <p className="mt-3 text-sm text-slate-500">Repeats: <span className="font-medium text-slate-800">{preview}</span></p>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-3">
          <label>
            <span className="label">Owner</span>
            <select name="ownerId" defaultValue={template?.ownerId ?? ""} className="input mt-1">
              <option value="">Unassigned</option>
              {lookups.staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>
          <label>
            <span className="label">Priority</span>
            <select name="priority" defaultValue={template?.priority ?? "medium"} className="input mt-1">
              {Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label>
            <span className="label">Estimated hours</span>
            <input name="estHours" type="number" min={0} step={0.25} defaultValue={template?.estHours ?? ""} className="input mt-1" />
          </label>
        </div>

        <label className="block">
          <span className="label">Instructions (copied into each task)</span>
          <textarea name="description" rows={3} defaultValue={template?.description ?? ""} className="input mt-1" />
        </label>
        <label className="flex items-center gap-2">
          <input name="clientVisible" type="checkbox" defaultChecked={template?.clientVisible ?? true} className="h-4 w-4 rounded border-slate-300" />
          <span className="text-sm text-slate-700">Client can see these tasks</span>
        </label>

        {state.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={pending} className="btn-primary">{pending ? "Saving…" : template ? "Save changes" : "Create routine"}</button>
        </div>
      </ActionForm>
    </Modal>
  );
}

function PresetDialog({
  lookups,
  presets,
  defaultClientId,
  onClose,
}: {
  lookups: Lookups;
  presets: PresetView[];
  defaultClientId?: string;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<PresetState, FormData>(applyPreset, {});
  const [presetKey, setPresetKey] = useState(presets[0]?.key ?? "");
  const preset = presets.find((p) => p.key === presetKey);

  return (
    <Modal title="Apply a preset" onClose={onClose}>
      {state.ok ? (
        <div className="space-y-4 p-5">
          <p className="text-sm text-slate-700">
            Added <strong>{state.added}</strong> routine{state.added === 1 ? "" : "s"}
            {state.skipped ? <> (skipped {state.skipped} this client already had)</> : null}.
            {state.created ? <> Created <strong>{state.created}</strong> task{state.created === 1 ? " that was" : "s that were"} already due.</> : null}
          </p>
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className="btn-primary">Done</button>
          </div>
        </div>
      ) : (
        <ActionForm action={action} className="space-y-4 p-5">
          <p className="text-sm text-slate-500">Adds a standard set of routines for one client. You can edit or pause any of them afterwards.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="label">Client</span>
              <select name="clientId" required defaultValue={defaultClientId ?? ""} className="input mt-1">
                <option value="" disabled>Choose a client…</option>
                {lookups.clients.filter((c) => c.lifecycle !== "churned").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label>
              <span className="label">Preset</span>
              <select name="presetKey" value={presetKey} onChange={(e) => setPresetKey(e.target.value)} className="input mt-1">
                {presets.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
              </select>
            </label>
            <label className="sm:col-span-2">
              <span className="label">Owner</span>
              <select name="ownerId" defaultValue="" className="input mt-1">
                <option value="">The client's account owner</option>
                {lookups.staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>
          </div>
          {preset && (
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Includes</div>
              <ul className="mt-1 list-inside list-disc text-sm text-slate-700">
                {preset.titles.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </div>
          )}
          {state.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={pending} className="btn-primary">{pending ? "Adding…" : "Add routines"}</button>
          </div>
        </ActionForm>
      )}
    </Modal>
  );
}
