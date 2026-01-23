import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST - Join project via invite
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await req.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    const invite = await prisma.projectInvite.findUnique({
      where: { token },
    });

    if (!invite) {
      return NextResponse.json({ error: 'Invalid invite' }, { status: 404 });
    }

    // Check if expired
    if (invite.expiresAt && new Date() > invite.expiresAt) {
      return NextResponse.json({ error: 'Invite expired' }, { status: 410 });
    }

    // Check if max uses reached
    if (invite.maxUses && invite.usedCount >= invite.maxUses) {
      return NextResponse.json({ error: 'Invite limit reached' }, { status: 410 });
    }

    // Check if already member
    const existingMember = await prisma.projectMember.findFirst({
      where: {
        projectId: invite.projectId,
        userId,
      },
    });

    if (existingMember) {
      return NextResponse.json({ error: 'Already a member' }, { status: 400 });
    }

    // Add user to project
    await prisma.projectMember.create({
      data: {
        projectId: invite.projectId,
        userId,
        role: invite.role,
      },
    });

    // Increment used count
    await prisma.projectInvite.update({
      where: { id: invite.id },
      data: {
        usedCount: { increment: 1 },
      },
    });

    return NextResponse.json({ 
      message: 'Successfully joined project',
      projectId: invite.projectId,
    });
  } catch (error) {
    console.error('Join project error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
