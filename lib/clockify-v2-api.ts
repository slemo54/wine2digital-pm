import { NextResponse } from "next/server";
import { isClockifyV2Enabled } from "./feature-flags";
import { prisma } from "./prisma";
import { getSessionUser } from "./session-user";
import type { ClockifyGlobalRole } from "./clockify-v2-permissions";
import { ClockifyCatalogError } from "./clockify-v2-catalog";
import { canUseClockifyV2ForRole } from "./clockify-v2-rollout";

export type ClockifyV2Actor = {
  userId: string;
  role: ClockifyGlobalRole;
  department: string | null;
};

type ClockifyV2ActorDbUser = {
  id: string;
  role: string;
  department: string | null;
  isActive: boolean;
};

export type ClockifyV2ActorDependencies = {
  isEnabled: () => boolean;
  getSession: typeof getSessionUser;
  findUser: (id: string) => Promise<ClockifyV2ActorDbUser | null>;
};

const defaultClockifyV2ActorDependencies: ClockifyV2ActorDependencies = {
  isEnabled: isClockifyV2Enabled,
  getSession: getSessionUser,
  findUser: (id) => prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, department: true, isActive: true },
  }),
};

export function clockifyV2Error(status: number, error: string): NextResponse {
  return NextResponse.json({ error }, { status });
}

export async function parseClockifyV2Json(req: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ClockifyCatalogError(400, "Invalid JSON body");
  }
  if (!body || Array.isArray(body) || typeof body !== "object") {
    throw new ClockifyCatalogError(400, "JSON body must be an object");
  }
  return body as Record<string, unknown>;
}

export function normalizeClockifyRole(input: unknown): ClockifyGlobalRole {
  const role = String(input ?? "").trim().toLowerCase();
  return role === "admin" || role === "manager" || role === "member" ? role : "member";
}

export function normalizeClockifyDepartment(input: unknown): string | null {
  const department = String(input ?? "").normalize("NFKC").trim().replace(/\s+/g, " ");
  return department || null;
}

export function canUseClockifyV2Catalog(role: ClockifyGlobalRole): boolean {
  return role === "admin" || role === "manager";
}

export async function getClockifyV2Actor(dependencies: ClockifyV2ActorDependencies = defaultClockifyV2ActorDependencies): Promise<{ actor: ClockifyV2Actor | null; response?: NextResponse }> {
  if (!dependencies.isEnabled()) return { actor: null, response: clockifyV2Error(404, "Not found") };

  let sessionUser;
  try {
    sessionUser = await dependencies.getSession();
  } catch {
    // Route handlers must not turn an unavailable/invalid session into a 500 response.
    return { actor: null, response: clockifyV2Error(401, "Unauthorized") };
  }
  if (!sessionUser) return { actor: null, response: clockifyV2Error(401, "Unauthorized") };

  const user = await dependencies.findUser(sessionUser.id);
  if (!user || !user.isActive) return { actor: null, response: clockifyV2Error(401, "Unauthorized") };

  const role = normalizeClockifyRole(user.role || sessionUser.globalRole);
  if (!canUseClockifyV2ForRole(role, true)) return { actor: null, response: clockifyV2Error(404, "Not found") };
  return { actor: { userId: user.id, role, department: normalizeClockifyDepartment(user.department ?? sessionUser.department) } };
}

/** Catalog management is intentionally narrower than future V2 time-entry APIs. */
export async function getClockifyV2CatalogActor(dependencies?: ClockifyV2ActorDependencies): Promise<{ actor: ClockifyV2Actor | null; response?: NextResponse }> {
  const auth = await getClockifyV2Actor(dependencies);
  if (!auth.actor || !canUseClockifyV2Catalog(auth.actor.role)) {
    return auth.actor ? { actor: null, response: clockifyV2Error(403, "Forbidden") } : auth;
  }
  return auth;
}

export function clockifyV2ServerError(error: unknown): NextResponse {
  console.error("Clockify V2 API error:", error);
  return clockifyV2Error(500, "Internal server error");
}
