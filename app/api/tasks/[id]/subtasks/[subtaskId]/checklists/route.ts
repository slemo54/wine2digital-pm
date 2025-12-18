import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getTaskAccessFlags } from "@/lib/task-access";

export const dynamic = "force-dynamic";

function isMissingTableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("SubtaskChecklist") && msg.toLowerCase().includes("does not exist");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; subtaskId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as any).id as string | undefined;
    const role = ((session.user as any).role as string | undefined) || "member";
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const access = await getTaskAccessFlags(prisma, params.id, userId);
    if (!access) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const subtask = await prisma.subtask.findFirst({
      where: { id: params.subtaskId, taskId: params.id },
      select: { id: true },
    });
    if (!subtask) return NextResponse.json({ error: "Subtask not found" }, { status: 404 });

    const canRead = role === "admin" || access.isAssignee || access.isProjectMember;
    if (!canRead) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });

    const checklists = await prisma.subtaskChecklist.findMany({
      where: { subtaskId: params.subtaskId },
      orderBy: { position: "asc" },
      include: { items: { orderBy: { position: "asc" } } },
    });

    return NextResponse.json({ checklists });
  } catch (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json(
        { error: "SubtaskChecklist table missing. Run Prisma migrations first." },
        { status: 501 }
      );
    }
    console.error("Error fetching subtask checklists:", error);
    return NextResponse.json({ error: "Failed to fetch subtask checklists" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; subtaskId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as any).id as string | undefined;
    const role = ((session.user as any).role as string | undefined) || "member";
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const access = await getTaskAccessFlags(prisma, params.id, userId);
    if (!access) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const subtask = await prisma.subtask.findFirst({
      where: { id: params.subtaskId, taskId: params.id },
      select: { id: true },
    });
    if (!subtask) return NextResponse.json({ error: "Subtask not found" }, { status: 404 });

    const canWrite =
      role === "admin" ||
      (role === "manager" && access.isProjectMember) ||
      (role === "member" && access.isAssignee);
    if (!canWrite) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const title = String(body?.title || "Checklist").trim() || "Checklist";

    const last = await prisma.subtaskChecklist.findFirst({
      where: { subtaskId: params.subtaskId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const position = (last?.position ?? -1) + 1;

    const checklist = await prisma.subtaskChecklist.create({
      data: { subtaskId: params.subtaskId, title, position },
      include: { items: { orderBy: { position: "asc" } } },
    });

    return NextResponse.json({ checklist }, { status: 201 });
  } catch (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json(
        { error: "SubtaskChecklist table missing. Run Prisma migrations first." },
        { status: 501 }
      );
    }
    console.error("Error creating subtask checklist:", error);
    return NextResponse.json({ error: "Failed to create checklist" }, { status: 500 });
  }
}


