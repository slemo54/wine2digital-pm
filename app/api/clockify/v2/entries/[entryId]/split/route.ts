import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClockifyV2Actor, parseClockifyV2Json } from "@/lib/clockify-v2-api";
import { splitClockifyEntry } from "@/lib/clockify-v2-entries";
import { entryRouteError } from "@/lib/clockify-v2-entries-route";

export const dynamic = "force-dynamic";
export async function POST(req: NextRequest, { params }: { params: { entryId: string } }): Promise<NextResponse> {
  try { const auth = await getClockifyV2Actor(); if (!auth.actor) return auth.response!; const body = await parseClockifyV2Json(req); return NextResponse.json(await splitClockifyEntry(prisma, auth.actor, params.entryId, { splitDate: body.splitDate, splitTime: body.splitTime })); }
  catch (error) { return entryRouteError(error); }
}
