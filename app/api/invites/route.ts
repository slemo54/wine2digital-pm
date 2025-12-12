import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';

// POST - Create project invite link
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await req.json();
    const { projectId, role, expiresIn, maxUses } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
    }

    // Check if user is project member
    const isMember = await prisma.projectMember.findFirst({
      where: {
        projectId,
        userId,
      },
    });

    if (!isMember) {
      return NextResponse.json({ error: 'Not a project member' }, { status: 403 });
    }

    // Generate unique token
    const token = randomBytes(32).toString('hex');

    // Calculate expiration
    let expiresAt = null;
    if (expiresIn) {
      expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiresIn);
    }

    const invite = await prisma.projectInvite.create({
      data: {
        projectId,
        token,
        role: role || 'member',
        expiresAt,
        maxUses,
        createdBy: userId,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ invite });
  } catch (error) {
    console.error('Create invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET - Get invite details and join project
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    const invite = await prisma.projectInvite.findUnique({
      where: { token },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
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

    return NextResponse.json({ invite });
  } catch (error) {
    console.error('Get invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
