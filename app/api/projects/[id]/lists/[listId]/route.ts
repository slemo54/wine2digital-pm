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

export async function PUT(req: NextRequest, { params }: { params: { id: string; listId: string } }) {
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
    if (name === DEFAULT_LIST_NAME) return NextResponse.json({ error: "Reserved list name" }, { status: 400 });

    const list = await prisma.taskList.findFirst({
      where: { id: params.listId, projectId: params.id },
      select: { id: true },
    });
    if (!list) return NextResponse.json({ error: "List not found" }, { status: 404 });

    const updated = await prisma.taskList.update({
      where: { id: params.listId },
      data: { name },
      select: { id: true, name: true, updatedAt: true },
    });

    return NextResponse.json({ list: updated });
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
    console.error("Rename list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; listId: string } }) {
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

    const target = await prisma.taskList.findFirst({
      where: { id: params.listId, projectId: params.id },
      select: { id: true, name: true },
    });
    if (!target) return NextResponse.json({ error: "List not found" }, { status: 404 });
    if (target.name === DEFAULT_LIST_NAME) {
      return NextResponse.json({ error: "Cannot delete default list" }, { status: 400 });
    }

    const defaultList = await prisma.taskList.upsert({
      where: { projectId_name: { projectId: params.id, name: DEFAULT_LIST_NAME } },
      create: { projectId: params.id, name: DEFAULT_LIST_NAME },
      update: {},
      select: { id: true },
    });

    await prisma.task.updateMany({
      where: { projectId: params.id, listId: params.listId },
      data: { listId: defaultList.id },
    });

    await prisma.taskList.delete({ where: { id: params.listId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json(
        { error: "TaskList table missing. Run Prisma migrations first." },
        { status: 501 }
      );
    }
    console.error("Delete list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


