import type { Metadata } from "next";
import { requireClientUser } from "@/lib/auth";
import { getBudgets } from "@/lib/budget-queries";
import { SPEND_CHANNEL_LABEL } from "@/lib/metrics";
import { timeAgo } from "@/lib/labels";
import { EmptyState } from "@/components/ui";
import { RequestBudgetChange } from "./request-change";

export const metadata: Metadata = { title: "Ad Budgets" };

const money = (n: number | null) => (n === null ? "Not set" : `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`);

export default async function PortalBudgetsPage() {
  const viewer = await requireClientUser();
  const rows = await getBudgets(viewer.clientId);
  const total = rows.reduce((s, r) => s + (r.monthlyBudget ?? 0), 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Ad Budgets</h1>
        <p className="mt-1 text-sm text-slate-500">What you&apos;ve authorized us to spend across paid channels.</p>
      </div>
      {rows.length === 0 ? (
        <EmptyState>No ad budgets set yet.</EmptyState>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {rows.map((r) => (
              <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="text-sm font-semibold text-slate-900">{SPEND_CHANNEL_LABEL[r.channel]}</div>
                <dl className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-xs text-slate-500">Monthly budget</dt>
                    <dd className="text-2xl font-semibold text-slate-900">{money(r.monthlyBudget)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Daily budget</dt>
                    <dd className="text-2xl font-semibold text-slate-900">{money(r.dailyBudget)}</dd>
                  </div>
                </dl>
                {r.notes && <p className="mt-3 text-sm text-slate-600">{r.notes}</p>}
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <span>Updated {timeAgo(r.updatedAt)}{r.updatedBy ? ` by ${r.updatedBy}` : ""}</span>
                  <RequestBudgetChange channel={r.channel} channelLabel={SPEND_CHANNEL_LABEL[r.channel]} current={r.monthlyBudget} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-600">
            Total monthly authorized across paid channels: <strong>${total.toLocaleString("en-US", { maximumFractionDigits: 2 })}</strong>
          </p>
        </>
      )}
    </div>
  );
}
