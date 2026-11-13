/** "Nov 13, 2026, 4:05 PM" in the shop's time zone. */
export function formatDateTime(date: Date, locale: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(date);
  }
}

/** "in 2 days", "in 5 hours", "in 20 minutes"; "now" if the time has passed. */
export function timeUntil(date: Date, from: Date = new Date()): string {
  const minutes = Math.round((date.getTime() - from.getTime()) / 60_000);
  if (minutes <= 0) return "now";
  if (minutes < 90) return `in ${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `in ${hours} hours`;
  return `in ${Math.round(hours / 24)} days`;
}
