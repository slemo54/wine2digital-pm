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
  try {
    const me = await getMe(req);
    if (!me) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const access = await getProjectAccess({ projectId: params.id, userId: me.id });
    if (!access) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    const isProjectMember = Boolean(access.projectRole);
    const canRead = me.role === 'admin' || access.creatorId === me.id || isProjectMember;
    if (!canRead) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

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

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ project });
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

    const body = await req.json();
    const { name, description, startDate, endDate, status } = body;

    const project = await prisma.project.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(status && { status }),
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
