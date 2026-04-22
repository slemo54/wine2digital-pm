import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session-user";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const me = await getSessionUser();
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (me.globalRole !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const year = 2026;
    const startOfYear = new Date(`\${year}-01-01T00:00:00Z`);
    const endOfYear = new Date(`\${year}-12-31T23:59:59Z`);

    const absences = await prisma.absence.findMany({
      where: {
        status: {
          in: ["approved", "approvata"]
        },
        startDate: {
          gte: startOfYear,
          lte: endOfYear
        }
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            firstName: true,
            lastName: true,
            department: true,
          }
        }
      }
    });

    return NextResponse.json({ absences });
  } catch (error) {
    console.error("Admin absences summary error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
