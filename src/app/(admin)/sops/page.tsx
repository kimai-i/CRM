import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { sops } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { SopLibrary } from "@/components/sop-views";

export const metadata: Metadata = { title: "SOPs & Tutorials" };

export default async function SopsPage() {
  await requireStaff();
  const rows = await db.select().from(sops).orderBy(asc(sops.category), asc(sops.title));
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="SOPs & Tutorials"
        subtitle="How your team does things, and how-tos for clients. Guides visible to clients also show on their portal's Help page."
      />
      <SopLibrary sops={rows} mode="team" categories={[...new Set(rows.map((r) => r.category))]} />
    </div>
  );
}
