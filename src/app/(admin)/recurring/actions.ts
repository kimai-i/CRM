"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { clientOwners, clients, recurringTemplates, services, TASK_PRIORITIES } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { toDateString } from "@/lib/dates";
import { firstOccurrenceOnOrAfter, REPEAT_OPTIONS, type Schedule } from "@/lib/recurrence";
import { materializeRecurring, type RunResult } from "@/lib/recurring";
import { findPreset } from "@/lib/recurring-presets";

const emptyToNull = (v: unknown) => (v === "" || v === undefined ? null : v);

const templateSchema = z.object({
  title: z.string().trim().min(1, "Give the routine a title.").max(300),
  description: z.preprocess(emptyToNull, z.string().max(10_000).nullable()),
  clientId: z.string().min(1, "Pick a client."),
  serviceKey: z.string().min(1, "Pick a channel."),
  ownerId: z.preprocess(emptyToNull, z.string().nullable()),
  priority: z.enum(TASK_PRIORITIES),
  estHours: z.preprocess(emptyToNull, z.coerce.number().min(0).max(1000).nullable()),
  clientVisible: z.boolean(),
  repeat: z.enum(REPEAT_OPTIONS.map((o) => o.key) as [string, ...string[]]),
  weekdays: z.array(z.coerce.number().int().min(0).max(6)),
  dayOfMonth: z.preprocess(emptyToNull, z.coerce.number().int().min(-1).max(31).nullable()),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a start date."),
  leadDays: z.coerce.number().int().min(0, "Lead days can't be negative.").max(60),
});

export type TemplateFormState = { ok?: boolean; error?: string; created?: number };

const laterOf = (a: string, b: string) => (a > b ? a : b);

