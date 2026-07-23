import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import { getClockifyV2Actor, clockifyV2Error, clockifyV2ServerError } from "./clockify-v2-api";
import { auditClockifyEntries, ClockifyAuditError, normalizeClockifyAuditInput } from "./clockify-v2-audit";

export function createClockifyAuditRouteHandlers(dependencies = { getActor: getClockifyV2Actor, audit: auditClockifyEntries }) {
  return { GET: async (request: Request): Promise<NextResponse> => {
    try {
      const auth = await dependencies.getActor(); if (!auth.actor) return auth.response!;
      const input = normalizeClockifyAuditInput(Object.fromEntries(new URL(request.url).searchParams));
      return NextResponse.json(await dependencies.audit(prisma, auth.actor, input));
    } catch (error) { return error instanceof ClockifyAuditError ? clockifyV2Error(error.status, error.message) : clockifyV2ServerError(error); }
  } };
}
