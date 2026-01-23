import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session-user";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const me = await getSessionUser();
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (me.globalRole !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const entityType = String(searchParams.get("entityType") || "").trim();
    const entityId = String(searchParams.get("entityId") || "").trim();
    const takeRaw = Number(searchParams.get("take") || 100);
    const take = Math.min(500, Math.max(20, Number.isFinite(takeRaw) ? takeRaw : 100));

    const logs = await prisma.auditLog.findMany({
      where: {
        AND: [
          entityType ? { entityType } : {},
          entityId ? { entityId } : {},
        ],
      },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        actor: {
          select: { id: true, email: true, name: true, firstName: true, lastName: true, image: true, role: true },
        },
      },
    });

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("Admin audit list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}




