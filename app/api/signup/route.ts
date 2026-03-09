import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, firstName, lastName, inviteToken } = body;

    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    if (!inviteToken) {
      return NextResponse.json(
        { error: 'Invite token is required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      // Create user and update invite in a transaction
      const { user } = await prisma.$transaction(async (tx) => {
        // Validate invite token inside the transaction
        const invite = await tx.projectInvite.findUnique({
          where: { token: inviteToken },
        });

        if (!invite) {
          throw new Error('Invalid invite token');
        }

        if (invite.expiresAt && new Date() > invite.expiresAt) {
          throw new Error('Invite token has expired');
        }

        if (invite.maxUses && invite.usedCount >= invite.maxUses) {
          throw new Error('Invite token usage limit reached');
        }

        // Create user
        const user = await tx.user.create({
          data: {
            email,
            password: hashedPassword,
            firstName,
            lastName,
            role: 'member',
          },
        });

        // Add user to project
        await tx.projectMember.create({
          data: {
            projectId: invite.projectId,
            userId: user.id,
            role: invite.role,
          },
        });

        // Increment used count
        await tx.projectInvite.update({
          where: { id: invite.id },
          data: {
            usedCount: { increment: 1 },
          },
        });

        return { user };
      });

      return NextResponse.json(
        {
          message: 'User created successfully',
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          },
        },
        { status: 201 }
      );
    } catch (err: any) {
      if (
        err.message === 'Invalid invite token' ||
        err.message === 'Invite token has expired' ||
        err.message === 'Invite token usage limit reached'
      ) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
