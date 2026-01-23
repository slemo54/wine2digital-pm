import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session-user";

export const dynamic = "force-dynamic";

type SearchType = "tasks" | "projects" | "files" | "wiki";

function parseTypes(raw: string | null): SearchType[] {
  if (!raw) return ["tasks", "projects", "files", "wiki"];
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const allowed = new Set<SearchType>(["tasks", "projects", "files", "wiki"]);
  const out = parts.filter((p): p is SearchType => allowed.has(p as SearchType));
  return out.length ? out : ["tasks", "projects", "files", "wiki"];
}

export async function GET(req: NextRequest) {
  try {
    const me = await getSessionUser();
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const qRaw = String(searchParams.get("q") || "").trim();
    if (!qRaw) return NextResponse.json({ results: [] });

    const types = parseTypes(searchParams.get("types"));
    const limitRaw = Number(searchParams.get("limit") || 20);
    const limit = Math.min(50, Math.max(5, Number.isFinite(limitRaw) ? limitRaw : 20));

    const q = qRaw.slice(0, 200);
    const results: any[] = [];

    const canSeeProject = {
      OR: [
        { creatorId: me.id },
        { members: { some: { userId: me.id } } },
      ],
    };

    if (types.includes("projects")) {
      const projects = await prisma.project.findMany({
        where: {
          AND: [
            canSeeProject,
            {
              OR: [
                { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { description: { contains: q, mode: Prisma.QueryMode.insensitive } },
              ],
            },
          ],
        },
        take: Math.min(limit, 20),
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true, description: true },
      });
      results.push(
        ...projects.map((p) => ({
          type: "project",
          id: p.id,
          title: p.name,
          subtitle: p.description || "",
          href: `/project/${p.id}`,
        }))
      );
    }

    if (types.includes("tasks")) {
      const tasks = await prisma.task.findMany({
        where: {
          AND: [
            {
              OR: [
                { assignees: { some: { userId: me.id } } },
                { project: { members: { some: { userId: me.id } } } },
              ],
            },
            {
              OR: [
                { title: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { description: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { project: { name: { contains: q, mode: Prisma.QueryMode.insensitive } } },
              ],
            },
          ],
        },
        take: Math.min(limit, 25),
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          description: true,
          projectId: true,
          project: { select: { name: true } },
        },
      });
      results.push(
        ...tasks.map((t) => ({
          type: "task",
          id: t.id,
          title: t.title,
          subtitle: t.project?.name ? `Progetto: ${t.project.name}` : "",
          href: `/project/${t.projectId}`, // MVP: apre progetto; il drawer task si aggancia in fase UI cmdk
          projectId: t.projectId,
        }))
      );
    }

    if (types.includes("files")) {
      const files = await prisma.fileUpload.findMany({
        where: {
          AND: [
            { project: canSeeProject },
            { fileName: { contains: q, mode: Prisma.QueryMode.insensitive } },
          ],
        },
        take: Math.min(limit, 25),
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          fileName: true,
          projectId: true,
          project: { select: { name: true } },
        },
      });
      results.push(
        ...files.map((f) => ({
          type: "file",
          id: f.id,
          title: f.fileName,
          subtitle: f.project?.name ? `Progetto: ${f.project.name}` : "",
          href: `/files`,
          projectId: f.projectId,
        }))
      );
    }

    if (types.includes("wiki")) {
      const pages = await prisma.wikiPage.findMany({
        where: {
          AND: [
            { isArchived: false },
            { project: canSeeProject },
            {
              OR: [
                { title: { contains: q, mode: Prisma.QueryMode.insensitive } },
                { content: { contains: q, mode: Prisma.QueryMode.insensitive } },
              ],
            },
          ],
        },
        take: Math.min(limit, 25),
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          projectId: true,
          project: { select: { name: true } },
        },
      });
      results.push(
        ...pages.map((p) => ({
          type: "wiki",
          id: p.id,
          title: p.title,
          subtitle: p.project?.name ? `Wiki · ${p.project.name}` : "Wiki",
          href: `/project/${p.projectId}/wiki/${p.id}`,
          projectId: p.projectId,
        }))
      );
    }

    // Simple cap + stable ordering: keep groups in same response, but cap total
    return NextResponse.json({ results: results.slice(0, limit) });
  } catch (error) {
    console.error("Global search error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


