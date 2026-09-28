import type { Metadata } from "next";
import { requireClientUser } from "@/lib/auth";
import { ConnectLater } from "@/components/connect-later";

export const metadata: Metadata = { title: "AI Assistant" };

export default async function PortalAssistantPage() {
  await requireClientUser();
  return (
    <ConnectLater
      audience="client"
      title="Marketing assistant"
      description="Ask about your campaigns, calls, jobs and budgets and get answers from your account's real numbers."
      needs="an AI service"
      willDo={[
        "Answer questions like “How many leads did we get last month, and from where?”",
        "Summarize open estimates, ad budgets and what the team is working on",
        "Show tables and charts in its answers",
        "Never change your accounts — it only reads your data",
      ]}
      meanwhile={{ label: "See Marketing Results", href: "/portal/results" }}
    />
  );
}
