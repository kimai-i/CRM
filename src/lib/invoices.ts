import type { Invoice } from "@/db/schema";
import { daysBetween } from "@/lib/dates";

export type InvoiceView = Pick<Invoice, "id" | "number" | "description" | "amount" | "issuedOn" | "dueOn" | "status" | "paidOn" | "paymentUrl">;

export const isOverdue = (i: InvoiceView, today: string) => i.status === "open" && i.dueOn !== null && i.dueOn < today;

/** "Due Oct 10", "12 days overdue", "Paid Sep 3" — never "paid … overdue". */
export function invoiceDueText(i: InvoiceView, today: string): string {
  const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (i.status === "paid") return i.paidOn ? `Paid ${fmt(i.paidOn)}` : "Paid";
  if (i.status === "void") return "Void";
  if (i.status === "draft") return "Draft";
  if (!i.dueOn) return "No due date";
  const days = daysBetween(i.dueOn, today);
  if (days > 0) return `${days} day${days === 1 ? "" : "s"} overdue`;
  if (days === 0) return "Due today";
  return `Due ${fmt(i.dueOn)}`;
}

export function invoiceTotals(list: InvoiceView[], today: string) {
  const open = list.filter((i) => i.status === "open");
  return {
    due: open.reduce((s, i) => s + i.amount, 0),
    openCount: open.length,
    overdueCount: open.filter((i) => isOverdue(i, today)).length,
    paidCount: list.filter((i) => i.status === "paid").length,
  };
}
