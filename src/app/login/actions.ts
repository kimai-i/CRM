"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, destroySession, homeFor } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";

export type LoginState = { error?: string; email?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password.", email };

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  // Same message whether the email or the password is wrong, so emails can't be probed.
  if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "That email and password don't match.", email };
  }

  await createSession(user.id);
  redirect(homeFor(user));
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
