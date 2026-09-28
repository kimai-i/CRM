// Standard routines per service. "Apply preset" copies these into recurring templates for a client.
import type { RecurrenceFrequency, TaskPriority } from "@/db/schema";

export type PresetTemplate = {
  title: string;
  frequency: RecurrenceFrequency;
  interval: number;
  weekdays?: number[]; // weekly
  dayOfMonth?: number; // monthly (-1 = last day)
  priority: TaskPriority;
  estHours: number;
  leadDays?: number;
  clientVisible?: boolean;
};

export type Preset = { key: string; name: string; serviceKey: string; templates: PresetTemplate[] };

export const PRESETS: Preset[] = [
  {
    key: "google_ads_standard",
    name: "Google Ads — standard cadence",
    serviceKey: "google_ads",
    templates: [
      { title: "Review search terms and add negatives", frequency: "weekly", interval: 1, weekdays: [1], priority: "high", estHours: 1 },
      { title: "Check bids, budgets and pacing", frequency: "weekly", interval: 1, weekdays: [3], priority: "medium", estHours: 0.5 },
      { title: "Monthly Google Ads performance report", frequency: "monthly", interval: 1, dayOfMonth: 1, priority: "high", estHours: 2, leadDays: 2 },
      { title: "Refresh ad copy and test new headlines", frequency: "monthly", interval: 1, dayOfMonth: 15, priority: "medium", estHours: 1.5 },
      { title: "Audit conversion tracking", frequency: "monthly", interval: 3, dayOfMonth: 5, priority: "high", estHours: 2 },
    ],
  },
  {
    key: "meta_ads_standard",
    name: "Meta Ads — standard cadence",
    serviceKey: "meta_ads",
    templates: [
      { title: "Check creative performance and fatigue", frequency: "weekly", interval: 1, weekdays: [2], priority: "medium", estHours: 1 },
      { title: "Refresh audiences and exclusions", frequency: "monthly", interval: 1, dayOfMonth: 10, priority: "medium", estHours: 1 },
      { title: "Monthly Meta Ads performance report", frequency: "monthly", interval: 1, dayOfMonth: 1, priority: "high", estHours: 1.5, leadDays: 2 },
    ],
  },
  {
    key: "seo_standard",
    name: "SEO — standard cadence",
    serviceKey: "seo",
    templates: [
      { title: "Publish Google Business Profile post", frequency: "weekly", interval: 1, weekdays: [1], priority: "medium", estHours: 0.5 },
      { title: "Check rankings and pages not indexed", frequency: "weekly", interval: 1, weekdays: [4], priority: "medium", estHours: 1 },
      { title: "Write and publish monthly blog post", frequency: "monthly", interval: 1, dayOfMonth: 5, priority: "high", estHours: 3, leadDays: 5 },
      { title: "Build local citations", frequency: "monthly", interval: 1, dayOfMonth: 20, priority: "low", estHours: 1 },
      { title: "Monthly SEO report", frequency: "monthly", interval: 1, dayOfMonth: 1, priority: "high", estHours: 1.5, leadDays: 2 },
    ],
  },
  {
    key: "website_care",
    name: "Website — care plan",
    serviceKey: "website",
    templates: [
      { title: "Update plugins and run a backup", frequency: "monthly", interval: 1, dayOfMonth: 1, priority: "medium", estHours: 1 },
      { title: "Check site speed and uptime", frequency: "monthly", interval: 1, dayOfMonth: 15, priority: "low", estHours: 0.5 },
      { title: "Review and refresh key page content", frequency: "monthly", interval: 3, dayOfMonth: 10, priority: "medium", estHours: 2 },
    ],
  },
  {
    key: "agency_internal",
    name: "Agency — internal rhythm",
    serviceKey: "internal",
    templates: [
      { title: "Weekly team planning", frequency: "weekly", interval: 1, weekdays: [1], priority: "medium", estHours: 1, clientVisible: false },
      { title: "Prepare monthly client reports", frequency: "monthly", interval: 1, dayOfMonth: -1, priority: "high", estHours: 3, leadDays: 3, clientVisible: false },
    ],
  },
];

export const findPreset = (key: string) => PRESETS.find((p) => p.key === key);
