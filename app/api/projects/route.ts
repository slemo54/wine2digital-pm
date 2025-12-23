import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { buildProjectDateOverlapWhere, parseDateRangeInput } from '@/lib/projects-date-filter';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any)?.id;
    const { searchParams } = new URL(req.url);

    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const limit = Math.max(parseInt(searchParams.get('limit') || '10', 10), 1);
    const search = searchParams.get('search')?.trim() || '';
    const status = searchParams.get('status')?.trim() || '';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const orderBy = (searchParams.get('orderBy') || 'createdAt') as 'name' | 'status' | 'createdAt' | 'completionRate';
    const order = (searchParams.get('order') || 'desc') as 'asc' | 'desc';

    const parsedDates = parseDateRangeInput({ startDate, endDate });
    if (!parsedDates.ok) {
      return NextResponse.json({ error: parsedDates.error }, { status: 400 });
    }

    // Fetch projects for the user with DB-side filters where possible
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { creatorId: userId },
          { members: { some: { userId } } },
        ],
        ...(status
          ? {
              status: status === 'running' ? 'active' : status, // normalize running -> active
            }
          : {}),
        ...buildProjectDateOverlapWhere({ start: parsedDates.start, end: parsedDates.end }),
      },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            name: true,
          },
        },
        members: {
          select: {
            userId: true,
            role: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                name: true,
              },
            },
          },
        },
        tasks: {
          select: {
            id: true,
            status: true,
          },
        },
        _count: {
          select: {
            tasks: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // In-memory search on name/description
    const filtered = projects.filter((project) => {
      if (!search) return true;
      const haystack = `${project.name} ${project.description || ''}`.toLowerCase();
      return haystack.includes(search.toLowerCase());
    });

    // Add derived fields and normalize status
    const withComputed = filtered.map((project) => {
      const totalTasks = project.tasks.length;
      const completedTasks = project.tasks.filter((task) => task.status === 'done').length;
      const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      const normalizedStatus = project.status === 'active' ? 'running' : project.status;

      return {
        ...project,
        status: normalizedStatus,
        completionRate,
        tasksCompleted: completedTasks,
        tasksTotal: totalTasks,
      };
    });

    // Sort in-memory (supports completionRate)
    const sorted = [...withComputed].sort((a, b) => {
      const dir = order === 'asc' ? 1 : -1;
      switch (orderBy) {
        case 'name':
          return a.name.localeCompare(b.name) * dir;
        case 'status':
          return a.status.localeCompare(b.status) * dir;
        case 'completionRate':
          return (a.completionRate - b.completionRate) * dir;
        case 'createdAt':
        default:
          return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
      }
    });

    const total = sorted.length;
    const totalPages = Math.max(Math.ceil(total / limit), 1);
    const start = (page - 1) * limit;
    const paged = sorted.slice(start, start + limit);

    return NextResponse.json({
      projects: paged,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('Get projects error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any)?.id;
    const body = await req.json();
    const { name, description, startDate, endDate } = body;

    if (!name) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    const project = await prisma.project.create({
      data: {
        name,
        description: description || '',
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        creatorId: userId,
        members: {
          create: {
            userId,
            role: 'owner',
          },
        },
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
                email: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error('Create project error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Bulk operations: archive (soft) or delete (hard)
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any)?.id as string | undefined;
    const globalRole = String((session.user as any)?.role || "");
    const body = await req.json();
    const { ids, action } = body as { ids?: string[]; action?: 'archive' | 'delete' };

    const normalizedIds = Array.from(
      new Set((Array.isArray(ids) ? ids : []).map((x) => String(x || "")).filter(Boolean))
    );
    if (normalizedIds.length === 0) {
      return NextResponse.json({ error: 'No project ids provided' }, { status: 400 });
    }
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const normalizedAction: 'archive' | 'delete' = action === 'delete' ? 'delete' : 'archive';
    const requested = normalizedIds.length;

    if (globalRole === "admin") {
      if (normalizedAction === 'delete') {
        await prisma.project.deleteMany({ where: { id: { in: normalizedIds } } });
        return NextResponse.json({
          success: true,
          action: 'delete',
          requested,
          processed: requested,
          unauthorized: 0,
          unauthorizedIds: [],
          deleted: requested,
        });
      }
      await prisma.project.updateMany({ where: { id: { in: normalizedIds } }, data: { status: 'archived' } });
      return NextResponse.json({
        success: true,
        action: 'archive',
        requested,
        processed: requested,
        unauthorized: 0,
        unauthorizedIds: [],
        archived: requested,
      });
    }

    // Permissions:
    // - archive: project owner/manager (or creator)
    // - delete: project owner (or creator)
    if (normalizedAction === 'delete') {
      const deletable = await prisma.project.findMany({
        where: {
          id: { in: normalizedIds },
          OR: [{ creatorId: userId }, { members: { some: { userId, role: "owner" } } }],
        },
        select: { id: true },
      });
      const deletableIds = deletable.map((p) => p.id);
      const allowed = new Set(deletableIds);
      const unauthorizedIds = normalizedIds.filter((id) => !allowed.has(id));
      if (deletableIds.length === 0) {
        return NextResponse.json(
          {
            error: 'Not authorized for selected projects',
            action: 'delete',
            requested,
            processed: 0,
            unauthorized: unauthorizedIds.length,
            unauthorizedIds,
            deleted: 0,
          },
          { status: 403 }
        );
      }
      await prisma.project.deleteMany({
        where: { id: { in: deletableIds } },
      });
      return NextResponse.json({
        success: true,
        action: 'delete',
        requested,
        processed: deletableIds.length,
        unauthorized: unauthorizedIds.length,
        unauthorizedIds,
        deleted: deletableIds.length,
      });
    }

    // Default: archive (soft)
    const archivable = await prisma.project.findMany({
      where: {
        id: { in: normalizedIds },
        OR: [
          { creatorId: userId },
          { members: { some: { userId, role: { in: ["owner", "manager"] } } } },
        ],
      },
      select: { id: true },
    });
    const archivableIds = archivable.map((p) => p.id);
    const allowed = new Set(archivableIds);
    const unauthorizedIds = normalizedIds.filter((id) => !allowed.has(id));
    if (archivableIds.length === 0) {
      return NextResponse.json(
        {
          error: 'Not authorized for selected projects',
          action: 'archive',
          requested,
          processed: 0,
          unauthorized: unauthorizedIds.length,
          unauthorizedIds,
          archived: 0,
        },
        { status: 403 }
      );
    }
    await prisma.project.updateMany({
      where: { id: { in: archivableIds } },
      data: { status: 'archived' },
    });

    return NextResponse.json({
      success: true,
      action: 'archive',
      requested,
      processed: archivableIds.length,
      unauthorized: unauthorizedIds.length,
      unauthorizedIds,
      archived: archivableIds.length,
    });
  } catch (error) {
    console.error('Bulk project patch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
