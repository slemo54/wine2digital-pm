import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session-user";
import { publishRealtimeEvent } from "@/lib/realtime";
import { normalizeDepartment } from "@/lib/departments";
import {
  buildAdminUserAuditChanges,
  parseAdminUserUpdate,
  wouldDisableLastActiveAdmin,
} from "@/lib/admin-user-update";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await getSessionUser();
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (me.globalRole !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const parsed = parseAdminUserUpdate(await req.json());
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const body = parsed.value;
    const nextRole = body?.role;
    const nextActive = body?.isActive;
    const nextCalendarEnabled = body?.calendarEnabled;
    const nextDepartmentRaw = body?.department;
    const nextDepartment =
      nextDepartmentRaw === null
        ? null
        : typeof nextDepartmentRaw === "string"
          ? nextDepartmentRaw.trim() || null
          : undefined;

    if (nextDepartment !== undefined && nextDepartment !== null) {
      if (!(await normalizeDepartment(nextDepartment))) return NextResponse.json({ error: "Invalid department" }, { status: 400 });
    }

    const target = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, email: true, role: true, isActive: true, department: true, calendarEnabled: true },
    });
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const removesActiveAdmin =
      target.role === "admin" &&
      target.isActive &&
      (nextActive === false || (nextRole !== undefined && nextRole !== "admin"));
    if (removesActiveAdmin) {
      const adminCount = await prisma.user.count({ where: { role: "admin", isActive: true } });
      if (wouldDisableLastActiveAdmin({ target, patch: body, activeAdminCount: adminCount })) {
        return NextResponse.json({ error: "Cannot disable or demote the last active admin" }, { status: 400 });
      }
    }

    const updated = await prisma.user.update({
      where: { id: params.id },
      data: {
        ...(nextRole ? { role: nextRole } : {}),
        ...(typeof nextActive === "boolean"
          ? { isActive: nextActive, disabledAt: nextActive ? null : new Date() }
          : {}),
        ...(typeof nextCalendarEnabled === "boolean" ? { calendarEnabled: nextCalendarEnabled } : {}),
        ...(nextDepartment !== undefined ? { department: nextDepartment } : {}),
      },
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

    await prisma.auditLog.create({
      data: {
        actorId: me.id,
        actionType: "admin.user_updated",
        entityType: "User",
        entityId: updated.id,
        metadata: {
          targetEmail: target.email,
          changes: buildAdminUserAuditChanges(target, updated),
          from: { role: target.role, isActive: target.isActive, department: target.department, calendarEnabled: target.calendarEnabled },
          to: { role: updated.role, isActive: updated.isActive, department: updated.department, calendarEnabled: updated.calendarEnabled },
        },
      },
    });

    publishRealtimeEvent({
      channel: "admin",
      event: "admin.user.updated",
      data: { userId: updated.id, role: updated.role, isActive: updated.isActive, department: updated.department, calendarEnabled: updated.calendarEnabled },
    }).catch(() => {});

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error("Admin update user error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
