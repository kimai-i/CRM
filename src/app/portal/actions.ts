"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { requests, REQUEST_TYPES } from "@/db/schema";
import { requireClientUser } from "@/lib/auth";

const schema = z.object({
  type: z.enum(REQUEST_TYPES),
  title: z.string().trim().min(1, "Tell us briefly what you need.").max(300),
  body: z.preprocess((v) => (v === "" ? null : v), z.string().max(10_000).nullable()),
});

export type PortalRequestState = { ok?: boolean; error?: string };

export async function submitRequest(_prev: PortalRequestState, formData: FormData): Promise<PortalRequestState> {
  const user = await requireClientUser();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // clientId always comes from the logged-in user, never from the form.
  await db.insert(requests).values({
    id: randomUUID(),
    clientId: user.clientId,
    submittedById: user.id,
    ...parsed.data,
    status: "open",
    createdAt: new Date().toISOString(),
  });
  refresh();
  return { ok: true };
}
