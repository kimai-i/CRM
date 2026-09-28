// Marketing Results formulas. Pure functions — every number on the page comes from here.
// Dates are "YYYY-MM-DD" strings; ranges are inclusive.
import type { LeadSource, LeadStatus, SpendChannel } from "@/db/schema";
import { addDays, daysBetween } from "@/lib/dates";

export type DateRange = { start: string; end: string };

export type MetricLead = { source: LeadSource; status: LeadStatus; value: number | null; date: string };
export type MetricSpend = {
  channel: SpendChannel;
  periodStart: string;
  periodEnd: string;
  amount: number;
  clicks: number | null;
  impressions: number | null;
};

/** Which lead source a spend channel pays for. */
export const SPEND_CHANNEL_SOURCE: Record<SpendChannel, LeadSource> = {
  google_ads: "google_ads",
  meta_ads: "meta_ads",
  other: "other",
};

export const SPEND_CHANNEL_LABEL: Record<SpendChannel, string> = {
  google_ads: "Google Ads",
  meta_ads: "Meta Ads",
  other: "Other paid",
};

/** Share of a spend period that falls inside the range (0–1), spreading the amount evenly per day. */
export function overlapShare(periodStart: string, periodEnd: string, range: DateRange): number {
  const start = periodStart > range.start ? periodStart : range.start;
  const end = periodEnd < range.end ? periodEnd : range.end;
  if (start > end) return 0;
  const periodDays = daysBetween(periodStart, periodEnd) + 1;
  if (periodDays <= 0) return 0;
  return (daysBetween(start, end) + 1) / periodDays;
}

/** Spend (and clicks/impressions) attributed to the range, prorated by day. */
export function spendInRange(rows: MetricSpend[], range: DateRange) {
  let amount = 0;
  let clicks = 0;
  let impressions = 0;
  for (const r of rows) {
    const share = overlapShare(r.periodStart, r.periodEnd, range);
    if (share === 0) continue;
    amount += r.amount * share;
    clicks += (r.clicks ?? 0) * share;
    impressions += (r.impressions ?? 0) * share;
  }
  return { amount, clicks: Math.round(clicks), impressions: Math.round(impressions) };
}

const safeDiv = (a: number, b: number): number | null => (b > 0 ? a / b : null);
const isReal = (s: LeadStatus) => s === "open" || s === "booked";

export type ChannelRow = {
  source: LeadSource;
  spend: number;
  leads: number;
  booked: number;
  bookRate: number | null; // booked ÷ leads
  revenue: number; // sum of booked lead values
  costPerLead: number | null; // spend ÷ leads
  costPerBooked: number | null; // spend ÷ booked
  roas: number | null; // revenue ÷ spend
};

