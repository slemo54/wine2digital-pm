import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clockifyV2Error, clockifyV2ServerError, getClockifyV2CatalogActor } from "@/lib/clockify-v2-api";
import { ClockifyCatalogError } from "@/lib/clockify-v2-catalog";
import { createClockifyTask, listClockifyTasks } from "@/lib/clockify-v2-catalog-service";
export const dynamic = "force-dynamic";
export async function GET(_: NextRequest, { params }: { params: { projectId: string } }): Promise<NextResponse> {
  try { const auth = await getClockifyV2CatalogActor(); if (!auth.actor) return auth.response!; return NextResponse.json({ tasks: await listClockifyTasks(prisma, auth.actor, params.projectId) }); }
  catch (error) { if (error instanceof ClockifyCatalogError) return clockifyV2Error(error.status, error.message); return clockifyV2ServerError(error); }
}
export async function POST(req: NextRequest, { params }: { params: { projectId: string } }): Promise<NextResponse> {
  try { const auth = await getClockifyV2CatalogActor(); if (!auth.actor) return auth.response!; return NextResponse.json({ task: await createClockifyTask(prisma, auth.actor, params.projectId, await req.json()) }, { status: 201 }); }
  catch (error) { if (error instanceof ClockifyCatalogError) return clockifyV2Error(error.status, error.message); return clockifyV2ServerError(error); }
}
