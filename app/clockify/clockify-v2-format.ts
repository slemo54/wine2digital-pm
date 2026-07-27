const ROME = "Europe/Rome";

export function clockifyRomeDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ROME,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function clockifyRomeTime(value: Date | string): string {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: ROME,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(value instanceof Date ? value : new Date(value));
}

export function formatClockifyDuration(value: number): string {
  const minutes = Math.max(0, Math.round(Number(value) || 0));
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function formatClockifyDay(value: string, style: "short" | "long" = "long"): string {
  const date = new Date(`${value}T12:00:00Z`);
  return new Intl.DateTimeFormat("it-IT", style === "long"
    ? { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }
    : { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(date);
}

export function formatClockifyPeriod(from: string, to: string): string {
  if (from === to) return formatClockifyDay(from);
  const start = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  const formatter = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

export function clockifyDateInputToDate(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  return new Date(`${value}T12:00:00Z`);
}
