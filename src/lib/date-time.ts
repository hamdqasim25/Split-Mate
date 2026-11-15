const options: Intl.DateTimeFormatOptions = {
  timeZone: "Europe/London", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
};
const short = new Intl.DateTimeFormat("en-GB", { ...options, month: "short" });
const full = new Intl.DateTimeFormat("en-GB", { ...options, month: "long", year: "numeric" });

/** Explicit timezone and parts keep server/client output independent of local settings. */
export function formatHistoryTime(value: string, expanded = false): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Date unavailable";
  const parts = (expanded ? full : short).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(value => value.type === type)?.value;
  return `${part("day")} ${part("month")}${expanded ? ` ${part("year")}` : ""}, ${part("hour")}:${part("minute")}`;
}
