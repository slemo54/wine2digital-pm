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

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await getSessionUser();
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const membership = await prisma.projectMember.findFirst({
      where: { projectId: params.id, userId: me.id },
      select: { id: true },
    });
    if (!membership) return NextResponse.json({ error: "Not a project member" }, { status: 403 });

    const tags = await prisma.projectTag.findMany({
      where: { projectId: params.id },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        color: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ tags });
  } catch (error) {
    console.error("List project tags error:", error);
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

    const body = await req.json().catch(() => ({}));
    
    // Normalize name before validation if needed, or just let Zod handle it
    const name = normalizeTagName(body?.name);
    const parseResult = tagSchema.safeParse({ ...body, name });
    
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0].message },
        { status: 400 }
      );
    }

    const { color } = parseResult.data;

    const tag = await prisma.projectTag.create({
      data: { 
        projectId: params.id, 
        name,
        color: color || "#94a3b8"
      },
      select: { id: true, name: true, color: true, createdAt: true, updatedAt: true },
    });

    return NextResponse.json({ tag }, { status: 201 });
  } catch (error: any) {
    if (String(error?.code) === "P2002") {
      return NextResponse.json({ error: "Tag already exists" }, { status: 409 });
    }
    console.error("Create project tag error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

