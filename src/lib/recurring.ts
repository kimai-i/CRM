// Turns recurring templates into real tasks. Used by the app (daily, on first page view),
// the "Run now" button, and scripts. Safe to run any number of times.
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { appSettings, recurringTemplates, tasks, type RecurringTemplate } from "@/db/schema";
import { addDays, toDateString } from "@/lib/dates";
import { nextOccurrence, parseWeekdays, type Schedule } from "@/lib/recurrence";

const LAST_RUN_KEY = "recurring_last_run_on";
const MAX_STEPS_PER_TEMPLATE = 400;

export const scheduleOf = (t: RecurringTemplate): Schedule => ({
  frequency: t.frequency,
  interval: t.interval,
  weekdays: parseWeekdays(t.weekdays),
  dayOfMonth: t.dayOfMonth,
  startsOn: t.startsOn,
});

export type RunResult = { created: number; skippedMissed: number };

/**
 * For each active template, creates the tasks that are due (taking lead days into account).
 * If several occurrences were missed (e.g. nobody opened the app for weeks), only the most
 * recent one is created — older ones are skipped so the board doesn't fill with stale copies.
 */
export async function materializeRecurring(opts: { today?: string; templateIds?: string[] } = {}): Promise<RunResult> {
  const today = opts.today ?? toDateString(new Date());
  const templates = await db
    .select()
    .from(recurringTemplates)
    .where(
      opts.templateIds
        ? and(eq(recurringTemplates.active, true), inArray(recurringTemplates.id, opts.templateIds))
        : eq(recurringTemplates.active, true),
    );

  const result: RunResult = { created: 0, skippedMissed: 0 };
  const now = new Date().toISOString();

  for (const t of templates) {
    const schedule = scheduleOf(t);
    let due: string | null = t.nextDueOn;
    let steps = 0;

    while (due && addDays(due, -t.leadDays) <= today && steps++ < MAX_STEPS_PER_TEMPLATE) {
      const following = nextOccurrence(schedule, due);
      const missed = due < today && following !== null && following <= today;
      if (missed) {
        result.skippedMissed++;
      } else {
        const [existing] = await db
          .select({ id: tasks.id })
          .from(tasks)
          .where(and(eq(tasks.recurringTemplateId, t.id), eq(tasks.dueDate, due)));
        if (!existing) {
          const inserted = await db.insert(tasks).values({
            id: randomUUID(),
            clientId: t.clientId,
            serviceKey: t.serviceKey,
            ownerId: t.ownerId,
            title: t.title,
            description: t.description,
            status: "todo",
            priority: t.priority,
            dueDate: due,
            estHours: t.estHours,
            clientVisible: t.clientVisible,
            isRoutine: true,
            recurringTemplateId: t.id,
            createdAt: now,
          }).onConflictDoNothing().returning({ id: tasks.id });
          result.created += inserted.length;
        }
      }
      due = following;
    }

    if (due !== t.nextDueOn) {
      // A schedule with no future dates (shouldn't happen with valid input) is switched off.
      await db
        .update(recurringTemplates)
        .set(due ? { nextDueOn: due } : { active: false })
        .where(eq(recurringTemplates.id, t.id));
    }
  }

  if (!opts.templateIds) {
    await db
      .insert(appSettings)
      .values({ key: LAST_RUN_KEY, value: today })
      .onConflictDoUpdate({ target: appSettings.key, set: { value: today } });
  }
  return result;
}

/** Runs the daily materialization once per day — cheap to call on every page view. */
export async function runRecurringIfDue(): Promise<void> {
  const today = toDateString(new Date());
  const [last] = await db.select().from(appSettings).where(eq(appSettings.key, LAST_RUN_KEY));
  if (last?.value === today) return;
  await materializeRecurring({ today });
}
