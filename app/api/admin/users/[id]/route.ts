import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session-user";
import { publishRealtimeEvent } from "@/lib/realtime";

export const dynamic = "force-dynamic";

type PatchBody = {
  role?: "admin" | "manager" | "member";
  isActive?: boolean;
};

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await getSessionUser();
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (me.globalRole !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = (await req.json()) as PatchBody;
    const nextRole = body?.role;
    const nextActive = body?.isActive;

    const target = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, role: true, isActive: true },
    });
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // guard: prevent locking out last admin (best-effort)
    if (target.role === "admin" && nextRole && nextRole !== "admin") {
      const adminCount = await prisma.user.count({ where: { role: "admin", isActive: true } });
      if (adminCount <= 1) {
        return NextResponse.json({ error: "Cannot demote last active admin" }, { status: 400 });
      }
    }

    const updated = await prisma.user.update({
      where: { id: params.id },
      data: {
        ...(nextRole ? { role: nextRole } : {}),
        ...(typeof nextActive === "boolean"
          ? { isActive: nextActive, disabledAt: nextActive ? null : new Date() }
          : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        disabledAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: me.id,
        actionType: "admin.user_updated",
        entityType: "User",
        entityId: updated.id,
        metadata: {
          from: { role: target.role, isActive: target.isActive },
          to: { role: updated.role, isActive: updated.isActive },
        },
      },
    });

    publishRealtimeEvent({
      channel: "admin",
      event: "admin.user.updated",
      data: { userId: updated.id, role: updated.role, isActive: updated.isActive },
    }).catch(() => {});

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error("Admin update user error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


