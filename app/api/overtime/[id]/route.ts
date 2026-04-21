import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = params;
    const json = await request.json();
    const { status, adminNote } = json;

    const updatedRequest = await prisma.overtimeRequest.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(adminNote !== undefined && { adminNote }),
      },
    });

    return NextResponse.json(updatedRequest);
  } catch (error) {
    console.error('Error updating overtime request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const { id } = params;

    // Check if the request belongs to the user or if they are admin
    const existingRequest = await prisma.overtimeRequest.findUnique({
      where: { id },
    });

    if (!existingRequest) {
      return NextResponse.json({ error: 'Richiesta non trovata' }, { status: 404 });
    }

    if (existingRequest.userId !== (session.user as any).id && (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Non autorizzato a eliminare questa richiesta' }, { status: 403 });
    }

    await prisma.overtimeRequest.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting overtime request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
