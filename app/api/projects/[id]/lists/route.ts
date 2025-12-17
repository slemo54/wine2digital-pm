import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session-user";
import { canManageProjectMembers } from "@/lib/project-permissions";

export const dynamic = "force-dynamic";

const DEFAULT_LIST_NAME = "Untitled list";

function isMissingTableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("TaskList") && msg.toLowerCase().includes("does not exist");
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

    const lists = await prisma.taskList.findMany({
      where: { projectId: params.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        updatedAt: true,
        _count: { select: { tasks: true } },
      },
    });

    return NextResponse.json({ lists, defaultListName: DEFAULT_LIST_NAME });
  } catch (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json(
        { error: "TaskList table missing. Run Prisma migrations first." },
        { status: 501 }
      );
    }
    console.error("Get project lists error:", error);
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
    const name = String(body?.name || "").trim();
    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

    const list = await prisma.taskList.create({
      data: { projectId: params.id, name },
      select: { id: true, name: true, updatedAt: true },
    });

    return NextResponse.json({ list }, { status: 201 });
  } catch (error: any) {
    if (isMissingTableError(error)) {
      return NextResponse.json(
        { error: "TaskList table missing. Run Prisma migrations first." },
        { status: 501 }
      );
    }
    if (String(error?.code) === "P2002") {
      return NextResponse.json({ error: "List name already exists" }, { status: 409 });
    }
    console.error("Create project list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


