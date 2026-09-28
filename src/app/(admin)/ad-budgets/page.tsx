import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { getLookups } from "@/lib/queries";
import { getBudgets } from "@/lib/budget-queries";
import { toDateString } from "@/lib/dates";
import { PageHeader } from "@/components/ui";
import { BudgetTable } from "./budget-client";

export const metadata: Metadata = { title: "Ad Budgets" };

export default async function AdBudgetsPage() {
  await requireStaff();
  const [rows, lookups] = await Promise.all([getBudgets(), getLookups()]);
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Ad Budgets"
        subtitle="What each client has authorized you to spend on each paid channel. Clients see these numbers (read-only) in their portal and can request changes."
      />
      <BudgetTable rows={rows} clients={lookups.clients} today={toDateString(new Date())} />
    </div>
  );
}
