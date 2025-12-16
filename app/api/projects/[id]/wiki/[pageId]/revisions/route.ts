import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session-user";
import { canReadWiki } from "@/lib/wiki-permissions";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string; pageId: string } }) {
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

    const revisions = await prisma.wikiPageRevision.findMany({
      where: { pageId: params.pageId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        createdBy: { select: { id: true, email: true, name: true, firstName: true, lastName: true, image: true } },
      },
    });

    return NextResponse.json({ revisions });
  } catch (error) {
    console.error("List wiki revisions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


