"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { initialsFor } from "@/lib/labels";

export type SettingsState = { ok?: boolean; error?: string };

const STAFF_COLORS = ["#6366f1", "#0ea5e9", "#f59e0b", "#10b981", "#ec4899", "#8b5cf6", "#ef4444", "#14b8a6"];

export async function changePassword(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const user = await requireStaff();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!(await verifyPassword(current, user.passwordHash))) return { error: "Your current password isn't right." };
  if (next.length < 8) return { error: "Use at least 8 characters for the new password." };
  if (next !== confirm) return { error: "The new passwords don't match." };

  await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, user.id));
  return { ok: true };
}

const teamMemberSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(200),
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  role: z.enum(["admin", "team"]),
  password: z.string().min(8, "Temporary password must be at least 8 characters.").max(200),
});

export async function addTeamMember(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  await requireAdmin();
  const parsed = teamMemberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, parsed.data.email));
  if (existing) return { error: "Someone already uses that email." };

  const count = (await db.select({ id: users.id }).from(users)).length;
  await db.insert(users).values({
    id: randomUUID(),
    name: parsed.data.name,
    email: parsed.data.email,
    role: parsed.data.role,
    initials: initialsFor(parsed.data.name),
    color: STAFF_COLORS[count % STAFF_COLORS.length],
    passwordHash: await hashPassword(parsed.data.password),
    createdAt: new Date().toISOString(),
  });
  refresh();
  return { ok: true };
}

export async function updateTeamMember(userId: string, change: { role?: "admin" | "team"; isActive?: boolean }): Promise<SettingsState> {
  const me = await requireAdmin();
  if (userId === me.id) return { error: "You can't change your own role or access." };

  const [target] = await db.select().from(users).where(eq(users.id, userId));
  if (!target || target.role === "client") return { error: "User not found." };
  if (target.role === "owner") return { error: "The owner's access can't be changed." };
  if (change.role && !["admin", "team"].includes(change.role)) return { error: "Unknown role." };

  await db.update(users).set(change).where(eq(users.id, userId));
  refresh();
  return {};
}

export async function resetTeamMemberPassword(userId: string, _prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const me = await requireAdmin();
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "At least 8 characters." };
  const [target] = await db.select().from(users).where(eq(users.id, userId));
  if (!target) return { error: "User not found." };
  if (target.role === "owner" && me.role !== "owner") return { error: "Only the owner can reset the owner's password." };

  await db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, userId));
  return { ok: true };
}
