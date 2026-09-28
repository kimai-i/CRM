import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { getLookups, getTaskRows } from "@/lib/queries";
import { toDateString } from "@/lib/dates";
import { PageHeader } from "@/components/ui";
import { TaskBoard } from "@/components/task-board";

export const metadata: Metadata = { title: "Team To-Do's" };

export default async function TeamTodosPage() {
  const user = await requireStaff();
  const [tasks, lookups] = await Promise.all([getTaskRows(), getLookups()]);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Team To-Do's" subtitle="Every task across the team. Filter, group and sort to slice it any way." />
      <TaskBoard tasks={tasks} lookups={lookups} today={toDateString(new Date())} currentUserId={user.id} defaultGroup="owner" />
    </div>
  );
}
