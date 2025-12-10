import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { title, description, projectId, priority, dueDate, assigneeIds, status } = body;

    if (!title || !projectId) {
      return NextResponse.json(
        { error: 'Title and project ID are required' },
        { status: 400 }
      );
    }

    const task = await prisma.task.create({
      data: {
        title,
        description: description || '',
        projectId,
        priority: priority || 'medium',
        status: status || 'todo',
        dueDate: dueDate ? new Date(dueDate) : null,
        assignees: assigneeIds && Array.isArray(assigneeIds) && assigneeIds.length > 0
          ? {
              create: assigneeIds.map((userId: string) => ({
                userId,
              })),
            }
          : undefined,
      },
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
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error('Create task error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
