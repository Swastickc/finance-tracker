export function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7); // "YYYY-MM"
}

export function shiftMonthKey(key: string, delta: number): string {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string): string {
  return new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
