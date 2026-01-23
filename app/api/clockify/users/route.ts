import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session-user";
import { getClockifyVisibility, type GlobalRole } from "@/lib/clockify-scope";

export const dynamic = "force-dynamic";

function normalizeRole(input: unknown): GlobalRole {
  const r = String(input || "");
  if (r === "admin" || r === "manager" || r === "member") return r;
  return "member";
}

export async function GET() {
  try {
    const me = await getSessionUser();
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const meDb = await prisma.user.findUnique({
      where: { id: me.id },
      select: { id: true, role: true, department: true, isActive: true },
    });
    if (!meDb || meDb.isActive === false) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const visibility = getClockifyVisibility({
      globalRole: normalizeRole(meDb.role),
      userId: meDb.id,
      department: meDb.department,
    });

    const where =
      visibility.kind === "all"
        ? { isActive: true }
        : visibility.kind === "department"
          ? { isActive: true, department: visibility.department }
          : { isActive: true, id: visibility.userId };

    const users = await prisma.user.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { email: "asc" }],
      take: 500,
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        department: true,
        role: true,
      },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Clockify list users error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

