import { NextResponse } from "next/server";
import { clockifyV2ServerError, getClockifyV2Actor } from "@/lib/clockify-v2-api";
import { getClockifyReportCatalog } from "@/lib/clockify-v2-report-catalog";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const auth = await getClockifyV2Actor();
    if (!auth.actor) return auth.response!;
    return NextResponse.json(await getClockifyReportCatalog(prisma, auth.actor));
  } catch (error) {
    return clockifyV2ServerError(error);
  }
}
