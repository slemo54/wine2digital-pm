import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

// PUT - Update absence (approve/reject for managers, edit for owners)
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    const body = await req.json();
    const { status } = body;

    // Only managers/admins can approve/reject
    if (status && (status === 'approved' || status === 'rejected')) {
      if (user?.role !== 'admin' && user?.role !== 'manager') {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }

      const absence = await prisma.absence.update({
        where: { id: params.id },
        data: {
          status,
          approvedBy: userId,
          approvedAt: new Date(),
        },
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
      });

      // Create notification for user
      await prisma.notification.create({
        data: {
          userId: absence.userId,
          type: 'absence_' + status,
          title: `Absence request ${status}`,
          message: `Your absence request from ${new Date(absence.startDate).toLocaleDateString()} to ${new Date(absence.endDate).toLocaleDateString()} has been ${status}`,
          link: '/calendar',
        },
      });

      return NextResponse.json({ absence });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('Update absence error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE - Delete absence request
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    const absence = await prisma.absence.findUnique({
      where: { id: params.id },
    });

    // Only owner or admin can delete
    if (absence?.userId !== userId && user?.role !== 'admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    await prisma.absence.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: 'Absence deleted successfully' });
  } catch (error) {
    console.error('Delete absence error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
