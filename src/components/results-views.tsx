// Marketing Results sections shared by the admin page and the client portal.
import Link from "next/link";
import { Lightbulb } from "lucide-react";
import type { ResultsData } from "@/lib/results-queries";
import { RESULT_WINDOWS, type ResultWindow } from "@/lib/metrics";
import { LEAD_SOURCE_COLOR, LEAD_SOURCE_LABEL } from "@/lib/leads";
import { Card } from "@/components/ui";

export const money = (n: number | null, decimals = 0) =>
  n === null ? "—" : `$${n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)}%`);
const ratio = (n: number | null) => (n === null ? "—" : `${n.toFixed(1)}×`);

export function ResultWindowBar({ window, hrefFor }: { window: ResultWindow; hrefFor: (w: ResultWindow) => string }) {
  return (
    <div className="flex flex-wrap gap-1">
      {(Object.keys(RESULT_WINDOWS) as ResultWindow[]).map((w) => (
        <Link
          key={w}
          href={hrefFor(w)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium ${window === w ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
        >
          {RESULT_WINDOWS[w]}
        </Link>
      ))}
    </div>
  );
}

export function ResultsSummary({ data, audience }: { data: ResultsData; audience: "team" | "client" }) {
  const t = data.results.totals;
  const noSpend = t.spend === 0;
  const trendMax = Math.max(1, ...data.trend.map((m) => Math.max(m.spend, m.revenue)));

  return (
    <div className="space-y-6">
      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Ad spend" value={money(t.spend)} sub={noSpend ? "No spend entered for this period" : `${t.paidLeads} leads from paid ads`} />
        <Kpi label="Cost per lead" value={money(t.costPerPaidLead)} sub={noSpend ? "Needs ad spend" : "Ad spend ÷ paid-ad leads"} />
        <Kpi label="Cost per booked job" value={money(t.costPerPaidBooked)} sub={noSpend ? "Needs ad spend" : `${t.paidBooked} booked from paid ads`} />
        <Kpi
          label="Return on ad spend"
          value={ratio(t.roas)}
          sub={t.roas === null ? "Needs ad spend" : `${money(t.paidRevenue)} booked from ads`}
          tone={t.roas === null ? undefined : t.roas >= 3 ? "good" : t.roas < 1 ? "bad" : undefined}
        />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="All leads" value={String(t.leads)} sub="Every source, spam excluded" />
        <Kpi label="Booked jobs" value={String(t.booked)} sub={`${pct(t.bookRate)} of leads booked`} />
        <Kpi label="Booked revenue" value={money(t.revenue)} sub={t.avgTicket === null ? "From lead values" : `Average job ${money(t.avgTicket)}`} />
        <Kpi label="Revenue per ad dollar" value={ratio(t.blendedRoas)} sub="All booked revenue ÷ ad spend" />
      </div>

      {data.jobs && (
        <Card title="Jobs & revenue (by job date)">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <MiniStat label="Job revenue" value={money(data.jobs.revenue)} sub={`${data.jobs.jobs} scheduled or completed job${data.jobs.jobs === 1 ? "" : "s"}`} />
            <MiniStat label="Average job" value={money(data.jobs.avgTicket)} sub="Revenue ÷ jobs" />
            <MiniStat
              label="Traced to a lead"
              value={data.jobs.matchRate === null ? "—" : `${Math.round(data.jobs.matchRate * 100)}%`}
              sub={`${money(data.jobs.matchedRevenue)} matched · ${money(data.jobs.unmatchedRevenue)} not`}
            />
            <MiniStat label="Open estimates" value={money(data.jobs.estimateValue)} sub={`${data.jobs.openEstimates} estimate${data.jobs.openEstimates === 1 ? "" : "s"} this period`} />
            <MiniStat label="Balance due" value={money(data.jobs.outstanding)} sub="Billed but not yet paid (all time)" />
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Jobs are matched to leads by phone, email, or name + ZIP within 180 days. Matched job totals replace typed-in lead values in the
            numbers above. Unmatched revenue usually means repeat customers, referrals, or calls that weren&apos;t tracked.
          </p>
        </Card>
      )}

      {t.potentialFromOpen !== null && t.openLeads > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <p>
            <strong>{money(t.potentialFromOpen)}</strong> is still on the table: {t.openLeads} open lead{t.openLeads === 1 ? "" : "s"} haven&apos;t booked yet
            (estimated at the average job value of {money(t.avgTicket)}).
            {audience === "client" ? " Following up quickly is the fastest way to win these." : " Worth a follow-up push."}
          </p>
        </div>
      )}

      {/* Channel table */}
      <Card title="Performance by channel">
        {data.results.channels.length === 0 ? (
          <p className="text-sm text-slate-500">No leads or spend in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="py-2 font-medium">Channel</th>
                  <th className="py-2 text-right font-medium">Spend</th>
                  <th className="py-2 text-right font-medium">Leads</th>
                  <th className="py-2 text-right font-medium">Booked</th>
                  <th className="py-2 text-right font-medium">Book rate</th>
                  <th className="py-2 text-right font-medium">Revenue</th>
                  <th className="py-2 text-right font-medium">Cost / lead</th>
                  <th className="py-2 text-right font-medium">Cost / booked</th>
                  <th className="py-2 text-right font-medium">ROAS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.results.channels.map((c) => (
                  <tr key={c.source}>
                    <td className="py-2">
                      <span className="flex items-center gap-2 text-slate-800">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: LEAD_SOURCE_COLOR[c.source] }} />
                        {LEAD_SOURCE_LABEL[c.source]}
                      </span>
                    </td>
                    <td className="py-2 text-right text-slate-700">{c.spend > 0 ? money(c.spend) : "—"}</td>
                    <td className="py-2 text-right font-medium text-slate-900">{c.leads}</td>
                    <td className="py-2 text-right text-slate-700">{c.booked}</td>
                    <td className="py-2 text-right text-slate-700">{pct(c.bookRate)}</td>
                    <td className="py-2 text-right text-slate-700">{c.revenue ? money(c.revenue) : "—"}</td>
                    <td className="py-2 text-right text-slate-700">{money(c.costPerLead)}</td>
                    <td className="py-2 text-right text-slate-700">{money(c.costPerBooked)}</td>
                    <td className={`py-2 text-right font-medium ${c.roas === null ? "text-slate-400" : c.roas >= 3 ? "text-green-600" : c.roas < 1 ? "text-red-600" : "text-slate-800"}`}>
                      {ratio(c.roas)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-slate-400">
          Revenue is the matched job totals for each lead (or the value typed on the lead when no job matched), credited to the date the lead came in.
          ROAS = revenue ÷ spend for that channel; 3× or more is healthy for most home-service businesses.
          Organic, referral and other free channels show leads and revenue but no cost.
        </p>
      </Card>

      {/* Trend */}
      <Card title="Last 6 months — ad spend vs. booked revenue">
        <div className="flex h-44 items-end gap-3">
          {data.trend.map((m) => (
            <div key={m.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <div className="flex h-full w-full items-end justify-center gap-1">
                <div className="w-1/3 rounded-t bg-slate-300" style={{ height: `${(m.spend / trendMax) * 100}%` }} title={`Spend ${money(m.spend)}`} />
                <div className="w-1/3 rounded-t bg-green-500" style={{ height: `${(m.revenue / trendMax) * 100}%` }} title={`Revenue ${money(m.revenue)}`} />
              </div>
              <span className="text-[11px] text-slate-500">{m.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-slate-300" />Ad spend</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-green-500" />Booked revenue</span>
        </div>
      </Card>
    </div>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-0.5 text-xl font-semibold text-slate-900">{value}</div>
      <div className="text-[11px] text-slate-400">{sub}</div>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone === "good" ? "text-green-600" : tone === "bad" ? "text-red-600" : "text-slate-900"}`}>{value}</div>
      <div className="mt-1 text-xs text-slate-500">{sub}</div>
    </div>
  );
}
