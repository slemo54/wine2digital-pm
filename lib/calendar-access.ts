/**
 * Determines if a user can access the calendar functionality.
 * 
 * Admin: always has access (override).
 * Other roles: only if calendarEnabled is not explicitly false.
 */
export function canAccessCalendar(params: {
  role?: string;
  calendarEnabled?: boolean;
}): boolean {
  const { role, calendarEnabled } = params;
  const normalizedRole = (role || "member").toLowerCase();

  // Admin override: always has access
  if (normalizedRole === "admin") {
    return true;
  }

  // For others, check calendarEnabled flag (defaults to true if undefined)
  return calendarEnabled !== false;
}
