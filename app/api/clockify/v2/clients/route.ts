import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clockifyV2Error, clockifyV2ServerError, getClockifyV2CatalogActor } from "@/lib/clockify-v2-api";
import { ClockifyCatalogError } from "@/lib/clockify-v2-catalog";
import { createClockifyClient, listClockifyClients } from "@/lib/clockify-v2-catalog-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const auth = await getClockifyV2CatalogActor(); if (!auth.actor) return auth.response!;
    return NextResponse.json({ clients: await listClockifyClients(prisma, String(new URL(req.url).searchParams.get("q") || "").trim()) });
  } catch (error) { return clockifyV2ServerError(error); }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const auth = await getClockifyV2CatalogActor(); if (!auth.actor) return auth.response!;
    return NextResponse.json({ client: await createClockifyClient(prisma, auth.actor, await req.json()) }, { status: 201 });
  } catch (error) {
    if (error instanceof ClockifyCatalogError) return clockifyV2Error(error.status, error.message);
    return clockifyV2ServerError(error);
  }
}
