import { requireStaff } from "@/lib/auth";
import { toDateString } from "@/lib/dates";
import { RESULT_WINDOWS, rangeFor, type ResultWindow } from "@/lib/metrics";
import { getHoursCsv } from "@/lib/report-queries";

/** Downloads hours by client, service and team member for the chosen period. */
export async function GET(request: Request) {
  await requireStaff();
  const raw = new URL(request.url).searchParams.get("window") ?? "mtd";
  const window: ResultWindow = raw in RESULT_WINDOWS ? (raw as ResultWindow) : "mtd";
  const range = rangeFor(window, toDateString(new Date()));
  const csv = await getHoursCsv(range);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hours_${range.start}_to_${range.end}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
