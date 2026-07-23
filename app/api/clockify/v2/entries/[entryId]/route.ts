import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClockifyV2Actor, parseClockifyV2Json } from "@/lib/clockify-v2-api";
import { deleteClockifyEntry, updateClockifyEntry, type ClockifyEntryInput } from "@/lib/clockify-v2-entries";
import { entryRouteError } from "@/lib/clockify-v2-entries-route";

export const dynamic = "force-dynamic";
export async function PATCH(req: NextRequest, { params }: { params: { entryId: string } }): Promise<NextResponse> {
  try { const auth = await getClockifyV2Actor(); if (!auth.actor) return auth.response!; return NextResponse.json(await updateClockifyEntry(prisma, auth.actor, params.entryId, await parseClockifyV2Json(req) as ClockifyEntryInput)); }
  catch (error) { return entryRouteError(error); }
}
export async function DELETE(_: NextRequest, { params }: { params: { entryId: string } }): Promise<NextResponse> {
  try { const auth = await getClockifyV2Actor(); if (!auth.actor) return auth.response!; await deleteClockifyEntry(prisma, auth.actor, params.entryId); return new NextResponse(null, { status: 204 }); }
  catch (error) { return entryRouteError(error); }
}
