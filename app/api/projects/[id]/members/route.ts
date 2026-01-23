import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { canManageProjectMembers, normalizeProjectMemberRole } from "@/lib/project-permissions";

export const dynamic = "force-dynamic";

async function getSessionUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const user = session.user as any;
  return {
    id: String(user.id),
    email: String(user.email || ""),
    globalRole: String(user.role || ""),
  };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await getSessionUser();
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const membership = await prisma.projectMember.findFirst({
      where: { projectId: params.id, userId: me.id },
      select: { id: true },
    });
    if (!membership) return NextResponse.json({ error: "Not a project member" }, { status: 403 });

    const members = await prisma.projectMember.findMany({
      where: { projectId: params.id },
      orderBy: { joinedAt: "asc" },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            name: true,
            image: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json({ members });
  } catch (error) {
    console.error("Get project members error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await getSessionUser();
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const myMembership = await prisma.projectMember.findFirst({
      where: { projectId: params.id, userId: me.id },
      select: { role: true },
    });
    if (!myMembership) return NextResponse.json({ error: "Not a project member" }, { status: 403 });

    if (!canManageProjectMembers({ globalRole: me.globalRole, projectRole: myMembership.role })) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const userId = String(body?.userId || "");
    const role = normalizeProjectMemberRole(body?.role);

    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

    try {
      const member = await prisma.projectMember.create({
        data: {
          projectId: params.id,
          userId,
          role,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              name: true,
              image: true,
              role: true,
            },
          },
        },
      });
      return NextResponse.json({ member }, { status: 201 });
    } catch (e: any) {
      // unique constraint: already member
      if (String(e?.code) === "P2002") {
        return NextResponse.json({ error: "User already a member" }, { status: 409 });
      }
      throw e;
    }
  } catch (error) {
    console.error("Add project member error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await getSessionUser();
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const myMembership = await prisma.projectMember.findFirst({
      where: { projectId: params.id, userId: me.id },
      select: { role: true },
    });
    if (!myMembership) return NextResponse.json({ error: "Not a project member" }, { status: 403 });

    if (!canManageProjectMembers({ globalRole: me.globalRole, projectRole: myMembership.role })) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const userId = String(body?.userId || "");
    const role = normalizeProjectMemberRole(body?.role);
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

    const member = await prisma.projectMember.update({
      where: { projectId_userId: { projectId: params.id, userId } },
      data: { role },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            name: true,
            image: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json({ member });
  } catch (error) {
    console.error("Update project member role error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await getSessionUser();
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const myMembership = await prisma.projectMember.findFirst({
      where: { projectId: params.id, userId: me.id },
      select: { role: true },
    });
    if (!myMembership) return NextResponse.json({ error: "Not a project member" }, { status: 403 });

    if (!canManageProjectMembers({ globalRole: me.globalRole, projectRole: myMembership.role })) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const userId = String(body?.userId || "");
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

    const target = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: params.id, userId } },
      select: { role: true },
    });

    if (target?.role === "owner" && me.globalRole !== "admin") {
      return NextResponse.json({ error: "Cannot remove owner" }, { status: 400 });
    }

    await prisma.projectMember.delete({
      where: { projectId_userId: { projectId: params.id, userId } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove project member error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


