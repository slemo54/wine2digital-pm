import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const requests = await prisma.overtimeRequest.findMany({
      where: {
        userId: (session.user as any).id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(requests);
  } catch (error) {
    console.error('Error fetching overtime requests:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const json = await request.json();
    const { title, startDate, endDate, message } = json;

    if (!title || !startDate || !endDate || !message) {
      return NextResponse.json({ error: 'Titolo, date e messaggio sono obbligatori' }, { status: 400 });
    }

    const newRequest = await prisma.overtimeRequest.create({
      data: {
        userId: (session.user as any).id,
        title: title,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        message: message,
      },
    });

    return NextResponse.json(newRequest, { status: 201 });
  } catch (error) {
    console.error('Error creating overtime request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
