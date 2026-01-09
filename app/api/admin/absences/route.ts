import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session-user";
import { buildAdminAbsencesWhere, parseOptionalDate, parseOptionalInt } from "@/lib/admin-absences-filters";

export const dynamic = "force-dynamic";

type AbsenceStatus = "pending" | "approved" | "rejected";

export async function GET(req: NextRequest) {
  try {
    const me = await getSessionUser();
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (me.globalRole !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);

    const q = String(searchParams.get("q") || "").trim();
    const statusParam = String(searchParams.get("status") || "").trim();
    const typeParam = String(searchParams.get("type") || "").trim();

    const includeCounts = String(searchParams.get("includeCounts") || "").trim() === "true";

    const takeRaw = parseOptionalInt(searchParams.get("take"));
    const skipRaw = parseOptionalInt(searchParams.get("skip"));
    const take = takeRaw === null ? 50 : Math.max(1, Math.min(500, takeRaw));
    const skip = skipRaw === null ? 0 : Math.max(0, skipRaw);

    const from = parseOptionalDate(searchParams.get("from"));
    const to = parseOptionalDate(searchParams.get("to"));
    const createdFrom = parseOptionalDate(searchParams.get("createdFrom"));
    const createdTo = parseOptionalDate(searchParams.get("createdTo"));

    if ((searchParams.get("from") && !from) || (searchParams.get("to") && !to)) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
    }
    if ((searchParams.get("createdFrom") && !createdFrom) || (searchParams.get("createdTo") && !createdTo)) {
      return NextResponse.json({ error: "Invalid createdAt range" }, { status: 400 });
    }

    const { where, countsWhere } = buildAdminAbsencesWhere({
      q,
      statusParam,
      typeParam,
      from,
      to,
      createdFrom,
      createdTo,
    });

    const [absences, total, counts] = await Promise.all([
      prisma.absence.findMany({
        where: where as any,
        orderBy: { createdAt: "desc" },
        take,
        skip,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.absence.count({ where: where as any }),
      includeCounts
        ? prisma.absence.groupBy({
            by: ["status"],
            where: countsWhere as any,
            _count: { _all: true },
          })
        : Promise.resolve([] as Array<{ status: string; _count: { _all: number } }>),
    ]);

    const countsByStatus = (() => {
      if (!includeCounts) return undefined;
      const map = new Map<string, number>();
      for (const row of counts) map.set(String(row.status), Number(row._count?._all || 0));
      const pending = map.get("pending") || 0;
      const approved = map.get("approved") || 0;
      const rejected = map.get("rejected") || 0;
      return { pending, approved, rejected, total: pending + approved + rejected };
    })();

    return NextResponse.json({ absences, total, ...(countsByStatus ? { counts: countsByStatus } : {}) });
  } catch (error) {
    console.error("Admin list absences error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

