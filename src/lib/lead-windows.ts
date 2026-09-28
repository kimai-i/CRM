export const LEAD_WINDOWS = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  mtd: "Month to date",
  all: "All time",
} as const;
export type LeadWindow = keyof typeof LEAD_WINDOWS;

export function parseLeadWindow(raw: unknown): LeadWindow {
  return typeof raw === "string" && raw in LEAD_WINDOWS ? (raw as LeadWindow) : "30d";
}
