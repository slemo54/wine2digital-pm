import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClockifyV2Actor, parseClockifyV2Json } from "@/lib/clockify-v2-api";
import { duplicateClockifyEntry, type ClockifyEntryInput } from "@/lib/clockify-v2-entries";
import { entryRouteError } from "@/lib/clockify-v2-entries-route";

export const dynamic = "force-dynamic";
export async function POST(req: NextRequest, { params }: { params: { entryId: string } }): Promise<NextResponse> {
  try { const auth = await getClockifyV2Actor(); if (!auth.actor) return auth.response!; return NextResponse.json(await duplicateClockifyEntry(prisma, auth.actor, params.entryId, await parseClockifyV2Json(req) as ClockifyEntryInput), { status: 201 }); }
  catch (error) { return entryRouteError(error); }
}
