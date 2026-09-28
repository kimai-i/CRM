"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { getActingAsClientId, getCurrentUser, isStaff, requireAdmin, setActingAsClient } from "@/lib/auth";

/** Owner/admin only: open the client portal exactly as this client sees it. */
export async function startViewAsClient(clientId: string) {
  await requireAdmin();
  const [client] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, clientId));
  if (!client) redirect("/clients");
  await setActingAsClient(clientId);
  redirect("/portal");
}

/** Leave the preview and go back to that client's page in the admin app. */
export async function exitViewAsClient() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const previous = await getActingAsClientId();
  await setActingAsClient(null);
  redirect(isStaff(user.role) ? (previous ? `/clients/${previous}` : "/dashboard") : "/portal");
}
