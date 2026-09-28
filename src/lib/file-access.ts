import "server-only";
import { getActingAsClientId, getCurrentUser, isAdmin, isStaff } from "@/lib/auth";
import type { Asset } from "@/db/schema";

/**
 * Who is asking, for file routes (which can't use redirecting page guards).
 * Staff see everything; a client (or an admin previewing as a client) only sees their client's files.
 */
export async function getFileViewer(): Promise<{ userId: string; staff: boolean; clientId: string | null } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  if (isStaff(user.role)) {
    return { userId: user.id, staff: true, clientId: isAdmin(user.role) ? await getActingAsClientId() : null };
  }
  return { userId: user.id, staff: false, clientId: user.clientId };
}

export function canViewAsset(viewer: { staff: boolean; clientId: string | null }, asset: Pick<Asset, "clientId" | "clientVisible">): boolean {
  if (viewer.staff) return true;
  return asset.clientId !== null && asset.clientId === viewer.clientId && asset.clientVisible;
}
