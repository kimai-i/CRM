// CSV import helpers for ad spend exports (Google Ads, Meta Ads Manager, spreadsheets).
import { parseDateLoose, parseMoney } from "@/lib/leads";
import { toDateString } from "@/lib/dates";

export const SPEND_FIELDS = [
  { key: "startDate", label: "Date (or period start)", required: true, hints: ["day", "date", "reporting starts", "start", "week", "month"] },
  { key: "endDate", label: "Period end (if a range)", hints: ["reporting ends", "end date", "end"] },
  { key: "amount", label: "Cost / amount spent", required: true, hints: ["cost", "amount spent", "spend", "amount"] },
  { key: "clicks", label: "Clicks", hints: ["clicks", "link clicks"] },
  { key: "impressions", label: "Impressions", hints: ["impr.", "impressions", "impr"] },
  { key: "conversions", label: "Conversions", hints: ["conversions", "results", "conv."] },
  { key: "campaign", label: "Campaign", hints: ["campaign", "campaign name"] },
] as const;

export type SpendFieldKey = (typeof SPEND_FIELDS)[number]["key"];
export type SpendMapping = Partial<Record<SpendFieldKey, number>>;
export type SpendImportRow = Partial<Record<SpendFieldKey, string>>;

/**
 * Google Ads exports start with a report title and date line before the real header.
 * Returns the index of the first row that looks like a header (has a cost/spend column).
 */
export function detectHeaderRow(rows: string[][]): number {
  const i = rows.findIndex((r) => r.filter((c) => c.trim()).length >= 2 && r.some((c) => /cost|spend|amount/i.test(c)));
  return i === -1 ? 0 : i;
}

export function guessSpendMapping(headers: string[]): SpendMapping {
  const norm = headers.map((h) => h.trim().toLowerCase());
  const used = new Set<number>();
  const mapping: SpendMapping = {};
  for (const field of SPEND_FIELDS) {
    let index = norm.findIndex((h, i) => !used.has(i) && (field.hints as readonly string[]).includes(h));
    if (index === -1) index = norm.findIndex((h, i) => !used.has(i) && field.hints.some((hint) => h.includes(hint)));
    if (index !== -1) {
      mapping[field.key] = index;
      used.add(index);
    }
  }
  return mapping;
}

const parseCount = (raw: string | undefined): number | null => {
  const v = raw?.replace(/[,\s]/g, "");
  if (!v || v === "--") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export type NormalizedSpend = {
  periodStart: string;
  periodEnd: string;
  amount: number;
  clicks: number | null;
  impressions: number | null;
  conversions: number | null;
  campaign: string;
};

export function normalizeSpendRow(row: SpendImportRow): { spend?: NormalizedSpend; error?: string } {
  const startIso = parseDateLoose(row.startDate);
  // Totals rows ("Total: Account") and blank lines have no date — report them as skipped.
  if (!startIso) return { error: row.startDate ? `Not a date: "${row.startDate}"` : "No date (a totals or blank row)" };
  const periodStart = toDateString(new Date(startIso));
  const endIso = row.endDate ? parseDateLoose(row.endDate) : null;
  if (row.endDate && !endIso) return { error: `Not a date: "${row.endDate}"` };
  const periodEnd = endIso ? toDateString(new Date(endIso)) : periodStart;
  if (periodEnd < periodStart) return { error: "The period ends before it starts" };

  const amount = parseMoney(row.amount);
  if (amount === null) return { error: row.amount ? `Not an amount: "${row.amount}"` : "No amount" };
  if (amount < 0) return { error: "Negative amount" };

  const clicks = parseCount(row.clicks);
  const impressions = parseCount(row.impressions);
  return {
    spend: {
      periodStart,
      periodEnd,
      amount,
      clicks: clicks === null ? null : Math.round(clicks),
      impressions: impressions === null ? null : Math.round(impressions),
      conversions: parseCount(row.conversions),
      campaign: (row.campaign ?? "").trim().slice(0, 200),
    },
  };
}
