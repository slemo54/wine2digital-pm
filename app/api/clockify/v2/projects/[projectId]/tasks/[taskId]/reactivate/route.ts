import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clockifyV2Error, clockifyV2ServerError, getClockifyV2CatalogActor } from "@/lib/clockify-v2-api";
import { ClockifyCatalogError } from "@/lib/clockify-v2-catalog";
import { updateClockifyTask } from "@/lib/clockify-v2-catalog-service";
export const dynamic = "force-dynamic";
export async function POST(_: Request, { params }: { params: { projectId: string; taskId: string } }): Promise<NextResponse> {
  try { const auth = await getClockifyV2CatalogActor(); if (!auth.actor) return auth.response!; return NextResponse.json({ task: await updateClockifyTask(prisma, auth.actor, params.projectId, params.taskId, { isActive: true }) }); }
  catch (error) { if (error instanceof ClockifyCatalogError) return clockifyV2Error(error.status, error.message); return clockifyV2ServerError(error); }
}
