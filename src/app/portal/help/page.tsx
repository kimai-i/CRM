import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { sops } from "@/db/schema";
import { requireClientUser } from "@/lib/auth";
import { SopLibrary } from "@/components/sop-views";

export const metadata: Metadata = { title: "Help & How-to" };

export default async function PortalHelpPage() {
  await requireClientUser();
  const rows = await db
    .select()
    .from(sops)
    .where(and(eq(sops.published, true), inArray(sops.visibility, ["client", "both"])))
    .orderBy(asc(sops.category), asc(sops.title));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Help &amp; How-to</h1>
        <p className="mt-1 text-sm text-slate-500">
          Short guides from your team. Can&apos;t find what you need?{" "}
          <Link href="/portal/requests" className="font-medium text-indigo-600 hover:underline">Send a request</Link>.
        </p>
      </div>
      <SopLibrary sops={rows} mode="client" categories={[]} />
    </div>
  );
}
