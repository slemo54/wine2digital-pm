import type { ClockifyGlobalRole } from "./clockify-v2-permissions";

export type ClockifyV2RolloutStage = "admin" | "manager" | "member";

/** Invalid and absent configuration deliberately stays at the smallest audience. */
export function getClockifyV2RolloutStage(value = process.env.CLOCKIFY_V2_ROLLOUT_STAGE ?? process.env.NEXT_PUBLIC_CLOCKIFY_V2_ROLLOUT_STAGE): ClockifyV2RolloutStage {
  const stage = String(value ?? "").trim().toLowerCase();
  return stage === "manager" || stage === "member" ? stage : "admin";
}

export function canUseClockifyV2ForRole(role: ClockifyGlobalRole, enabled: boolean, stage = process.env.CLOCKIFY_V2_ROLLOUT_STAGE ?? process.env.NEXT_PUBLIC_CLOCKIFY_V2_ROLLOUT_STAGE): boolean {
  if (!enabled) return false;
  const allowed = getClockifyV2RolloutStage(stage);
  return role === "admin" || (allowed !== "admin" && role === "manager") || (allowed === "member" && role === "member");
}
