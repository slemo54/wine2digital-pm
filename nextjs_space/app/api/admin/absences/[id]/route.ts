import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session-user";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await getSessionUser();
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (me.globalRole !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const id = String(params.id || "").trim();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const existing = await prisma.absence.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, name: true, firstName: true, lastName: true } },
      },
    });

    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.absence.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        actorId: me.id,
        actionType: "admin.absence_deleted",
        entityType: "Absence",
        entityId: id,
        metadata: {
          snapshot: {
            id: existing.id,
            userId: existing.userId,
            userEmail: existing.user?.email || null,
            status: existing.status,
            type: existing.type,
            startDate: existing.startDate,
            endDate: existing.endDate,
            createdAt: existing.createdAt,
          },
        },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin delete absence error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

