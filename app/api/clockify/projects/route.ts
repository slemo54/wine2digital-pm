import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session-user";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const me = await getSessionUser();
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const q = String(searchParams.get("q") || "").trim();

    const projects = await prisma.clockifyProject.findMany({
      where: {
        isActive: true,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { client: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ name: "asc" }, { client: "asc" }],
      take: 500,
      select: { id: true, name: true, client: true },
    });

    return NextResponse.json({ projects });
  } catch (error) {
    console.error("Clockify list projects error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

