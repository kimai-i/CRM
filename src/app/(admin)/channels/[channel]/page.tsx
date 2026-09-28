import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { getLookups, getTaskRows } from "@/lib/queries";
import { findChannel } from "@/lib/channels";
import { toDateString } from "@/lib/dates";
import { PageHeader } from "@/components/ui";
import { TaskBoard } from "@/components/task-board";

export async function generateMetadata({ params }: PageProps<"/channels/[channel]">): Promise<Metadata> {
  const { channel } = await params;
  return { title: findChannel(channel)?.title ?? "Channel" };
}

export default async function ChannelPage({ params }: PageProps<"/channels/[channel]">) {
  const { channel: slug } = await params;
  const channel = findChannel(slug);
  if (!channel) notFound();

  const user = await requireStaff();
  const [tasks, lookups] = await Promise.all([getTaskRows({ serviceKeys: channel.serviceKeys }), getLookups()]);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title={channel.title} subtitle={channel.subtitle} />
      <TaskBoard
        key={channel.slug}
        tasks={tasks}
        lookups={lookups}
        today={toDateString(new Date())}
        currentUserId={user.id}
        defaultGroup={channel.defaultGroup}
        allowedServiceKeys={channel.serviceKeys}
      />
    </div>
  );
}
