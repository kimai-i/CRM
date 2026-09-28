import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users, type Role, type User } from "@/db/schema";

const COOKIE = "session";
const SESSION_DAYS = 30;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt: expires.toISOString() });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  store.delete(COOKIE);
}

type SessionInfo = { user: User; actingAsClientId: string | null };

/** The logged-in user and session state, or null. Cached for the duration of one request. */
const getSession = cache(async (): Promise<SessionInfo | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ user: users, expiresAt: sessions.expiresAt, actingAsClientId: sessions.actingAsClientId })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, hashToken(token)))
    .limit(1);
  if (!row || row.expiresAt < new Date().toISOString() || !row.user.isActive) return null;
  return { user: row.user, actingAsClientId: row.actingAsClientId };
});

export async function getCurrentUser(): Promise<User | null> {
  return (await getSession())?.user ?? null;
}

export const isStaff = (role: Role) => role !== "client";
export const isAdmin = (role: Role) => role === "owner" || role === "admin";

/** For admin-app pages and actions: must be logged in as owner, admin or team. */
export async function requireStaff(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isStaff(user.role)) redirect("/portal");
  return user;
}

/** For owner/admin-only pages and actions. */
export async function requireAdmin(): Promise<User> {
  const user = await requireStaff();
  if (!isAdmin(user.role)) redirect("/dashboard");
  return user;
}

export type PortalViewer = User & {
  /** The client whose portal is being shown. */
  clientId: string;
  /** True when an owner/admin is previewing the portal with "View as client". */
  impersonating: boolean;
};

/**
 * For portal pages and actions. Allowed: a client user (sees their own client), or an
 * owner/admin who turned on "View as client" (sees that client). Everyone else is sent away.
 */
export async function requireClientUser(): Promise<PortalViewer> {
  const session = await getSession();
  if (!session) redirect("/login");
  const { user, actingAsClientId } = session;

  if (isStaff(user.role)) {
    if (isAdmin(user.role) && actingAsClientId) return { ...user, clientId: actingAsClientId, impersonating: true };
    redirect("/dashboard");
  }
  if (!user.clientId) redirect("/login?error=no-client");
  return { ...user, clientId: user.clientId, impersonating: false };
}

/** The client an admin is currently previewing, if any. */
export async function getActingAsClientId(): Promise<string | null> {
  const session = await getSession();
  return session && isAdmin(session.user.role) ? session.actingAsClientId : null;
}

/** Starts or stops "View as client" on the current session. */
export async function setActingAsClient(clientId: string | null) {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return;
  await db.update(sessions).set({ actingAsClientId: clientId }).where(eq(sessions.id, hashToken(token)));
}

export function homeFor(user: Pick<User, "role">): string {
  return isStaff(user.role) ? "/dashboard" : "/portal";
}
