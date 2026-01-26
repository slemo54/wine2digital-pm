import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

async function getMe(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const user = session.user as any;
  const id = String(user.id || '');
  const role = String(user.role || '');
  if (!id) return null;
  return { id, role };
}

async function getProjectAccess(input: { projectId: string; userId: string }) {
  const res = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: {
      id: true,
      creatorId: true,
      members: { where: { userId: input.userId }, select: { role: true } },
    },
  });
  if (!res) return null;
  const projectRole = String(res.members?.[0]?.role || '');
  return { projectId: res.id, creatorId: res.creatorId, projectRole };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const perf = new URL(req.url).searchParams.get("perf") === "1";
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();

  try {
    const me = await getMe(req);
    const tAuth = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (!me) {
      const headers = perf ? { "Server-Timing": `auth;dur=${(tAuth - t0).toFixed(1)}` } : undefined;
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
    }

    const tAccess0 = typeof performance !== "undefined" ? performance.now() : Date.now();
    const access = await getProjectAccess({ projectId: params.id, userId: me.id });
    const tAccess1 = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (!access) {
      const headers = perf
        ? { "Server-Timing": `auth;dur=${(tAuth - t0).toFixed(1)},access;dur=${(tAccess1 - tAccess0).toFixed(1)}` }
        : undefined;
      return NextResponse.json({ error: 'Project not found' }, { status: 404, headers });
    }
    const isProjectMember = Boolean(access.projectRole);
    const canRead = me.role === 'admin' || access.creatorId === me.id || isProjectMember;
    if (!canRead) {
      const headers = perf
        ? { "Server-Timing": `auth;dur=${(tAuth - t0).toFixed(1)},access;dur=${(tAccess1 - tAccess0).toFixed(1)}` }
        : undefined;
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403, headers });
    }

    const tDb0 = typeof performance !== "undefined" ? performance.now() : Date.now();
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                name: true,
                email: true,
                role: true,
                image: true,
              },
            },
          },
        },
        tasks: {
          where: { status: { not: "archived" } },
          include: {
            assignees: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
          orderBy: {
            position: 'asc',
          },
        },
      },
    });
    const tDb1 = typeof performance !== "undefined" ? performance.now() : Date.now();

    if (!project) {
      const headers = perf
        ? { "Server-Timing": `auth;dur=${(tAuth - t0).toFixed(1)},access;dur=${(tAccess1 - tAccess0).toFixed(1)},db;dur=${(tDb1 - tDb0).toFixed(1)}` }
        : undefined;
      return NextResponse.json({ error: 'Project not found' }, { status: 404, headers });
    }

    const tEnd = typeof performance !== "undefined" ? performance.now() : Date.now();
    const headers = perf
      ? {
          "Server-Timing": `auth;dur=${(tAuth - t0).toFixed(1)},access;dur=${(tAccess1 - tAccess0).toFixed(1)},db;dur=${(tDb1 - tDb0).toFixed(1)},total;dur=${(tEnd - t0).toFixed(1)}`,
        }
      : undefined;

    return NextResponse.json({ project }, { headers });
  } catch (error) {
    console.error('Get project error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await getMe(req);
    if (!me) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const access = await getProjectAccess({ projectId: params.id, userId: me.id });
    if (!access) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    const isProjectOwner = access.projectRole === 'owner';
    const isProjectManager = access.projectRole === 'manager';
    const canWrite = me.role === 'admin' || access.creatorId === me.id || isProjectOwner || isProjectManager;
    if (!canWrite) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const name = typeof (body as any)?.name === "string" ? String((body as any).name) : undefined;
    const description =
      (body as any)?.description !== undefined ? String((body as any).description ?? "") : undefined;
    const startDateRaw = (body as any)?.startDate;
    const endDateRaw = (body as any)?.endDate;
    const statusRaw = (body as any)?.status;

    const normalizedStatus =
      typeof statusRaw === "string" && statusRaw.trim()
        ? (statusRaw.trim() === "running" ? "active" : statusRaw.trim())
        : undefined;

    const startDateStr = typeof startDateRaw === "string" ? startDateRaw.trim() : null;
    const endDateStr = typeof endDateRaw === "string" ? endDateRaw.trim() : null;
    const startDate =
      startDateRaw === undefined ? undefined : startDateStr ? new Date(startDateStr) : null;
    const endDate = endDateRaw === undefined ? undefined : endDateStr ? new Date(endDateStr) : null;
    if (startDate instanceof Date && Number.isNaN(startDate.getTime())) {
      return NextResponse.json({ error: "Invalid startDate" }, { status: 400 });
    }
    if (endDate instanceof Date && Number.isNaN(endDate.getTime())) {
      return NextResponse.json({ error: "Invalid endDate" }, { status: 400 });
    }

    const project = await prisma.project.update({
      where: { id: params.id },
      data: {
        ...(typeof name === "string" && name.trim() ? { name: name.trim() } : {}),
        ...(description !== undefined && { description }),
        ...(startDate !== undefined && { startDate }),
        ...(endDate !== undefined && { endDate }),
        ...(normalizedStatus !== undefined && { status: normalizedStatus }),
      },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ project });
  } catch (error) {
    console.error('Update project error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await getMe(req);
    if (!me) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const access = await getProjectAccess({ projectId: params.id, userId: me.id });
    if (!access) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    const isProjectOwner = access.projectRole === 'owner';
    const canDelete = me.role === 'admin' || access.creatorId === me.id || isProjectOwner;
    if (!canDelete) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    await prisma.project.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
