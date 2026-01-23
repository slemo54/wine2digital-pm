export function isClockifyEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CLOCKIFY_ENABLED === "true";
}

