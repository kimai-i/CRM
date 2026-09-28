import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { adBudgets, clients, users, type SpendChannel } from "@/db/schema";

export type BudgetRow = {
  id: string;
  clientId: string;
  clientName: string;
  clientColor: string;
  channel: SpendChannel;
  monthlyBudget: number | null;
  dailyBudget: number | null;
  notes: string | null;
  reviewDueOn: string | null;
  updatedAt: string;
  updatedBy: string | null;
};

export async function getBudgets(clientId?: string): Promise<BudgetRow[]> {
  const rows = await db
    .select({
      id: adBudgets.id,
      clientId: adBudgets.clientId,
      clientName: clients.name,
      clientColor: clients.color,
      channel: adBudgets.channel,
      monthlyBudget: adBudgets.monthlyBudget,
      dailyBudget: adBudgets.dailyBudget,
      notes: adBudgets.notes,
      reviewDueOn: adBudgets.reviewDueOn,
      updatedAt: adBudgets.updatedAt,
      updatedBy: users.name,
    })
    .from(adBudgets)
    .innerJoin(clients, eq(adBudgets.clientId, clients.id))
    .leftJoin(users, eq(adBudgets.updatedById, users.id))
    .where(clientId ? eq(adBudgets.clientId, clientId) : undefined)
    .orderBy(asc(clients.name), asc(adBudgets.channel));
  return rows;
}
