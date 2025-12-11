import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

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
        ...(startDate || endDate
          ? {
              createdAt: {
                ...(startDate ? { gte: new Date(startDate) } : {}),
                ...(endDate ? { lte: new Date(endDate) } : {}),
              },
            }
          : {}),
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
          include: {
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
  } finally {
    await prisma.$disconnect();
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
  } finally {
    await prisma.$disconnect();
  }
}

// Bulk operations: archive (soft) or delete (hard)
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any)?.id;
    const body = await req.json();
    const { ids, action } = body as { ids?: string[]; action?: 'archive' | 'delete' };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No project ids provided' }, { status: 400 });
    }

    // Verify ownership or membership
    const ownedOrMember = await prisma.project.findMany({
      where: {
        id: { in: ids },
        OR: [{ creatorId: userId }, { members: { some: { userId } } }],
      },
      select: { id: true },
    });
    const allowedIds = ownedOrMember.map((p) => p.id);
    if (allowedIds.length === 0) {
      return NextResponse.json({ error: 'Not authorized for selected projects' }, { status: 403 });
    }

    if (action === 'delete') {
      await prisma.project.deleteMany({
        where: { id: { in: allowedIds } },
      });
      return NextResponse.json({ success: true, deleted: allowedIds.length });
    }

    // Default: archive (soft)
    await prisma.project.updateMany({
      where: { id: { in: allowedIds } },
      data: { status: 'archived' },
    });

    return NextResponse.json({ success: true, archived: allowedIds.length });
  } catch (error) {
    console.error('Bulk project patch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
