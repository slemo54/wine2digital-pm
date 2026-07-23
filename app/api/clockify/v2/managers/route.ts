import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clockifyV2Error, clockifyV2ServerError, getClockifyV2CatalogActor } from "@/lib/clockify-v2-api";
export const dynamic = "force-dynamic";
export async function GET(_: NextRequest): Promise<NextResponse> {
  try {
    const auth = await getClockifyV2CatalogActor(); if (!auth.actor) return auth.response!;
    if (auth.actor.role !== "admin") return clockifyV2Error(403, "Forbidden");
    const managers = await prisma.user.findMany({ where: { isActive: true, role: { in: ["admin", "manager"] } }, orderBy: [{ name: "asc" }, { email: "asc" }], select: { id: true, name: true, email: true, role: true } });
    return NextResponse.json({ managers });
  } catch (error) { return clockifyV2ServerError(error); }
}
