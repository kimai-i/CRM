import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { recurringTemplates } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { getLookups } from "@/lib/queries";
import { parseWeekdays } from "@/lib/recurrence";
import { PRESETS } from "@/lib/recurring-presets";
import { PageHeader } from "@/components/ui";
import { RecurringBoard, type TemplateView } from "./recurring-client";

export const metadata: Metadata = { title: "Recurring" };

export default async function RecurringPage() {
  await requireStaff();
  const [rows, lookups] = await Promise.all([
    db.select().from(recurringTemplates).orderBy(asc(recurringTemplates.title)),
    getLookups(),
  ]);

  const templates: TemplateView[] = rows.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    clientId: t.clientId,
    serviceKey: t.serviceKey,
    ownerId: t.ownerId,
    priority: t.priority,
    estHours: t.estHours,
    clientVisible: t.clientVisible,
    frequency: t.frequency,
    interval: t.interval,
    weekdays: parseWeekdays(t.weekdays),
    dayOfMonth: t.dayOfMonth,
    startsOn: t.startsOn,
    nextDueOn: t.nextDueOn,
    leadDays: t.leadDays,
    active: t.active,
  }));

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Recurring"
        subtitle="Routines that create real tasks on schedule — weekly checks, monthly reports, quarterly audits. New tasks appear on the due date (or a few days early, if you set lead days)."
      />
      <RecurringBoard
        templates={templates}
        lookups={lookups}
        presets={PRESETS.map((p) => ({ key: p.key, name: p.name, serviceKey: p.serviceKey, titles: p.templates.map((t) => t.title) }))}
      />
    </div>
  );
}
