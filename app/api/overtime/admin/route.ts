import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const role = (session.user as any).role;

    if (role !== 'admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    let requests;

    if (role === 'admin') {
      // Admin sees all requests
      requests = await prisma.overtimeRequest.findMany({
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
        }

    return NextResponse.json(requests);
  } catch (error) {
    console.error('Error fetching all overtime requests:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
