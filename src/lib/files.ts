import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

// Local folder for uploaded files (a fixed path so the build doesn't bundle the whole project).
// Swap this module for cloud storage (S3, R2, etc.) when hosting.
export const UPLOAD_DIR = path.join(process.cwd(), "uploads");
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const BLOCKED_EXTENSIONS = new Set([".exe", ".bat", ".cmd", ".sh", ".ps1", ".msi", ".dll", ".js", ".html", ".htm", ".svg"]);

export function checkUpload(file: File): string | null {
  if (file.size === 0) return `"${file.name}" is empty.`;
  if (file.size > MAX_UPLOAD_BYTES) return `"${file.name}" is over 25 MB.`;
  if (BLOCKED_EXTENSIONS.has(path.extname(file.name).toLowerCase())) return `"${file.name}" is a file type that can't be uploaded.`;
  return null;
}

/** Saves the bytes under a random name (never the user's file name) and returns that name. */
export async function storeFile(file: File): Promise<string> {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = path.extname(file.name).toLowerCase().replace(/[^a-z0-9.]/g, "").slice(0, 10);
  const storedName = `${randomUUID()}${ext}`;
  await writeFile(path.join(UPLOAD_DIR, storedName), Buffer.from(await file.arrayBuffer()));
  return storedName;
}

// Stored names are always "<uuid>.<ext>" that we generated, so nothing can point outside the folder.
function safePath(storedName: string) {
  if (!/^[0-9a-f-]{36}(\.[a-z0-9]{1,10})?$/.test(storedName)) throw new Error("Invalid file name");
  return path.join(process.cwd(), "uploads", storedName);
}

export const readStoredFile = (storedName: string) => readFile(safePath(storedName));

export async function deleteStoredFile(storedName: string) {
  await unlink(safePath(storedName)).catch(() => undefined);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const isImage = (mime: string) => /^image\/(png|jpe?g|gif|webp|heic|avif)$/.test(mime);
