"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { ArrowRight, CheckCircle2, Circle, Plus, Trash2 } from "lucide-react";
import { addActionItem, convertActionItemToTask, deleteActionItem, setActionItemDone, setMyActionItemDone } from "./actions";

export type ActionItemView = { id: string; text: string; assignee: "agency" | "client"; doneAt: string | null; taskId: string | null };

export function ActionItems({ meetingId, items, mode }: { meetingId: string; items: ActionItemView[]; mode: "team" | "client" }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useOptimistic(items, (state, change: { id: string; done: boolean }) =>
    state.map((i) => (i.id === change.id ? { ...i, doneAt: change.done ? new Date().toISOString() : null } : i)),
  );

  return (
    <div className="space-y-3">
      {optimistic.length === 0 && <p className="text-sm text-slate-500">No action items.</p>}
      <ul className="space-y-1">
        {optimistic.map((item) => {
          const canTick = mode === "team" || item.assignee === "client";
          return (
            <li key={item.id} className="flex items-start gap-2 rounded-md px-1 py-1.5 hover:bg-slate-50">
              <button
                type="button"
                disabled={!canTick}
                aria-label={item.doneAt ? "Mark not done" : "Mark done"}
                onClick={() =>
                  startTransition(async () => {
                    setOptimistic({ id: item.id, done: !item.doneAt });
                    await (mode === "team" ? setActionItemDone(item.id, !item.doneAt) : setMyActionItemDone(item.id, !item.doneAt));
                  })
                }
                className="mt-0.5 disabled:cursor-default"
              >
                {item.doneAt ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Circle className={`h-4 w-4 ${canTick ? "text-slate-300" : "text-slate-200"}`} />}
              </button>
              <div className="min-w-0 flex-1 text-sm">
                <span className={item.doneAt ? "text-slate-400 line-through" : "text-slate-800"}>{item.text}</span>
                <span className={`ml-2 rounded px-1 text-[10px] font-semibold uppercase ${item.assignee === "client" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
                  {item.assignee === "client" ? (mode === "client" ? "You" : "Client") : mode === "client" ? "Our team" : "Agency"}
                </span>
              </div>
              {mode === "team" && (
                <span className="flex shrink-0 items-center gap-1">
                  {item.taskId ? (
                    <Link href={`/tasks/${item.taskId}`} className="text-xs font-medium text-indigo-600 hover:underline">Task <ArrowRight className="inline h-3 w-3" /></Link>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => startTransition(async () => setError((await convertActionItemToTask(item.id)).error ?? null))}
                      className="btn-ghost px-1.5 py-0.5 text-xs"
                    >
                      Make task
                    </button>
                  )}
                  <button type="button" disabled={pending} onClick={() => startTransition(() => deleteActionItem(item.id))} className="btn-ghost p-1 text-slate-400 hover:text-red-600" aria-label="Delete action item">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {mode === "team" && (
        <form action={addActionItem.bind(null, meetingId)} className="flex flex-wrap gap-2">
          <input name="text" required maxLength={1000} placeholder="Add an action item…" className="input min-w-[180px] flex-1" />
          <select name="assignee" defaultValue="agency" className="input w-auto">
            <option value="agency">Agency</option>
            <option value="client">Client</option>
          </select>
          <button type="submit" className="btn-secondary"><Plus className="h-4 w-4" /> Add</button>
        </form>
      )}
    </div>
  );
}
