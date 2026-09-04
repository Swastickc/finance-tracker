export const IST_TIME_ZONE = "Asia/Kolkata";

/**
 * Converts an absolute instant to its calendar date/time in the given IANA
 * timezone. RFC 2822 email `Date` headers carry their own UTC offset, so
 * `new Date(rfc2822)` already resolves to the correct instant — the historical
 * bug here was formatting that instant with `.toISOString()` (UTC) instead of
 * India Standard Time, which can shift the calendar date for early-morning IST
 * timestamps (IST is UTC+5:30, with no DST).
 */
export function formatInTimeZone(date: Date, timeZone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23", // avoids the "24:00" midnight quirk some engines produce with hour12: false
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}
