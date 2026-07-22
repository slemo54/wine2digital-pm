import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clockifyV2Error, clockifyV2ServerError, getClockifyV2CatalogActor, parseClockifyV2Json } from "@/lib/clockify-v2-api";
import { ClockifyCatalogError } from "@/lib/clockify-v2-catalog";
import { setClockifyProjectManager } from "@/lib/clockify-v2-catalog-service";
export const dynamic = "force-dynamic";
export async function PUT(req: NextRequest, { params }: { params: { projectId: string } }): Promise<NextResponse> {
  try { const auth = await getClockifyV2CatalogActor(); if (!auth.actor) return auth.response!; const body = await parseClockifyV2Json(req); return NextResponse.json({ project: await setClockifyProjectManager(prisma, auth.actor, params.projectId, body.managerId) }); }
  catch (error) { if (error instanceof ClockifyCatalogError) return clockifyV2Error(error.status, error.message); return clockifyV2ServerError(error); }
}
