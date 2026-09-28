import type { Metadata } from "next";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { requireClientUser } from "@/lib/auth";
import { dueLabel, toDateString } from "@/lib/dates";
import { EmptyState } from "@/components/ui";
import { TodoItem } from "./todo-item";

export const metadata: Metadata = { title: "To-Do" };

export default async function PortalTodoPage() {
  const viewer = await requireClientUser();
  const today = toDateString(new Date());
  const rows = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.clientId, viewer.clientId), eq(tasks.assigneeType, "client"), eq(tasks.clientVisible, true)))
    .orderBy(desc(tasks.createdAt));
  const open = rows.filter((t) => t.status !== "done").sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  const done = rows.filter((t) => t.status === "done").slice(0, 20);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">To-Do</h1>
        <p className="mt-1 text-sm text-slate-500">Things your team needs from you. Tick them off when they&apos;re done.</p>
      </div>
      {open.length === 0 ? (
        <EmptyState>Nothing on your list right now. Tasks your team assigns to you will show up here.</EmptyState>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {open.map((t) => {
            const due = dueLabel(t.dueDate, today);
            return <TodoItem key={t.id} id={t.id} title={t.title} description={t.description} done={false} dueText={t.dueDate ? due.text : null} overdue={due.overdue} />;
          })}
        </ul>
      )}
      {done.length > 0 && (
        <details className="rounded-xl border border-slate-200 bg-white">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900">Done ({done.length})</summary>
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {done.map((t) => <TodoItem key={t.id} id={t.id} title={t.title} description={null} done dueText={null} overdue={false} />)}
          </ul>
        </details>
      )}
    </div>
  );
}
