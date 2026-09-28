import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { ConnectLater } from "@/components/connect-later";

export const metadata: Metadata = { title: "Planner" };

export default async function PlannerPage() {
  await requireStaff();
  return (
    <ConnectLater
      title="Planner"
      description="An assistant that plans your day and week from your tasks, meetings and inbox."
      needs="an AI service (e.g. Claude) and, optionally, your calendar"
      willDo={[
        "Build a time-blocked plan for today from your open and overdue tasks",
        "Set weekly priorities — the 'big rocks' — across all clients",
        "Suggest due-date changes you can apply with one click",
        "Remember your preferences between planning sessions",
      ]}
      meanwhile={{ label: "Open My Work", href: "/my-work" }}
    />
  );
}
