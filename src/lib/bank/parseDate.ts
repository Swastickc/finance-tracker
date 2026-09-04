/**
 * Indian bank statements commonly use either "DD/MM/YYYY" or "DD-Mon-YY"/
 * "DD-Mon-YYYY" for dates. Both are supported since the exact export format
 * of the real files hasn't been confirmed — this must be validated against
 * the real exports before trusting historical IMPORT (see bank/types.ts).
 */
const MONTHS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

export function parseIndianBankDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // "DD/MM/YYYY" or "DD-MM-YYYY"
  const numeric = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (numeric) {
    const [, d, m, y] = numeric;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // "DD-Mon-YY" or "DD-Mon-YYYY", e.g. "04-Sep-26"
  const withMonthName = trimmed.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
  if (withMonthName) {
    const [, d, monRaw, yRaw] = withMonthName;
    const month = MONTHS[monRaw.toLowerCase()];
    if (!month) return null;
    const year = yRaw.length === 2 ? `20${yRaw}` : yRaw;
    return `${year}-${month}-${d.padStart(2, "0")}`;
  }

  return null;
}
