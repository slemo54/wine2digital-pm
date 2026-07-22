import { NextResponse } from "next/server";
import { isClockifyV2Enabled } from "./feature-flags";
import { prisma } from "./prisma";
import { getSessionUser } from "./session-user";
import type { ClockifyGlobalRole } from "./clockify-v2-permissions";
import { ClockifyCatalogError } from "./clockify-v2-catalog";

export type ClockifyV2Actor = {
  userId: string;
  role: ClockifyGlobalRole;
  department: string | null;
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

export async function getClockifyV2Actor(): Promise<{ actor: ClockifyV2Actor | null; response?: NextResponse }> {
  if (!isClockifyV2Enabled()) return { actor: null, response: clockifyV2Error(404, "Not found") };

  let sessionUser;
  try {
    sessionUser = await getSessionUser();
  } catch {
    // Route handlers must not turn an unavailable/invalid session into a 500 response.
    return { actor: null, response: clockifyV2Error(401, "Unauthorized") };
  }
  if (!sessionUser) return { actor: null, response: clockifyV2Error(401, "Unauthorized") };

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, role: true, department: true, isActive: true },
  });
  if (!user || !user.isActive) return { actor: null, response: clockifyV2Error(401, "Unauthorized") };

  return {
    actor: {
      userId: user.id,
      role: normalizeClockifyRole(user.role || sessionUser.globalRole),
      department: normalizeClockifyDepartment(user.department ?? sessionUser.department),
    },
  };
}

/** Catalog management is intentionally narrower than future V2 time-entry APIs. */
export async function getClockifyV2CatalogActor(): Promise<{ actor: ClockifyV2Actor | null; response?: NextResponse }> {
  const auth = await getClockifyV2Actor();
  if (!auth.actor || !canUseClockifyV2Catalog(auth.actor.role)) {
    return auth.actor ? { actor: null, response: clockifyV2Error(403, "Forbidden") } : auth;
  }
  return auth;
}

export function clockifyV2ServerError(error: unknown): NextResponse {
  console.error("Clockify V2 API error:", error);
  return clockifyV2Error(500, "Internal server error");
}
