"use server";

import { refresh } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { weeklyReports } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { generateDrafts, lastWeekStart } from "@/lib/weekly-report";

export type ReportState = { ok?: boolean; error?: string; message?: string };

export async function generateLastWeek(): Promise<ReportState> {
  await requireStaff();
  const { created, skipped } = await generateDrafts(lastWeekStart());
  refresh();
  if (created === 0) return { ok: true, message: skipped ? "Every active client already has a draft for last week." : "No active clients to report on." };
  return { ok: true, message: `Created ${created} draft${created === 1 ? "" : "s"} for last week.` };
}

export async function saveReport(id: string, _prev: ReportState, formData: FormData): Promise<ReportState> {
  const user = await requireStaff();
  const subject = String(formData.get("subject") ?? "").trim().slice(0, 300);
  const body = String(formData.get("body") ?? "").trim().slice(0, 50_000);
  const intent = String(formData.get("intent") ?? "save");
  if (!subject || !body) return { error: "The report needs a subject and a body." };
  const now = new Date().toISOString();
  const status = intent === "approve" ? "approved" : intent === "sent" ? "sent" : intent === "skip" ? "skipped" : undefined;
  await db
    .update(weeklyReports)
    .set({
      subject,
      body,
      ...(status ? { status } : {}),
      ...(status === "approved" ? { approvedById: user.id, approvedAt: now } : {}),
      ...(status === "sent" ? { sentAt: now, approvedById: user.id, approvedAt: now } : {}),
    })
    .where(eq(weeklyReports.id, id));
  refresh();
  return { ok: true, message: status === "sent" ? "Marked as sent — the client can see it in their portal." : status === "approved" ? "Approved." : status === "skipped" ? "Skipped." : "Saved." };
}

export async function reopenReport(id: string) {
  await requireStaff();
  await db.update(weeklyReports).set({ status: "draft", sentAt: null }).where(eq(weeklyReports.id, id));
  refresh();
}
