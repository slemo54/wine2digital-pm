import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session-user";
import { slugifyWikiTitle } from "@/lib/wiki-slug";
import { canReadWiki, canWriteWiki } from "@/lib/wiki-permissions";
import { publishRealtimeEvent } from "@/lib/realtime";

export const dynamic = "force-dynamic";

async function uniqueSlug(projectId: string, base: string): Promise<string> {
  let slug = base;
  for (let i = 1; i <= 50; i++) {
    const existing = await prisma.wikiPage.findFirst({
      where: { projectId, slug, isArchived: false },
      select: { id: true },
    });
    if (!existing) return slug;
    slug = `${base}-${i + 1}`;
  }
  return `${base}-${Date.now()}`;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await getSessionUser();
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const membership = await prisma.projectMember.findFirst({
      where: { projectId: params.id, userId: me.id },
      select: { role: true },
    });

    if (!canReadWiki({ globalRole: me.globalRole, isProjectMember: !!membership })) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const pages = await prisma.wikiPage.findMany({
      where: { projectId: params.id, isArchived: false },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        projectId: true,
        title: true,
        slug: true,
        updatedAt: true,
        createdAt: true,
        createdById: true,
        updatedById: true,
      },
    });

    return NextResponse.json({ pages });
  } catch (error) {
    console.error("List wiki pages error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await getSessionUser();
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const membership = await prisma.projectMember.findFirst({
      where: { projectId: params.id, userId: me.id },
      select: { role: true },
    });
    if (!membership && me.globalRole !== "admin") {
      return NextResponse.json({ error: "Not a project member" }, { status: 403 });
    }
    if (!canWriteWiki({ globalRole: me.globalRole, projectRole: membership?.role })) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const title = String(body?.title || "").trim();
    const content = String(body?.content || "");
    if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

    const base = slugifyWikiTitle(title);
    const slug = await uniqueSlug(params.id, base);

    const page = await prisma.wikiPage.create({
      data: {
        projectId: params.id,
        title,
        slug,
        content,
        createdById: me.id,
        updatedById: me.id,
      },
      select: {
        id: true,
        projectId: true,
        title: true,
        slug: true,
        content: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    publishRealtimeEvent({
      channel: `project-${params.id}`,
      event: "wiki.page.updated",
      data: { projectId: params.id, pageId: page.id, title: page.title },
    }).catch(() => {});

    return NextResponse.json({ page }, { status: 201 });
  } catch (error) {
    console.error("Create wiki page error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


