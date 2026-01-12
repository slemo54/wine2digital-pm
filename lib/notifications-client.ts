"use client";

const NOTIFICATIONS_CHANGED_EVENT = "notifications:changed" as const;

export function emitNotificationsChanged(): void {
  if (typeof window === "undefined") return;
  const ev =
    typeof Event === "function"
      ? new Event(NOTIFICATIONS_CHANGED_EVENT)
      : ({ type: NOTIFICATIONS_CHANGED_EVENT } as any);
  window.dispatchEvent(ev);
}

export async function markNotificationRead(notificationId: string): Promise<{ ok: boolean; unreadCount?: number }> {
  const id = String(notificationId || "").trim();
  if (!id) return { ok: false };
  const res = await fetch("/api/notifications", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notificationId: id }),
  });
  if (!res.ok) return { ok: false };
  const data = await res.json().catch(() => ({}));
  emitNotificationsChanged();
  return { ok: true, unreadCount: Number.isFinite((data as any)?.unreadCount) ? Number((data as any).unreadCount) : undefined };
}

export async function markAllRead(): Promise<{ ok: boolean; unreadCount?: number }> {
  const res = await fetch("/api/notifications", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ markAllRead: true }),
  });
  if (!res.ok) return { ok: false };
  const data = await res.json().catch(() => ({}));
  emitNotificationsChanged();
  return { ok: true, unreadCount: Number.isFinite((data as any)?.unreadCount) ? Number((data as any).unreadCount) : undefined };
}

export async function markTaskNotificationsRead(taskId: string): Promise<{ ok: boolean; unreadCount?: number }> {
  const id = String(taskId || "").trim();
  if (!id) return { ok: false };
  const res = await fetch("/api/notifications", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId: id }),
  });
  if (!res.ok) return { ok: false };
  const data = await res.json().catch(() => ({}));
  emitNotificationsChanged();
  return { ok: true, unreadCount: Number.isFinite((data as any)?.unreadCount) ? Number((data as any).unreadCount) : undefined };
}

