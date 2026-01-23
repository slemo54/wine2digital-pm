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
    const q = String(searchParams.get("q") || "").trim();
    const role = String(searchParams.get("role") || "").trim();
    const active = searchParams.get("active");

    const users = await prisma.user.findMany({
      where: {
        AND: [
          q
            ? {
                OR: [
                  { email: { contains: q, mode: "insensitive" } },
                  { name: { contains: q, mode: "insensitive" } },
                  { firstName: { contains: q, mode: "insensitive" } },
                  { lastName: { contains: q, mode: "insensitive" } },
                ],
              }
            : {},
          role ? { role } : {},
          active === "true" ? { isActive: true } : {},
          active === "false" ? { isActive: false } : {},
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        department: true,
        role: true,
        isActive: true,
        calendarEnabled: true,
        disabledAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Admin list users error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}




