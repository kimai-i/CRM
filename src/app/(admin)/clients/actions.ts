"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { clientOwners, clients, clientServices, users, LIFECYCLES } from "@/db/schema";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { initialsFor } from "@/lib/labels";

const optional = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(max).nullable());

const clientSchema = z.object({
  name: z.string().trim().min(1, "Enter the client's name.").max(200),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a color."),
  lifecycle: z.enum(LIFECYCLES),
  isInternal: z.boolean(),
  contactName: optional(200),
  contactEmail: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().email("Enter a valid contact email.").nullable(),
  ),
  contactPhone: optional(50),
  website: optional(300),
  notes: optional(5000),
});

export type ClientFormState = { error?: string };

function parseClientForm(formData: FormData) {
  return {
    parsed: clientSchema.safeParse({
      ...Object.fromEntries(formData),
      isInternal: formData.get("isInternal") === "on",
    }),
    serviceKeys: formData.getAll("services").map(String),
    ownerIds: formData.getAll("owners").map(String),
  };
}

async function setLinks(clientId: string, serviceKeys: string[], ownerIds: string[]) {
  await db.delete(clientServices).where(eq(clientServices.clientId, clientId));
  await db.delete(clientOwners).where(eq(clientOwners.clientId, clientId));
  if (serviceKeys.length) await db.insert(clientServices).values(serviceKeys.map((serviceKey) => ({ clientId, serviceKey })));
  if (ownerIds.length) await db.insert(clientOwners).values(ownerIds.map((userId) => ({ clientId, userId })));
}

export async function createClient(_prev: ClientFormState, formData: FormData): Promise<ClientFormState> {
  await requireStaff();
  const { parsed, serviceKeys, ownerIds } = parseClientForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const id = randomUUID();
  await db.insert(clients).values({ id, ...parsed.data, createdAt: new Date().toISOString() });
  await setLinks(id, serviceKeys, ownerIds);
  redirect(`/clients/${id}`);
}

export async function updateClient(id: string, _prev: ClientFormState, formData: FormData): Promise<ClientFormState> {
  await requireStaff();
  const { parsed, serviceKeys, ownerIds } = parseClientForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await db.update(clients).set(parsed.data).where(eq(clients.id, id));
  await setLinks(id, serviceKeys, ownerIds);
  redirect(`/clients/${id}?tab=details`);
}

export async function setLifecycle(id: string, lifecycle: (typeof LIFECYCLES)[number]) {
  await requireStaff();
  if (!LIFECYCLES.includes(lifecycle)) return;
  await db.update(clients).set({ lifecycle }).where(eq(clients.id, id));
  refresh();
}

export async function deleteClient(id: string) {
  await requireAdmin();
  await db.delete(clients).where(eq(clients.id, id));
  redirect("/clients");
}

const portalUserSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(200),
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  password: z.string().min(8, "Temporary password must be at least 8 characters.").max(200),
});

export type PortalUserState = { error?: string; ok?: boolean };

export async function addPortalUser(clientId: string, _prev: PortalUserState, formData: FormData): Promise<PortalUserState> {
  await requireStaff();
  const parsed = portalUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, parsed.data.email));
  if (existing) return { error: "Someone already uses that email." };

  await db.insert(users).values({
    id: randomUUID(),
    name: parsed.data.name,
    email: parsed.data.email,
    role: "client",
    clientId,
    initials: initialsFor(parsed.data.name),
    color: "#64748b",
    passwordHash: await hashPassword(parsed.data.password),
    createdAt: new Date().toISOString(),
  });
  refresh();
  return { ok: true };
}

export async function setPortalUserActive(clientId: string, userId: string, isActive: boolean) {
  await requireStaff();
  await db
    .update(users)
    .set({ isActive })
    .where(and(eq(users.id, userId), eq(users.clientId, clientId), eq(users.role, "client")));
  refresh();
}
