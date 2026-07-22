import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canUseClockifyV2Catalog, clockifyV2Error, clockifyV2ServerError, getClockifyV2CatalogActor, parseClockifyV2Json } from "@/lib/clockify-v2-api";
import { ClockifyCatalogError } from "@/lib/clockify-v2-catalog";
import { createClockifyClient, listClockifyClients } from "@/lib/clockify-v2-catalog-service";

type ClientsRouteDependencies = {
  getActor: typeof getClockifyV2CatalogActor;
  listClients: typeof listClockifyClients;
  createClient: typeof createClockifyClient;
};

export function createClientsRouteHandlers(dependencies: ClientsRouteDependencies = {
  getActor: getClockifyV2CatalogActor,
  listClients: listClockifyClients,
  createClient: createClockifyClient,
}): { GET: (req: NextRequest) => Promise<NextResponse>; POST: (req: NextRequest) => Promise<NextResponse> } {
  return {
    async GET(req: NextRequest): Promise<NextResponse> {
      try {
        const auth = await dependencies.getActor(); if (!auth.actor) return auth.response!;
        if (!canUseClockifyV2Catalog(auth.actor.role)) return clockifyV2Error(403, "Forbidden");
        return NextResponse.json({ clients: await dependencies.listClients(prisma, String(new URL(req.url).searchParams.get("q") || "").trim()) });
      } catch (error) { return clockifyV2ServerError(error); }
    },
    async POST(req: NextRequest): Promise<NextResponse> {
      try {
        const auth = await dependencies.getActor(); if (!auth.actor) return auth.response!;
        if (!canUseClockifyV2Catalog(auth.actor.role)) return clockifyV2Error(403, "Forbidden");
        return NextResponse.json({ client: await dependencies.createClient(prisma, auth.actor, await parseClockifyV2Json(req)) }, { status: 201 });
      } catch (error) {
        if (error instanceof ClockifyCatalogError) return clockifyV2Error(error.status, error.message);
        return clockifyV2ServerError(error);
      }
    },
  };
}
