import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft, Trash2 } from "lucide-react";
import { db } from "@/db";
import { meetings } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { getLookups } from "@/lib/queries";
import { getActionItems } from "@/lib/meeting-queries";
import { Card } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { deleteMeeting } from "../actions";
import { EditMeetingForm } from "../meeting-form";
import { ActionItems } from "../action-items";

export const metadata: Metadata = { title: "Meeting" };

export default async function MeetingPage({ params }: PageProps<"/meetings/[id]">) {
  const { id } = await params;
  await requireStaff();
  const [[meeting], lookups, items] = await Promise.all([
    db.select().from(meetings).where(eq(meetings.id, id)),
    getLookups(),
    getActionItems([id]),
  ]);
  if (!meeting) notFound();

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/meetings" className="btn-ghost -ml-2"><ArrowLeft className="h-4 w-4" /> All meetings</Link>
        <form action={deleteMeeting.bind(null, id)}>
          <ConfirmButton className="btn-danger" message="Delete this meeting and its action items?">
            <Trash2 className="h-4 w-4" /> Delete meeting
          </ConfirmButton>
        </form>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Meeting" className="lg:col-span-2">
          <EditMeetingForm
            id={id}
            clients={lookups.clients}
            defaults={{
              title: meeting.title,
              clientId: meeting.clientId,
              startsAt: meeting.startsAt,
              durationMin: meeting.durationMin,
              attendees: meeting.attendees,
              summary: meeting.summary,
              internalNotes: meeting.internalNotes,
              visibility: meeting.visibility,
              recordingUrl: meeting.recordingUrl,
            }}
          />
        </Card>
        <Card title="Action items">
          <ActionItems meetingId={id} items={items.get(id) ?? []} mode="team" />
          <p className="mt-4 text-xs text-slate-400">
            Client items show in their portal when the meeting is shared. &ldquo;Make task&rdquo; adds it to the client&apos;s task list.
          </p>
        </Card>
      </div>
    </div>
  );
}
