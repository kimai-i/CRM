import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { APP_NAME } from "@/lib/config";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user));
  // A brand-new, empty CRM goes to first-run setup.
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(users);
  if (Number(n) === 0) redirect("/setup");

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
            A1
          </div>
          <span className="text-lg font-semibold text-slate-900">{APP_NAME}</span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Log in</h1>
          <p className="mt-1 text-sm text-slate-500">Welcome back. Enter your details to continue.</p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
