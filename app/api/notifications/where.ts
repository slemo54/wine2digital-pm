export function buildMarkNotificationReadWhere(userId: string, notificationId: string) {
  return { id: notificationId, userId } as const;
}

export function buildMarkTaskNotificationsReadWhere(userId: string, taskId: string) {
  const token = `taskId=${encodeURIComponent(taskId)}`;
  return {
    userId,
    isRead: false,
    link: { contains: token },
  } as const;
}

