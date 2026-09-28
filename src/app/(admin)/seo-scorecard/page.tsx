import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { ConnectLater } from "@/components/connect-later";

export const metadata: Metadata = { title: "SEO Scorecard" };

export default async function SeoScorecardPage() {
  await requireStaff();
  return (
    <ConnectLater
      title="SEO Scorecard"
      description="Rankings, search performance and AI-search visibility for each client, in one place."
      needs="Google Search Console, Google Analytics and Google Business Profile access (or their CSV exports), and optionally an AI-visibility tracker"
      willDo={[
        "Show organic clicks, impressions, CTR and sessions with period-over-period changes",
        "List top keywords and pages, and page-2 keywords close to page 1",
        "Track Google Business Profile calls, site clicks and new reviews",
        "Tie organic revenue to jobs using the lead and job matching already in the CRM",
      ]}
      meanwhile={{ label: "Open Marketing Results", href: "/marketing-results" }}
    />
  );
}
