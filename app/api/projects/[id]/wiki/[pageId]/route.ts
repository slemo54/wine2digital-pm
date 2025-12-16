import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session-user";
import { canReadWiki, canWriteWiki } from "@/lib/wiki-permissions";
import { publishRealtimeEvent } from "@/lib/realtime";

export const dynamic = "force-dynamic";

async function requireAccess(projectId: string, me: { id: string; globalRole: string }) {
  const membership = await prisma.projectMember.findFirst({
    where: { projectId, userId: me.id },
    select: { role: true },
  });
  return { membership };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string; pageId: string } }) {
  try {
    const me = await getSessionUser();
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const page = await prisma.wikiPage.findFirst({
      where: { id: params.pageId, projectId: params.id, isArchived: false },
      include: {
        createdBy: { select: { id: true, email: true, name: true, firstName: true, lastName: true, image: true } },
        updatedBy: { select: { id: true, email: true, name: true, firstName: true, lastName: true, image: true } },
      },
    });
    if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { membership } = await requireAccess(params.id, me);
    if (!canReadWiki({ globalRole: me.globalRole, isProjectMember: !!membership })) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ page });
  } catch (error) {
    console.error("Get wiki page error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string; pageId: string } }) {
  try {
    const me = await getSessionUser();
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { membership } = await requireAccess(params.id, me);
    if (!membership && me.globalRole !== "admin") {
      return NextResponse.json({ error: "Not a project member" }, { status: 403 });
    }
    if (!canWriteWiki({ globalRole: me.globalRole, projectRole: membership?.role })) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existing = await prisma.wikiPage.findFirst({
      where: { id: params.pageId, projectId: params.id, isArchived: false },
      select: { id: true, title: true, content: true },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const title = body?.title !== undefined ? String(body.title).trim() : undefined;
    const content = body?.content !== undefined ? String(body.content) : undefined;

    // Create revision snapshot of previous content
    await prisma.wikiPageRevision.create({
      data: {
        pageId: existing.id,
        contentSnapshot: existing.content,
        createdById: me.id,
      },
    });

    const page = await prisma.wikiPage.update({
      where: { id: existing.id },
      data: {
        ...(typeof title === "string" && title ? { title } : {}),
        ...(typeof content === "string" ? { content } : {}),
        updatedById: me.id,
      },
      include: {
        createdBy: { select: { id: true, email: true, name: true, firstName: true, lastName: true, image: true } },
        updatedBy: { select: { id: true, email: true, name: true, firstName: true, lastName: true, image: true } },
      },
    });

    publishRealtimeEvent({
      channel: `project-${params.id}`,
      event: "wiki.page.updated",
      data: { projectId: params.id, pageId: page.id, title: page.title },
    }).catch(() => {});

    return NextResponse.json({ page });
  } catch (error) {
    console.error("Update wiki page error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; pageId: string } }) {
  try {
    const me = await getSessionUser();
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { membership } = await requireAccess(params.id, me);
    if (!membership && me.globalRole !== "admin") {
      return NextResponse.json({ error: "Not a project member" }, { status: 403 });
    }
    if (!canWriteWiki({ globalRole: me.globalRole, projectRole: membership?.role })) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const page = await prisma.wikiPage.findFirst({
      where: { id: params.pageId, projectId: params.id, isArchived: false },
      select: { id: true, content: true },
    });
    if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Soft-delete to preserve history
    await prisma.wikiPage.update({
      where: { id: page.id },
      data: { isArchived: true, updatedById: me.id },
    });

    publishRealtimeEvent({
      channel: `project-${params.id}`,
      event: "wiki.page.updated",
      data: { projectId: params.id, pageId: page.id, archived: true },
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete wiki page error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


