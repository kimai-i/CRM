import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ArrowLeft, Play, Trash2 } from "lucide-react";
import { db } from "@/db";
import { clients, taskComments, tasks, users } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { getLookups } from "@/lib/queries";
import { getTaskMinutes } from "@/lib/time-queries";
import { formatMinutes } from "@/lib/time";
import { startTimerForTask } from "../../time/actions";
import { timeAgo } from "@/lib/labels";
import { Avatar, Card } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { addComment, addSubtask, deleteTask } from "../actions";
import { TaskDetailsForm, SubtaskItem } from "./task-detail-client";

export const metadata: Metadata = { title: "Task" };

export default async function TaskPage({ params }: PageProps<"/tasks/[id]">) {
  const { id } = await params;
  await requireStaff();

  const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!task) notFound();

  const [lookups, subtasks, comments, [client], parent, loggedMinutes] = await Promise.all([
    getLookups(),
    db.select().from(tasks).where(eq(tasks.parentId, id)).orderBy(asc(tasks.createdAt)),
    db.select({ comment: taskComments, author: users })
      .from(taskComments)
      .leftJoin(users, eq(taskComments.authorId, users.id))
      .where(eq(taskComments.taskId, id))
      .orderBy(asc(taskComments.createdAt)),
    db.select().from(clients).where(eq(clients.id, task.clientId)),
    task.parentId ? db.select().from(tasks).where(eq(tasks.id, task.parentId)).then((r) => r[0]) : Promise.resolve(undefined),
    getTaskMinutes(id),
  ]);

  const backHref = parent ? `/tasks/${parent.id}` : `/clients/${task.clientId}`;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center justify-between">
        <Link href={backHref} className="btn-ghost -ml-2">
          <ArrowLeft className="h-4 w-4" /> {parent ? `Back to "${parent.title}"` : `Back to ${client?.name ?? "client"}`}
        </Link>
        <div className="flex gap-2">
        <form action={startTimerForTask.bind(null, task.id)}>
          <button type="submit" className="btn-secondary" title="Start a time-tracking timer on this task">
            <Play className="h-4 w-4" /> Start timer
          </button>
        </form>
        <form action={deleteTask.bind(null, task.id, backHref)}>
          <ConfirmButton className="btn-danger" message="Delete this task and its subtasks? This can't be undone.">
            <Trash2 className="h-4 w-4" /> Delete task
          </ConfirmButton>
        </form>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Task details">
            <TaskDetailsForm
              taskId={task.id}
              lookups={lookups}
              defaults={{
                title: task.title,
                description: task.description,
                clientId: task.clientId,
                serviceKey: task.serviceKey,
                ownerId: task.ownerId,
                status: task.status,
                priority: task.priority,
                dueDate: task.dueDate,
                estHours: task.estHours,
                clientVisible: task.clientVisible,
                assigneeType: task.assigneeType,
              }}
            />
          </Card>

          <Card title={`Comments (${comments.length})`}>
            {comments.length > 0 && (
              <ul className="mb-4 space-y-4">
                {comments.map(({ comment, author }) => (
                  <li key={comment.id} className="flex gap-3">
                    {author ? <Avatar initials={author.initials} color={author.color} size="sm" /> : <Avatar initials="?" color="#94a3b8" size="sm" />}
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-slate-500">
                        <span className="font-medium text-slate-800">{author?.name ?? "Deleted user"}</span> · {timeAgo(comment.createdAt)}
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{comment.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <form action={addComment.bind(null, task.id)} className="space-y-2">
              <textarea name="body" rows={2} required placeholder="Write a comment…" className="input" />
              <div className="flex justify-end">
                <button type="submit" className="btn-secondary">Post comment</button>
              </div>
            </form>
          </Card>
        </div>

        <div className="space-y-6">
          {!task.parentId && (
            <Card title={`Subtasks (${subtasks.filter((s) => s.status === "done").length}/${subtasks.length})`}>
              {subtasks.length > 0 && (
                <ul className="mb-3 space-y-1">
                  {subtasks.map((s) => (
                    <SubtaskItem key={s.id} id={s.id} title={s.title} done={s.status === "done"} />
                  ))}
                </ul>
              )}
              <form action={addSubtask.bind(null, task.id)} className="flex gap-2">
                <input name="title" required placeholder="Add a subtask…" className="input" />
                <button type="submit" className="btn-secondary">Add</button>
              </form>
            </Card>
          )}

          <Card title="Info">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Client</dt><dd><Link href={`/clients/${task.clientId}`} className="font-medium text-indigo-600 hover:underline">{client?.name}</Link></dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Time logged</dt><dd className="font-mono text-slate-700">{formatMinutes(loggedMinutes)}{task.estHours ? <span className="font-sans text-slate-400"> of {task.estHours}h est.</span> : null}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Created</dt><dd className="text-slate-700">{timeAgo(task.createdAt)}</dd></div>
              {task.completedAt && <div className="flex justify-between"><dt className="text-slate-500">Completed</dt><dd className="text-slate-700">{timeAgo(task.completedAt)}</dd></div>}
              {task.isRoutine && <div className="flex justify-between"><dt className="text-slate-500">Type</dt><dd className="text-slate-700">Routine</dd></div>}
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
