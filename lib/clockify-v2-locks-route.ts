import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import { clockifyV2Error, clockifyV2ServerError, getClockifyV2Actor, parseClockifyV2Json } from "./clockify-v2-api";
import { asClockifyLockError, createClockifyLockPeriod, listClockifyLockPeriods, lockClockifyEntry, unlockClockifyEntry } from "./clockify-v2-locks";

function errorResponse(error: unknown): NextResponse {
  const known = asClockifyLockError(error);
  return known ? clockifyV2Error(known.status, known.message) : clockifyV2ServerError(error);
}

type EntryDependencies = { getActor: typeof getClockifyV2Actor; lock: typeof lockClockifyEntry; unlock: typeof unlockClockifyEntry };
type PeriodDependencies = { getActor: typeof getClockifyV2Actor; list: typeof listClockifyLockPeriods; create: typeof createClockifyLockPeriod };
const entryDefaults: EntryDependencies = { getActor: getClockifyV2Actor, lock: lockClockifyEntry, unlock: unlockClockifyEntry };
const periodDefaults: PeriodDependencies = { getActor: getClockifyV2Actor, list: listClockifyLockPeriods, create: createClockifyLockPeriod };

export function createClockifyEntryLockRouteHandlers(overrides: Partial<EntryDependencies> = {}): { POST: (request: Request, entryId: string) => Promise<NextResponse>; DELETE: (request: Request, entryId: string) => Promise<NextResponse> } {
  const dependencies = { ...entryDefaults, ...overrides };
  async function run(request: Request, entryId: string, locked: boolean): Promise<NextResponse> {
    try {
      const auth = await dependencies.getActor(); if (!auth.actor) return auth.response!;
      if (auth.actor.role !== "admin") return clockifyV2Error(403, "Forbidden");
      return NextResponse.json(await (locked ? dependencies.lock : dependencies.unlock)(prisma, auth.actor, entryId));
    } catch (error) { return errorResponse(error); }
  }
  return { POST: (request, entryId) => run(request, entryId, true), DELETE: (request, entryId) => run(request, entryId, false) };
}

export function createClockifyLockPeriodsRouteHandlers(overrides: Partial<PeriodDependencies> = {}): { GET: (request: Request) => Promise<NextResponse>; POST: (request: Request) => Promise<NextResponse> } {
  const dependencies = { ...periodDefaults, ...overrides };
  return {
    async GET(_: Request): Promise<NextResponse> {
      try { const auth = await dependencies.getActor(); if (!auth.actor) return auth.response!; if (auth.actor.role !== "admin") return clockifyV2Error(403, "Forbidden"); return NextResponse.json({ lockPeriods: await dependencies.list(prisma, auth.actor) }); }
      catch (error) { return errorResponse(error); }
    },
    async POST(request: Request): Promise<NextResponse> {
      try { const auth = await dependencies.getActor(); if (!auth.actor) return auth.response!; if (auth.actor.role !== "admin") return clockifyV2Error(403, "Forbidden"); return NextResponse.json({ lockPeriod: await dependencies.create(prisma, auth.actor, await parseClockifyV2Json(request)) }, { status: 201 }); }
      catch (error) { return errorResponse(error); }
    },
  };
}

export async function unlockClockifyPeriodRoute(request: Request, periodId: string): Promise<NextResponse> {
  try {
    const auth = await getClockifyV2Actor(); if (!auth.actor) return auth.response!;
    if (auth.actor.role !== "admin") return clockifyV2Error(403, "Forbidden");
    const { unlockClockifyLockPeriod } = await import("./clockify-v2-locks");
    return NextResponse.json({ lockPeriod: await unlockClockifyLockPeriod(prisma, auth.actor, periodId) });
  } catch (error) { return errorResponse(error); }
}
