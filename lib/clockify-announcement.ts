export const CLOCKIFY_ANNOUNCEMENT_KEY = "clockify-module-v1";

export function shouldShowClockifyAnnouncement(input: {
  enabled: boolean;
  readAt: Date | null;
}): boolean {
  return input.enabled && input.readAt === null;
}
