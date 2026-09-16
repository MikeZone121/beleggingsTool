import type { DividendCalendarRow } from "./dividendService";

function toIcsDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

/** Escapes the characters ICS's TEXT value type requires escaped — commas,
 * semicolons, backslashes, and newlines (RFC 5545 §3.3.11). */
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .replace(/\n/g, "\\n");
}

/** RFC 5545 requires CRLF line breaks and recommends folding lines over
 * 75 octets — this app's summaries/descriptions are short enough in
 * practice that folding isn't needed, but CRLF is required for many
 * calendar clients to parse the file at all. */
const CRLF = "\r\n";

/**
 * One all-day VEVENT per holding's next estimated ex-dividend date — a
 * calendar app already sitting on the user's phone/desktop is a better
 * place for "don't forget this is coming up" than a tab they have to
 * remember to open. Dates are estimates (see getDividendCalendar), so
 * each event's summary says so rather than presenting it as confirmed.
 */
export function buildDividendCalendarIcs(rows: DividendCalendarRow[], baseCurrency: string): string {
  const now = toIcsDate(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Canopy//Dividend Calendar//EN",
    "CALSCALE:GREGORIAN",
  ];

  for (const row of rows) {
    const start = row.estimate.estimatedNextExDate;
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const netLabel = row.payout.netBase ? `${row.payout.netBase.toFixed(2)} ${baseCurrency}` : "unknown";
    const description = [
      `Estimated ex-dividend date for ${row.ticker} (${row.name}).`,
      `Last paid ${row.estimate.lastAmountPerShare.toString()} ${row.currency}/share on ${row.estimate.lastExDate.toISOString().slice(0, 10)}.`,
      `Estimated net payout after 30% Belgian withholding tax: ~${netLabel}.`,
      "This is a projection from past payment history, not a confirmed date.",
    ].join("\n");

    lines.push(
      "BEGIN:VEVENT",
      `UID:dividend-${row.securityId}-${toIcsDate(start)}@canopy`,
      `DTSTAMP:${now}T000000Z`,
      `DTSTART;VALUE=DATE:${toIcsDate(start)}`,
      `DTEND;VALUE=DATE:${toIcsDate(end)}`,
      `SUMMARY:${escapeIcsText(`${row.ticker} est. ex-dividend (~${netLabel} net)`)}`,
      `DESCRIPTION:${escapeIcsText(description)}`,
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join(CRLF);
}
