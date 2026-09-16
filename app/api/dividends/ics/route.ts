import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/session";
import { getDefaultPortfolio } from "@/lib/db/portfolios";
import { getDividendCalendar } from "@/lib/dividends/dividendService";
import { buildDividendCalendarIcs } from "@/lib/dividends/icsExport";
import { apiError, apiErrorFromException } from "@/lib/utils/apiResponse";

export async function GET() {
  try {
    const user = await requireApiUser();
    const portfolio = await getDefaultPortfolio(user.id);
    if (!portfolio) {
      return apiError("NOT_FOUND", "No default portfolio found", 404);
    }

    const rows = await getDividendCalendar(user.id, portfolio.id);
    const ics = buildDividendCalendarIcs(rows, portfolio.baseCurrency);

    return new NextResponse(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="dividends.ics"',
      },
    });
  } catch (error) {
    return apiErrorFromException(error);
  }
}
