import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clockifyV2ServerError, getClockifyV2Actor } from "@/lib/clockify-v2-api";

export const dynamic = "force-dynamic";
/** Entry pickers deliberately expose only active catalog records; historical entries use their embedded relation. */
export async function GET(): Promise<NextResponse> {
  try {
    const auth = await getClockifyV2Actor(); if (!auth.actor) return auth.response!;
    const projects = await prisma.clockifyProject.findMany({
      where: { isActive: true, archivedAt: null }, orderBy: [{ client: "asc" }, { name: "asc" }], take: 500,
      select: { id: true, name: true, client: true, clientId: true, color: true, tasks: { where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } } },
    });
    return NextResponse.json({ projects });
  } catch (error) { return clockifyV2ServerError(error); }
}
