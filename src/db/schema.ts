import { sqliteTable, text, integer, real, primaryKey, uniqueIndex } from "drizzle-orm/sqlite-core";

// Dates are stored as ISO strings: "YYYY-MM-DD" for calendar dates,
// full ISO timestamps for moments in time.

export const ROLES = ["owner", "admin", "team", "client"] as const;
export const LIFECYCLES = ["onboarding", "active", "paused", "churned"] as const;
export const TASK_STATUSES = ["todo", "in_progress", "blocked", "done"] as const;
export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const REQUEST_TYPES = ["ad_change", "content", "new_campaign", "budget_change", "question", "other"] as const;
export const REQUEST_STATUSES = ["open", "replied", "declined", "converted"] as const;

export type Role = (typeof ROLES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role", { enum: ROLES }).notNull(),
  initials: text("initials").notNull(),
  color: text("color").notNull(),
  passwordHash: text("password_hash"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  // Set for client-role users: the client whose portal they can see.
  clientId: text("client_id").references(() => clients.id, { onDelete: "cascade" }),
  utilizationTargetHours: real("utilization_target_hours").notNull().default(120),
  createdAt: text("created_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  // SHA-256 of the cookie token, so a leaked database can't be used to log in.
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(),
  // Set while an owner/admin is using "View as client": the portal renders as this client.
  actingAsClientId: text("acting_as_client_id").references(() => clients.id, { onDelete: "set null" }),
});

export const services = sqliteTable("services", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  sort: integer("sort").notNull().default(0),
});

export const clients = sqliteTable("clients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  lifecycle: text("lifecycle", { enum: LIFECYCLES }).notNull(),
  isInternal: integer("is_internal", { mode: "boolean" }).notNull().default(false),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  website: text("website"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});

export const clientServices = sqliteTable(
  "client_services",
  {
    clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    serviceKey: text("service_key").notNull().references(() => services.key),
  },
  (t) => [primaryKey({ columns: [t.clientId, t.serviceKey] })],
);

export const clientOwners = sqliteTable(
  "client_owners",
  {
    clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.clientId, t.userId] })],
);

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  serviceKey: text("service_key").notNull().references(() => services.key),
  ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),
  // "client" tasks are things the agency needs from the client; they show on the client's portal To-Do.
  assigneeType: text("assignee_type", { enum: ["agency", "client"] }).notNull().default("agency"),
  parentId: text("parent_id"),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status", { enum: TASK_STATUSES }).notNull(),
  priority: text("priority", { enum: TASK_PRIORITIES }).notNull(),
  dueDate: text("due_date"),
  completedAt: text("completed_at"),
  estHours: real("est_hours"),
  clientVisible: integer("client_visible", { mode: "boolean" }).notNull().default(true),
  isRoutine: integer("is_routine", { mode: "boolean" }).notNull().default(false),
  // Set when the task was created by a recurring template.
  recurringTemplateId: text("recurring_template_id").references(() => recurringTemplates.id, { onDelete: "set null" }),
  createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull(),
}, (t) => [
  // A template can create only one task per due date, even if two runs overlap.
  uniqueIndex("tasks_template_due_unique").on(t.recurringTemplateId, t.dueDate),
]);

export const RECURRENCE_FREQUENCIES = ["weekly", "monthly"] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

export const recurringTemplates = sqliteTable("recurring_templates", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  serviceKey: text("service_key").notNull().references(() => services.key),
  ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority", { enum: TASK_PRIORITIES }).notNull(),
  estHours: real("est_hours"),
  clientVisible: integer("client_visible", { mode: "boolean" }).notNull().default(true),
  // weekly: every `interval` weeks on `weekdays` (0 = Sunday … 6 = Saturday, comma-separated)
  // monthly: every `interval` months on `dayOfMonth` (-1 = last day of the month)
  frequency: text("frequency", { enum: RECURRENCE_FREQUENCIES }).notNull(),
  interval: integer("interval").notNull().default(1),
  weekdays: text("weekdays"),
  dayOfMonth: integer("day_of_month"),
  startsOn: text("starts_on").notNull(),
  // Due date of the next task this template will create.
  nextDueOn: text("next_due_on").notNull(),
  // Create the task this many days before it's due (0 = on the due date).
  leadDays: integer("lead_days").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  presetKey: text("preset_key"),
  createdAt: text("created_at").notNull(),
});

