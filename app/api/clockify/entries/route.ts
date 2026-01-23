import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session-user";
import { getClockifyVisibility, type GlobalRole } from "@/lib/clockify-scope";
import { parseClockifyWorkDateFilter } from "./date-range";

export const dynamic = "force-dynamic";

function normalizeRole(input: unknown): GlobalRole {
  const r = String(input || "");
  if (r === "admin" || r === "manager" || r === "member") return r;
  return "member";
}

function toStringArray(input: unknown): string[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return Array.from(
      new Set(
        input
          .flatMap((x) => String(x || "").split(","))
          .map((x) => x.trim())
          .filter(Boolean)
      )
    );
  }
  return Array.from(
    new Set(
      String(input)
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
    )
  );
}

export async function GET(req: NextRequest) {
  try {
    const me = await getSessionUser();
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const meDb = await prisma.user.findUnique({
      where: { id: me.id },
      select: { id: true, role: true, department: true, isActive: true },
    });
    if (!meDb || meDb.isActive === false) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const q = String(searchParams.get("q") || "").trim();
    const projectId = String(searchParams.get("projectId") || "").trim();
    const userId = String(searchParams.get("userId") || "").trim();

    const parsed = parseClockifyWorkDateFilter({ date, from, to });
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const visibility = getClockifyVisibility({
      globalRole: normalizeRole(meDb.role),
      userId: meDb.id,
      department: meDb.department,
    });

    const scopeWhere =
      visibility.kind === "all"
        ? {}
        : visibility.kind === "department"
          ? { user: { department: visibility.department } }
          : { userId: visibility.userId };

    const workDateWhere =
      parsed.filter.kind === "day"
        ? { workDate: parsed.filter.day }
        : { workDate: { gte: parsed.filter.from, lte: parsed.filter.to } };

    const where: any = {
      ...scopeWhere,
      ...workDateWhere,
      ...(projectId ? { projectId } : {}),
      ...(userId ? { userId } : {}),
      ...(q
        ? {
            OR: [
              { description: { contains: q, mode: "insensitive" } },
              { task: { contains: q, mode: "insensitive" } },
              { project: { name: { contains: q, mode: "insensitive" } } },
              { project: { client: { contains: q, mode: "insensitive" } } },
              { user: { email: { contains: q, mode: "insensitive" } } },
              { user: { name: { contains: q, mode: "insensitive" } } },
              { user: { firstName: { contains: q, mode: "insensitive" } } },
              { user: { lastName: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const entries = await prisma.clockifyEntry.findMany({
      where,
      orderBy: [{ startAt: "desc" }],
      take: 500,
      select: {
        id: true,
        workDate: true,
        description: true,
        task: true,
        tags: true,
        billable: true,
        startAt: true,
        endAt: true,
        durationMin: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            firstName: true,
            lastName: true,
            department: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            client: true,
          },
        },
      },
    });

    return NextResponse.json({ entries });
  } catch (error) {
    console.error("Clockify list entries error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await getSessionUser();
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const meDb = await prisma.user.findUnique({
      where: { id: me.id },
      select: { id: true, isActive: true },
    });
    if (!meDb || meDb.isActive === false) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await req.json()) as {
      projectId?: unknown;
      description?: unknown;
      task?: unknown;
      tags?: unknown;
      billable?: unknown;
      startAt?: unknown;
      endAt?: unknown;
    };

    const projectId = String(body?.projectId || "").trim();
    const description = String(body?.description || "").trim();
    const taskRaw = body?.task;
    const task = typeof taskRaw === "string" ? taskRaw.trim() || null : null;
    const tags = toStringArray(body?.tags);
    const billable = Boolean(body?.billable);
    const startAt = new Date(String(body?.startAt || ""));
    const endAt = new Date(String(body?.endAt || ""));

    if (!projectId) return NextResponse.json({ error: "Project is required" }, { status: 400 });
    if (!description) return NextResponse.json({ error: "Description is required" }, { status: 400 });
    if (Number.isNaN(startAt.getTime())) return NextResponse.json({ error: "Invalid startAt" }, { status: 400 });
    if (Number.isNaN(endAt.getTime())) return NextResponse.json({ error: "Invalid endAt" }, { status: 400 });
    if (endAt.getTime() <= startAt.getTime()) {
      return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
    }

    const project = await prisma.clockifyProject.findUnique({
      where: { id: projectId },
      select: { id: true, isActive: true },
    });
    if (!project || project.isActive === false) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const durationMin = Math.max(Math.round((endAt.getTime() - startAt.getTime()) / 60000), 1);
    const workDate = new Date(startAt);
    workDate.setHours(0, 0, 0, 0);

    const entry = await prisma.clockifyEntry.create({
      data: {
        userId: meDb.id,
        projectId,
        workDate,
        description,
        task,
        tags,
        billable,
        startAt,
        endAt,
        durationMin,
      },
      select: {
        id: true,
        workDate: true,
        description: true,
        task: true,
        tags: true,
        billable: true,
        startAt: true,
        endAt: true,
        durationMin: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            firstName: true,
            lastName: true,
            department: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            client: true,
          },
        },
      },
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    console.error("Clockify create entry error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

