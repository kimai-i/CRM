// Removes every record and uploaded file, then restores the default channel list.
import { rm } from "node:fs/promises";
import path from "node:path";
import { db } from "../src/db";
import * as schema from "../src/db/schema";
import { DEFAULT_SERVICES } from "../src/db/default-services";

// Children before parents, so foreign keys never block a delete.
const TABLES_IN_DELETE_ORDER = [
  schema.sessions,
  schema.messages, schema.threadParticipants, schema.threads,
  schema.meetingActionItems, schema.meetings,
  schema.applicants, schema.brandKits, schema.sops, schema.assets,
  schema.invoices, schema.weeklyReports, schema.adBudgets,
  schema.onboardingItems, schema.businessProfiles,
  schema.timeEntries, schema.jobs, schema.adSpend,
  schema.requests, schema.leads,
  schema.taskComments, schema.tasks, schema.recurringTemplates, schema.appSettings,
  schema.clientServices, schema.clientOwners,
  schema.users, schema.clients, schema.services,
];

export async function wipeAll() {
  for (const table of TABLES_IN_DELETE_ORDER) await db.delete(table);
  await db.insert(schema.services).values(DEFAULT_SERVICES);
  await rm(path.join(process.cwd(), "uploads"), { recursive: true, force: true });
}