/** Small key/value store for app-wide state, e.g. when recurring tasks last ran. */
export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const taskComments = sqliteTable("task_comments", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull(),
});

export const LEAD_TYPES = ["call", "form", "chat", "outreach"] as const;
export const LEAD_SOURCES = ["google_ads", "meta_ads", "organic", "gbp", "direct", "referral", "outreach", "other"] as const;
export const LEAD_STATUSES = ["open", "booked", "not_a_lead", "spam"] as const;
export type LeadType = (typeof LEAD_TYPES)[number];
export type LeadSource = (typeof LEAD_SOURCES)[number];
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const leads = sqliteTable("leads", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  type: text("type", { enum: LEAD_TYPES }).notNull(),
  source: text("source", { enum: LEAD_SOURCES }).notNull(),
  // The original source text from an import (e.g. a campaign or tracking-number name).
  sourceDetail: text("source_detail"),
  contactName: text("contact_name"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  zip: text("zip"),
  // Normalized phone (last 10 digits) or lowercased email — used to spot repeat contacts and duplicates.
  contactKey: text("contact_key"),
  summary: text("summary"),
  durationSec: integer("duration_sec"),
  // Typed in by hand or from a lead import.
  value: real("value"),
  // Sum of matched job totals (set by job matching). When present, reports use it instead of `value`.
  jobRevenue: real("job_revenue"),
  status: text("status", { enum: LEAD_STATUSES }).notNull(),
  occurredAt: text("occurred_at").notNull(),
  provider: text("provider", { enum: ["manual", "csv"] }).notNull().default("manual"),
  externalId: text("external_id"),
  createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull().default(""),
});

/**
 * Logged time. A running timer is a row with `startedAt` set and `endedAt` null (minutes = 0);
 * each person can have at most one running timer.
 */
export const timeEntries = sqliteTable("time_entries", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  serviceKey: text("service_key").notNull().references(() => services.key),
  taskId: text("task_id").references(() => tasks.id, { onDelete: "set null" }),
  date: text("date").notNull(), // "YYYY-MM-DD" the work happened
  minutes: integer("minutes").notNull(),
  note: text("note"),
  startedAt: text("started_at"),
  endedAt: text("ended_at"),
  createdAt: text("created_at").notNull(),
});

export const JOB_STATUSES = ["estimate", "scheduled", "completed", "canceled"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** Jobs / invoices from the client's field-service software, imported from CSV. */
export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    // Job or invoice number from the source system — used to update instead of duplicating on re-import.
    externalId: text("external_id"),
    customerName: text("customer_name"),
    phone: text("phone"),
    email: text("email"),
    zip: text("zip"),
    contactKey: text("contact_key"),
    description: text("description"),
    status: text("status", { enum: JOB_STATUSES }).notNull(),
    createdOn: text("created_on").notNull(),
    scheduledOn: text("scheduled_on"),
    completedOn: text("completed_on"),
    total: real("total").notNull(),
    paid: real("paid"),
    leadSource: text("lead_source"),
    matchedLeadId: text("matched_lead_id").references(() => leads.id, { onDelete: "set null" }),
    matchedBy: text("matched_by", { enum: ["phone", "email", "name_zip"] }),
    provider: text("provider", { enum: ["manual", "csv"] }).notNull().default("csv"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("jobs_client_external_unique").on(t.clientId, t.externalId)],
);

export const SPEND_CHANNELS = ["google_ads", "meta_ads", "other"] as const;
export type SpendChannel = (typeof SPEND_CHANNELS)[number];

/**
 * Ad spend for a period (one day, a month, or any range). When a report's date range only
 * partly overlaps a period, the amount is spread evenly across the period's days.
 */
