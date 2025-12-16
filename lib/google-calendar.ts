export type EventStatus = "present" | "wfh" | "leave_approved" | "leave_pending" | "other";

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  status: EventStatus;
  location?: string;
};

export function deriveStatusFromTitle(title: string): EventStatus {
  const normalized = title.toLowerCase();
  if (normalized.includes("wfh") || normalized.includes("work from home")) return "wfh";
  if (normalized.includes("leave request") || normalized.includes("pending")) return "leave_pending";
  if (normalized.includes("leave")) return "leave_approved";
  if (normalized.includes("present") || normalized.includes("general shift")) return "present";
  return "other";
}

export function mapGoogleEvent(item: any): CalendarEvent {
  const startRaw = item.start?.dateTime || item.start?.date;
  const endRaw = item.end?.dateTime || item.end?.date;
  const allDay = Boolean(item.start?.date);

  return {
    id: item.id,
    title: item.summary || "Evento",
    start: startRaw,
    end: endRaw,
    allDay,
    status: deriveStatusFromTitle(item.summary || ""),
    location: item.location,
  };
}


