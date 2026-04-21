import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const requests = await prisma.overtimeRequest.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(requests);
  } catch (error) {
    console.error('Error fetching all overtime requests:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
