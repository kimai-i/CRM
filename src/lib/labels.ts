// Human-readable labels for stored enum values.

export const STATUS_LABEL = {
  todo: "To Do",
  in_progress: "In Progress",
  blocked: "Blocked",
  done: "Done",
} as const;

export const PRIORITY_LABEL = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
} as const;

export const LIFECYCLE_LABEL = {
  onboarding: "Onboarding",
  active: "Active",
  paused: "Paused / On hold",
  churned: "Churned",
} as const;

export const ROLE_LABEL = {
  owner: "Owner",
  admin: "Admin",
  team: "Team member",
  client: "Client",
} as const;

export const REQUEST_TYPE_LABEL = {
  ad_change: "Ad change",
  content: "Content update",
  new_campaign: "New campaign",
  budget_change: "Budget change",
  question: "Question",
  other: "Other",
} as const;

export const REQUEST_STATUS_LABEL = {
  open: "Open",
  replied: "Replied",
  declined: "Declined",
  converted: "Converted to task",
} as const;

/** Which channel a request most likely belongs to when converted into a task. */
export const REQUEST_TYPE_SERVICE: Record<keyof typeof REQUEST_TYPE_LABEL, string> = {
  ad_change: "google_ads",
  content: "website",
  new_campaign: "google_ads",
  budget_change: "google_ads",
  question: "ad_hoc",
  other: "ad_hoc",
};

export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function timeAgo(iso: string, now = new Date()): string {
  const mins = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