export function computeResults(input: { leads: MetricLead[]; spend: MetricSpend[]; range: DateRange }) {
  const { range } = input;
  const inRange = input.leads.filter((l) => l.date >= range.start && l.date <= range.end && isReal(l.status));
  const booked = inRange.filter((l) => l.status === "booked");
  const revenue = booked.reduce((s, l) => s + (l.value ?? 0), 0);
  const bookedWithValue = booked.filter((l) => (l.value ?? 0) > 0);
  const avgTicket = safeDiv(bookedWithValue.reduce((s, l) => s + (l.value ?? 0), 0), bookedWithValue.length);

  const spendByChannel = new Map<LeadSource, ReturnType<typeof spendInRange>>();
  for (const channel of Object.keys(SPEND_CHANNEL_SOURCE) as SpendChannel[]) {
    const s = spendInRange(input.spend.filter((r) => r.channel === channel), range);
    if (s.amount > 0 || s.clicks > 0) spendByChannel.set(SPEND_CHANNEL_SOURCE[channel], s);
  }
  const totalSpend = [...spendByChannel.values()].reduce((s, v) => s + v.amount, 0);

  const sources = new Set<LeadSource>([...inRange.map((l) => l.source), ...spendByChannel.keys()]);
  const channels: ChannelRow[] = [...sources]
    .map((source) => {
      const leads = inRange.filter((l) => l.source === source);
      const b = leads.filter((l) => l.status === "booked");
      const rev = b.reduce((s, l) => s + (l.value ?? 0), 0);
      const spend = spendByChannel.get(source)?.amount ?? 0;
      return {
        source,
        spend,
        leads: leads.length,
        booked: b.length,
        bookRate: safeDiv(b.length, leads.length),
        revenue: rev,
        costPerLead: spend > 0 ? safeDiv(spend, leads.length) : null,
        costPerBooked: spend > 0 ? safeDiv(spend, b.length) : null,
        roas: spend > 0 ? rev / spend : null,
      };
    })
    .sort((a, b) => b.spend - a.spend || b.leads - a.leads);

  // Paid = channels that had spend in the range.
  const paid = channels.filter((c) => c.spend > 0);
  const paidLeads = paid.reduce((s, c) => s + c.leads, 0);
  const paidBooked = paid.reduce((s, c) => s + c.booked, 0);
  const paidRevenue = paid.reduce((s, c) => s + c.revenue, 0);

  const openLeads = inRange.filter((l) => l.status === "open").length;
  const googleSpend = spendByChannel.get("google_ads");

  return {
    range,
    totals: {
      spend: totalSpend,
      leads: inRange.length,
      booked: booked.length,
      bookRate: safeDiv(booked.length, inRange.length),
      revenue,
      avgTicket,
      costPerLead: totalSpend > 0 ? safeDiv(totalSpend, inRange.length) : null,
      // Paid-only figures: spend compared with the leads and revenue those channels produced.
      paidLeads,
      paidBooked,
      paidRevenue,
      costPerPaidLead: safeDiv(totalSpend, paidLeads),
      costPerPaidBooked: safeDiv(totalSpend, paidBooked),
      roas: totalSpend > 0 ? paidRevenue / totalSpend : null,
      // All revenue marketing produced (organic and referral included) for every dollar of ad spend.
      blendedRoas: totalSpend > 0 ? revenue / totalSpend : null,
      openLeads,
      potentialFromOpen: avgTicket !== null ? openLeads * avgTicket : null,
      googleClicks: googleSpend?.clicks ?? 0,
      googleCpc: googleSpend && googleSpend.clicks > 0 ? googleSpend.amount / googleSpend.clicks : null,
    },
    channels,
  };
}

/** Spend and booked revenue per calendar month, for the trend chart. */
export function monthlyTrend(input: { leads: MetricLead[]; spend: MetricSpend[]; months: number; today: string }) {
  const [y, m] = input.today.split("-").map(Number);
  const result: { month: string; label: string; spend: number; revenue: number; leads: number }[] = [];
  const firstOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  for (let i = input.months - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    const start = firstOf(d);
    const end = addDays(firstOf(new Date(y, m - i, 1)), -1);
    const range = { start, end };
    const leads = input.leads.filter((l) => l.date >= start && l.date <= end && isReal(l.status));
    result.push({
      month: start.slice(0, 7),
      label: d.toLocaleDateString("en-US", { month: "short" }),
      spend: spendInRange(input.spend, range).amount,
      revenue: leads.filter((l) => l.status === "booked").reduce((s, l) => s + (l.value ?? 0), 0),
      leads: leads.length,
    });
  }
  return result;
}

// ---------- Date ranges for the page ----------

export const RESULT_WINDOWS = {
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  mtd: "This month",
  last_month: "Last month",
  ytd: "Year to date",
} as const;
export type ResultWindow = keyof typeof RESULT_WINDOWS;

export function parseResultWindow(raw: unknown): ResultWindow {
  return typeof raw === "string" && raw in RESULT_WINDOWS ? (raw as ResultWindow) : "30d";
}

export function rangeFor(window: ResultWindow, today: string): DateRange {
  const [y, m] = today.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  switch (window) {
    case "30d": return { start: addDays(today, -29), end: today };
    case "90d": return { start: addDays(today, -89), end: today };
    case "mtd": return { start: `${y}-${pad(m)}-01`, end: today };
    case "last_month": {
      const first = new Date(y, m - 2, 1);
      const start = `${first.getFullYear()}-${pad(first.getMonth() + 1)}-01`;
      return { start, end: addDays(`${y}-${pad(m)}-01`, -1) };
    }
    case "ytd": return { start: `${y}-01-01`, end: today };
  }
}
