import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { businessProfiles, onboardingItems } from "@/db/schema";
import { parseAnswers, profileCompletion } from "@/lib/onboarding";
import type { ChecklistItemView } from "@/components/onboarding-views";

export async function getOnboarding(clientId: string) {
  const [items, [profile]] = await Promise.all([
    db.select().from(onboardingItems).where(eq(onboardingItems.clientId, clientId)).orderBy(asc(onboardingItems.sort), asc(onboardingItems.createdAt)),
    db.select().from(businessProfiles).where(eq(businessProfiles.clientId, clientId)),
  ]);
  const answers = parseAnswers(profile?.answers);
  const checklist: ChecklistItemView[] = items.map((i) => ({ id: i.id, title: i.title, description: i.description, assignee: i.assignee, doneAt: i.doneAt }));
  return {
    checklist,
    answers,
    submittedAt: profile?.submittedAt ?? null,
    profilePct: profileCompletion(answers),
  };
}

/** Progress for every client that has checklist items or a profile. */
export async function getOnboardingSummary() {
  const [items, profiles] = await Promise.all([
    db.select({ clientId: onboardingItems.clientId, doneAt: onboardingItems.doneAt, assignee: onboardingItems.assignee }).from(onboardingItems),
    db.select().from(businessProfiles),
  ]);
  const byClient = new Map<string, { total: number; done: number; clientOpen: number; profilePct: number; submittedAt: string | null }>();
  const get = (id: string) => {
    let row = byClient.get(id);
    if (!row) byClient.set(id, (row = { total: 0, done: 0, clientOpen: 0, profilePct: 0, submittedAt: null }));
    return row;
  };
  for (const i of items) {
    const row = get(i.clientId);
    row.total++;
    if (i.doneAt) row.done++;
    else if (i.assignee === "client") row.clientOpen++;
  }
  for (const p of profiles) {
    const row = get(p.clientId);
    row.profilePct = profileCompletion(parseAnswers(p.answers));
    row.submittedAt = p.submittedAt;
  }
  return byClient;
}