export async function saveTemplate(id: string | null, _prev: TemplateFormState, formData: FormData): Promise<TemplateFormState> {
  await requireStaff();
  const parsed = templateSchema.safeParse({
    ...Object.fromEntries(formData),
    clientVisible: formData.get("clientVisible") === "on",
    weekdays: formData.getAll("weekdays"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const repeat = REPEAT_OPTIONS.find((o) => o.key === d.repeat)!;
  if (repeat.frequency === "weekly" && d.weekdays.length === 0) return { error: "Pick at least one day of the week." };
  if (repeat.frequency === "monthly" && (d.dayOfMonth === null || d.dayOfMonth === 0)) return { error: "Pick a day of the month." };

  const schedule: Schedule = {
    frequency: repeat.frequency,
    interval: repeat.interval,
    weekdays: repeat.frequency === "weekly" ? [...new Set(d.weekdays)].sort() : [],
    dayOfMonth: repeat.frequency === "monthly" ? d.dayOfMonth : null,
    startsOn: d.startsOn,
  };
  const nextDueOn = firstOccurrenceOnOrAfter(schedule, laterOf(d.startsOn, toDateString(new Date())));
  if (!nextDueOn) return { error: "That schedule never comes up. Check the days you picked." };

  const values = {
    title: d.title,
    description: d.description,
    clientId: d.clientId,
    serviceKey: d.serviceKey,
    ownerId: d.ownerId,
    priority: d.priority,
    estHours: d.estHours,
    clientVisible: d.clientVisible,
    frequency: schedule.frequency,
    interval: schedule.interval,
    weekdays: schedule.weekdays.length ? schedule.weekdays.join(",") : null,
    dayOfMonth: schedule.dayOfMonth,
    startsOn: d.startsOn,
    nextDueOn,
    leadDays: d.leadDays,
  };

  const templateId = id ?? randomUUID();
  if (id) {
    await db.update(recurringTemplates).set(values).where(eq(recurringTemplates.id, id));
  } else {
    await db.insert(recurringTemplates).values({ id: templateId, ...values, active: true, createdAt: new Date().toISOString() });
  }
  // Create anything that's already due, so the change shows up right away.
  const run = await materializeRecurring({ templateIds: [templateId] });
  refresh();
  return { ok: true, created: run.created };
}

export async function setTemplateActive(id: string, active: boolean) {
  await requireStaff();
  const [t] = await db.select().from(recurringTemplates).where(eq(recurringTemplates.id, id));
  if (!t) return;
  let nextDueOn = t.nextDueOn;
  if (active) {
    // Resuming picks up from today instead of catching up on everything missed while paused.
    const schedule: Schedule = {
      frequency: t.frequency,
      interval: t.interval,
      weekdays: t.weekdays ? t.weekdays.split(",").map(Number) : [],
      dayOfMonth: t.dayOfMonth,
      startsOn: t.startsOn,
    };
    nextDueOn = firstOccurrenceOnOrAfter(schedule, laterOf(t.startsOn, toDateString(new Date()))) ?? t.nextDueOn;
  }
  await db.update(recurringTemplates).set({ active, nextDueOn }).where(eq(recurringTemplates.id, id));
  if (active) await materializeRecurring({ templateIds: [id] });
  refresh();
}

/** Deletes the routine. Tasks it already created are kept. */
export async function deleteTemplate(id: string) {
  await requireStaff();
  await db.delete(recurringTemplates).where(eq(recurringTemplates.id, id));
  refresh();
}

export async function runRecurringNow(): Promise<RunResult> {
  await requireStaff();
  const result = await materializeRecurring();
  refresh();
  return result;
}

export type PresetState = { ok?: boolean; error?: string; added?: number; skipped?: number; created?: number };

export async function applyPreset(_prev: PresetState, formData: FormData): Promise<PresetState> {
  await requireStaff();
  const clientId = String(formData.get("clientId") ?? "");
  const preset = findPreset(String(formData.get("presetKey") ?? ""));
  const ownerId = String(formData.get("ownerId") ?? "") || null;
  if (!preset) return { error: "Pick a preset." };

  const [client] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, clientId));
  if (!client) return { error: "Pick a client." };
  const [service] = await db.select({ key: services.key }).from(services).where(eq(services.key, preset.serviceKey));
  if (!service) return { error: "This preset's channel doesn't exist." };

  // Default owner: the one picked, else the client's first account owner.
  const [firstOwner] = await db.select({ userId: clientOwners.userId }).from(clientOwners).where(eq(clientOwners.clientId, clientId)).limit(1);
  const owner = ownerId ?? firstOwner?.userId ?? null;

  const existingTitles = new Set(
    (await db
      .select({ title: recurringTemplates.title })
      .from(recurringTemplates)
      .where(and(eq(recurringTemplates.clientId, clientId), eq(recurringTemplates.serviceKey, preset.serviceKey))))
      .map((r) => r.title.toLowerCase()),
  );

  const today = toDateString(new Date());
  const now = new Date().toISOString();
  const ids: string[] = [];
  let skipped = 0;

  for (const p of preset.templates) {
    if (existingTitles.has(p.title.toLowerCase())) {
      skipped++;
      continue;
    }
    const schedule: Schedule = {
      frequency: p.frequency,
      interval: p.interval,
      weekdays: p.weekdays ?? [],
      dayOfMonth: p.dayOfMonth ?? null,
      startsOn: today,
    };
    const nextDueOn = firstOccurrenceOnOrAfter(schedule, today);
    if (!nextDueOn) continue;
    const id = randomUUID();
    ids.push(id);
    await db.insert(recurringTemplates).values({
      id,
      clientId,
      serviceKey: preset.serviceKey,
      ownerId: owner,
      title: p.title,
      priority: p.priority,
      estHours: p.estHours,
      clientVisible: p.clientVisible ?? true,
      frequency: p.frequency,
      interval: p.interval,
      weekdays: p.weekdays?.join(",") ?? null,
      dayOfMonth: p.dayOfMonth ?? null,
      startsOn: today,
      nextDueOn,
      leadDays: p.leadDays ?? 0,
      active: true,
      presetKey: preset.key,
      createdAt: now,
    });
  }

  const run = ids.length ? await materializeRecurring({ templateIds: ids }) : { created: 0 };
  refresh();
  return { ok: true, added: ids.length, skipped, created: run.created };
}
