"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { adBudgets, clients, requests, SPEND_CHANNELS } from "@/db/schema";
import { requireClientUser, requireStaff } from "@/lib/auth";
import { parseMoney } from "@/lib/leads";
import { SPEND_CHANNEL_LABEL } from "@/lib/metrics";

export type BudgetState = { ok?: boolean; error?: string };

const budgetSchema = z.object({
  clientId: z.string().min(1, "Pick a client."),
  channel: z.enum(SPEND_CHANNELS),
  monthlyBudget: z.string().optional(),
  dailyBudget: z.string().optional(),
  notes: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(1000).nullable()),
  reviewDueOn: z.preprocess((v) => (v === "" ? null : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()),
});

/** Adds or updates the budget for one client + channel. */
export async function saveBudget(_prev: BudgetState, formData: FormData): Promise<BudgetState> {
  const user = await requireStaff();
  const parsed = budgetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const monthly = d.monthlyBudget ? parseMoney(d.monthlyBudget) : null;
  const daily = d.dailyBudget ? parseMoney(d.dailyBudget) : null;
  if ((d.monthlyBudget && monthly === null) || (d.dailyBudget && daily === null)) return { error: "Enter budgets as numbers, like 3500." };
  if ((monthly ?? 0) < 0 || (daily ?? 0) < 0) return { error: "Budgets can't be negative." };
  if (monthly === null && daily === null) return { error: "Enter a monthly or daily budget." };

  const [client] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, d.clientId));
  if (!client) return { error: "That client no longer exists." };

  const values = { monthlyBudget: monthly, dailyBudget: daily, notes: d.notes, reviewDueOn: d.reviewDueOn, updatedById: user.id, updatedAt: new Date().toISOString() };
  await db
    .insert(adBudgets)
    .values({ id: randomUUID(), clientId: d.clientId, channel: d.channel, ...values })
    .onConflictDoUpdate({ target: [adBudgets.clientId, adBudgets.channel], set: values });
  refresh();
  return { ok: true };
}

export async function deleteBudget(id: string) {
  await requireStaff();
  await db.delete(adBudgets).where(eq(adBudgets.id, id));
  refresh();
}

const changeSchema = z.object({
  channel: z.enum(SPEND_CHANNELS),
  amount: z.string().min(1, "Enter the new monthly budget."),
  reason: z.preprocess((v) => (v === "" ? null : v), z.string().max(2000).nullable()),
});

/** Client portal: asks the team for a budget change (lands in Requests). */
export async function requestBudgetChange(_prev: BudgetState, formData: FormData): Promise<BudgetState> {
  const viewer = await requireClientUser();
  const parsed = changeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const amount = parseMoney(parsed.data.amount);
  if (amount === null || amount < 0) return { error: "Enter the amount as a number, like 4000." };

  await db.insert(requests).values({
    id: randomUUID(),
    clientId: viewer.clientId,
    submittedById: viewer.id,
    type: "budget_change",
    title: `Change ${SPEND_CHANNEL_LABEL[parsed.data.channel]} budget to $${amount.toLocaleString("en-US")}/month`,
    body: parsed.data.reason,
    status: "open",
    createdAt: new Date().toISOString(),
  });
  refresh();
  return { ok: true };
}
