import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import { clockifyV2Error, clockifyV2ServerError, getClockifyV2Actor, parseClockifyV2Json } from "./clockify-v2-api";
import {
  asClockifyEntryError,
  createClockifyEntry,
  listClockifyEntries,
  type ClockifyEntryInput,
} from "./clockify-v2-entries";

type EntriesDependencies = {
  getActor: typeof getClockifyV2Actor;
  list: typeof listClockifyEntries;
  create: typeof createClockifyEntry;
};

const defaults: EntriesDependencies = { getActor: getClockifyV2Actor, list: listClockifyEntries, create: createClockifyEntry };

export function entryRouteError(error: unknown): NextResponse {
  const known = asClockifyEntryError(error);
  return known ? clockifyV2Error(known.status, known.message) : clockifyV2ServerError(error);
}

export function createClockifyEntriesRouteHandlers(overrides: Partial<EntriesDependencies> = {}): {
  GET: (request: Request) => Promise<NextResponse>;
  POST: (request: Request) => Promise<NextResponse>;
} {
  const dependencies = { ...defaults, ...overrides };
  return {
    async GET(request: Request): Promise<NextResponse> {
      try {
        const auth = await dependencies.getActor();
        if (!auth.actor) return auth.response!;
        const params = new URL(request.url).searchParams;
        return NextResponse.json(await dependencies.list(prisma, auth.actor, { from: params.get("from"), to: params.get("to") }));
      } catch (error) { return entryRouteError(error); }
    },
    async POST(request: Request): Promise<NextResponse> {
      try {
        const auth = await dependencies.getActor();
        if (!auth.actor) return auth.response!;
        return NextResponse.json(await dependencies.create(prisma, auth.actor, await parseClockifyV2Json(request) as ClockifyEntryInput), { status: 201 });
      } catch (error) { return entryRouteError(error); }
    },
  };
}