export const adSpend = sqliteTable(
  "ad_spend",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    channel: text("channel", { enum: SPEND_CHANNELS }).notNull(),
    periodStart: text("period_start").notNull(),
    periodEnd: text("period_end").notNull(),
    // "" when not tracked per campaign (keeps the unique key simple).
    campaign: text("campaign").notNull().default(""),
    amount: real("amount").notNull(),
    clicks: integer("clicks"),
    impressions: integer("impressions"),
    conversions: real("conversions"),
    notes: text("notes"),
    provider: text("provider", { enum: ["manual", "csv"] }).notNull().default("manual"),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: text("created_at").notNull(),
  },
  // Re-importing the same export updates rows instead of doubling them.
  (t) => [uniqueIndex("ad_spend_unique_period").on(t.clientId, t.channel, t.periodStart, t.periodEnd, t.campaign)],
);

export const requests = sqliteTable("requests", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  submittedById: text("submitted_by_id").references(() => users.id, { onDelete: "set null" }),
  type: text("type", { enum: REQUEST_TYPES }).notNull(),
  title: text("title").notNull(),
  body: text("body"),
  status: text("status", { enum: REQUEST_STATUSES }).notNull(),
  reply: text("reply"),
  repliedById: text("replied_by_id").references(() => users.id, { onDelete: "set null" }),
  repliedAt: text("replied_at"),
  convertedTaskId: text("converted_task_id").references(() => tasks.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull(),
});

export type User = typeof users.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type TaskComment = typeof taskComments.$inferSelect;
export type RecurringTemplate = typeof recurringTemplates.$inferSelect;
export type AdSpend = typeof adSpend.$inferSelect;
export type TimeEntry = typeof timeEntries.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type Request = typeof requests.$inferSelect;

// ---------------------------------------------------------------------------
// Client operations: onboarding, budgets, meetings, chat, files, help, billing, hiring
// ---------------------------------------------------------------------------

export const ASSIGNEES = ["agency", "client"] as const;

export const onboardingItems = sqliteTable("onboarding_items", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  assignee: text("assignee", { enum: ASSIGNEES }).notNull(),
  sort: integer("sort").notNull().default(0),
  doneAt: text("done_at"),
  doneById: text("done_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull(),
});

/** The client's answers to the business-profile questionnaire (JSON keyed by question id). */
export const businessProfiles = sqliteTable("business_profiles", {
  clientId: text("client_id").primaryKey().references(() => clients.id, { onDelete: "cascade" }),
  answers: text("answers").notNull().default("{}"),
  submittedAt: text("submitted_at"),
  updatedAt: text("updated_at").notNull(),
  updatedById: text("updated_by_id").references(() => users.id, { onDelete: "set null" }),
});

export const adBudgets = sqliteTable(
  "ad_budgets",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    channel: text("channel", { enum: SPEND_CHANNELS }).notNull(),
    monthlyBudget: real("monthly_budget"),
    dailyBudget: real("daily_budget"),
    notes: text("notes"),
    reviewDueOn: text("review_due_on"),
    updatedById: text("updated_by_id").references(() => users.id, { onDelete: "set null" }),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [uniqueIndex("ad_budgets_client_channel_unique").on(t.clientId, t.channel)],
);

export const meetings = sqliteTable("meetings", {
  id: text("id").primaryKey(),
  clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  startsAt: text("starts_at").notNull(),
  durationMin: integer("duration_min"),
  attendees: text("attendees"),
  // Shared with the client when visibility is "client".
  summary: text("summary"),
  // Never shown to the client.
  internalNotes: text("internal_notes"),
  visibility: text("visibility", { enum: ["internal", "client"] }).notNull().default("internal"),
  recordingUrl: text("recording_url"),
  createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull(),
});

export const meetingActionItems = sqliteTable("meeting_action_items", {
  id: text("id").primaryKey(),
  meetingId: text("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  assignee: text("assignee", { enum: ASSIGNEES }).notNull().default("agency"),
  doneAt: text("done_at"),
  taskId: text("task_id").references(() => tasks.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull(),
});

/** Team chat. A direct message is a thread with two participants and no title. */
export const threads = sqliteTable("threads", {
  id: text("id").primaryKey(),
  title: text("title"),
  createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
  lastMessageAt: text("last_message_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const threadParticipants = sqliteTable(
  "thread_participants",
  {
    threadId: text("thread_id").notNull().references(() => threads.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    lastReadAt: text("last_read_at"),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.threadId, t.userId] })],
);

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  threadId: text("thread_id").notNull().references(() => threads.id, { onDelete: "cascade" }),
  senderId: text("sender_id").references(() => users.id, { onDelete: "set null" }),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull(),
});

