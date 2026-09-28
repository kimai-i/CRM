"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { initialsFor } from "@/lib/labels";

export type SetupState = { error?: string };

const schema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(200),
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  password: z.string().min(10, "Use at least 10 characters for the owner password.").max(200),
});

/** Creates the first (owner) account. Only works while the CRM has no users at all. */
export async function createOwner(_prev: SetupState, formData: FormData): Promise<SetupState> {
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(users);
  if (Number(n) > 0) redirect("/login");

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.password !== String(formData.get("confirm") ?? "")) return { error: "The passwords don't match." };

  const id = randomUUID();
  await db.insert(users).values({
    id,
    name: parsed.data.name,
    email: parsed.data.email,
    role: "owner",
    initials: initialsFor(parsed.data.name),
    color: "#6366f1",
    passwordHash: await hashPassword(parsed.data.password),
    createdAt: new Date().toISOString(),
  });
  await createSession(id);
  redirect("/dashboard");
}
