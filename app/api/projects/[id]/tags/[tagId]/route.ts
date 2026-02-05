import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session-user";
import { canManageProjectMembers } from "@/lib/project-permissions";
import { tagSchema } from "@/lib/project-tag-schema";

export const dynamic = "force-dynamic";

function normalizeTagName(input: unknown): string {
  const raw = String(input || "")
    .trim()
    .replace(/\s+/g, " ");
  return raw.toUpperCase();
}

export async function PUT(req: NextRequest, { params }: { params: { id: string; tagId: string } }) {
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

    // Validate both name and color using tagSchema
    const name = normalizeTagName(body?.name);
    const parseResult = tagSchema.safeParse({ ...body, name });

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0].message },
        { status: 400 }
      );
    }

    const { color } = parseResult.data;

    const existing = await prisma.projectTag.findFirst({
      where: { id: params.tagId, projectId: params.id },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: "Tag not found" }, { status: 404 });

    // Update both name and color (color optional)
    const updated = await prisma.projectTag.update({
      where: { id: params.tagId },
      data: {
        name,
        ...(color && { color }),
      },
      select: { id: true, name: true, color: true, createdAt: true, updatedAt: true },
    });

    return NextResponse.json({ tag: updated });
  } catch (error: any) {
    if (String(error?.code) === "P2002") {
      return NextResponse.json({ error: "Tag already exists" }, { status: 409 });
    }
    console.error("Update project tag error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; tagId: string } }) {
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

    const existing = await prisma.projectTag.findFirst({
      where: { id: params.tagId, projectId: params.id },
      select: { id: true, name: true },
    });
    if (!existing) return NextResponse.json({ error: "Tag not found" }, { status: 404 });

    await prisma.projectTag.delete({ where: { id: params.tagId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete project tag error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