export const ASSET_CATEGORIES = ["logo", "photo", "brand_guide", "ad_creative", "document", "contract", "report", "other"] as const;
export const PHOTO_STATUSES = ["needs_review", "approved", "passed", "posted"] as const;

/** Uploaded files. The bytes live on disk in the upload folder; `storedName` is the file name there. */
export const assets = sqliteTable("assets", {
  id: text("id").primaryKey(),
  clientId: text("client_id").references(() => clients.id, { onDelete: "cascade" }),
  // What the file is for: a client asset, a Photo Drop job photo, a resume, or a help-guide attachment.
  purpose: text("purpose", { enum: ["asset", "photo", "resume", "sop"] }).notNull().default("asset"),
  category: text("category", { enum: ASSET_CATEGORIES }).notNull().default("other"),
  filename: text("filename").notNull(),
  storedName: text("stored_name").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  label: text("label"),
  notes: text("notes"),
  clientVisible: integer("client_visible", { mode: "boolean" }).notNull().default(true),
  photoStatus: text("photo_status", { enum: PHOTO_STATUSES }),
  uploadedById: text("uploaded_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull(),
});

export const brandKits = sqliteTable("brand_kits", {
  clientId: text("client_id").primaryKey().references(() => clients.id, { onDelete: "cascade" }),
  barColor: text("bar_color"),
  textColor: text("text_color"),
  accentColor: text("accent_color"),
  callNowPhone: text("call_now_phone"),
  captionVoice: text("caption_voice"),
  updatedAt: text("updated_at").notNull(),
});

export const sops = sqliteTable("sops", {
  id: text("id").primaryKey(),
  category: text("category").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  videoUrl: text("video_url"),
  visibility: text("visibility", { enum: ["team", "client", "both"] }).notNull().default("team"),
  published: integer("published", { mode: "boolean" }).notNull().default(true),
  createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
  updatedAt: text("updated_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const INVOICE_STATUSES = ["draft", "open", "paid", "void"] as const;

export const invoices = sqliteTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    number: text("number").notNull(),
    description: text("description"),
    amount: real("amount").notNull(),
    issuedOn: text("issued_on").notNull(),
    dueOn: text("due_on"),
    status: text("status", { enum: INVOICE_STATUSES }).notNull().default("open"),
    paidOn: text("paid_on"),
    // Optional hosted payment page from whatever billing tool is used (pasted in, not integrated).
    paymentUrl: text("payment_url"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("invoices_number_unique").on(t.number)],
);

export const APPLICANT_STATUSES = ["new", "reviewed", "interviewing", "hired", "rejected"] as const;

export const applicants = sqliteTable("applicants", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  role: text("role"),
  notes: text("notes"),
  resumeAssetId: text("resume_asset_id").references(() => assets.id, { onDelete: "set null" }),
  status: text("status", { enum: APPLICANT_STATUSES }).notNull().default("new"),
  submittedAt: text("submitted_at").notNull(),
});

export const weeklyReports = sqliteTable(
  "weekly_reports",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    weekStart: text("week_start").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    status: text("status", { enum: ["draft", "approved", "sent", "skipped"] }).notNull().default("draft"),
    approvedById: text("approved_by_id").references(() => users.id, { onDelete: "set null" }),
    approvedAt: text("approved_at"),
    sentAt: text("sent_at"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("weekly_reports_client_week_unique").on(t.clientId, t.weekStart)],
);

export type OnboardingItem = typeof onboardingItems.$inferSelect;
export type Meeting = typeof meetings.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type Sop = typeof sops.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type Applicant = typeof applicants.$inferSelect;
export type WeeklyReport = typeof weeklyReports.$inferSelect;
