const currencyFormatters = new Map<string, Intl.NumberFormat>();

function getCurrencyFormatter(currency: string) {
  let formatter = currencyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    });
    currencyFormatters.set(currency, formatter);
  }
  return formatter;
}

export function formatCurrency(amount: number, currency = "INR") {
  return getCurrencyFormatter(currency).format(amount);
}

export function formatSignedCurrency(amount: number, type: "expense" | "income" | "refund" | "transfer", currency = "INR") {
  const sign = type === "expense" || type === "transfer" ? "−" : "+";
  return `${sign}${formatCurrency(Math.abs(amount), currency)}`;
}

export function formatRelativeDate(isoDate: string, isoTime: string | null) {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const label = isoDate === today ? "Today" : isoDate === yesterday ? "Yesterday" : formatDate(isoDate);
  return isoTime ? `${label} · ${isoTime}` : label;
}

export function formatDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function formatPercent(value: number) {
  const sign = value > 0 ? "↑" : value < 0 ? "↓" : "";
  return `${sign} ${Math.abs(value).toFixed(1)}%`.trim();
}
