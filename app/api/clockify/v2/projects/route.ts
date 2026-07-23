import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clockifyV2Error, clockifyV2ServerError, getClockifyV2CatalogActor, parseClockifyV2Json } from "@/lib/clockify-v2-api";
import { ClockifyCatalogError } from "@/lib/clockify-v2-catalog";
import { createClockifyProject, listClockifyProjects } from "@/lib/clockify-v2-catalog-service";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest): Promise<NextResponse> {
  try { const auth = await getClockifyV2CatalogActor(); if (!auth.actor) return auth.response!; const p = new URL(req.url).searchParams; return NextResponse.json({ projects: await listClockifyProjects(prisma, auth.actor, { q: String(p.get("q") || "").trim(), status: String(p.get("status") || "active"), clientId: String(p.get("clientId") || "").trim() }) }); }
  catch (error) { return clockifyV2ServerError(error); }
}
export async function POST(req: NextRequest): Promise<NextResponse> {
  try { const auth = await getClockifyV2CatalogActor(); if (!auth.actor) return auth.response!; return NextResponse.json({ project: await createClockifyProject(prisma, auth.actor, await parseClockifyV2Json(req)) }, { status: 201 }); }
  catch (error) { if (error instanceof ClockifyCatalogError) return clockifyV2Error(error.status, error.message); return clockifyV2ServerError(error); }
}
