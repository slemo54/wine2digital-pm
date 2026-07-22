export function isClockifyEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CLOCKIFY_ENABLED === "true";
}

export function isClockifyV2Enabled(): boolean {
  return process.env.NEXT_PUBLIC_CLOCKIFY_V2_ENABLED === "true";
}
