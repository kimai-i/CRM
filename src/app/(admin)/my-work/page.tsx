import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { getLookups, getTaskRows } from "@/lib/queries";
import { toDateString } from "@/lib/dates";
import { PageHeader } from "@/components/ui";
import { TaskBoard } from "@/components/task-board";

export const metadata: Metadata = { title: "My Work" };

export default async function MyWorkPage() {
  const user = await requireStaff();
  const [tasks, lookups] = await Promise.all([getTaskRows({ ownerId: user.id }), getLookups()]);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="My Work" subtitle="Tasks assigned to you." />
      <TaskBoard
        tasks={tasks}
        lookups={lookups}
        today={toDateString(new Date())}
        currentUserId={user.id}
        defaults={{ ownerId: user.id }}
        defaultGroup="client"
      />
    </div>
  );
}
