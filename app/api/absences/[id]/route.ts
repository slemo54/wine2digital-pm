import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email/resend';
import { buildAbsenceDecisionEmail } from '@/lib/email/notifications';
import { canDecideAbsence } from '@/lib/absence-permissions';

export const dynamic = 'force-dynamic';

// PUT - Update absence (approve/reject for managers, edit for owners)
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const actorRole = (session.user as any).role || 'member';
    const actorDepartment = (session.user as any).department || null;
    const calendarEnabled = (session.user as any).calendarEnabled !== false;

    if (actorRole !== 'admin' && !calendarEnabled) {
      return NextResponse.json({ error: 'Calendar access is disabled for your account' }, { status: 403 });
    }

    const body = await req.json();
    const { status } = body;

    // Only managers/admins can approve/reject/edit
    if (actorRole !== 'admin' && actorRole !== 'manager') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Fetch existing absence to check current status and target user department
    const existingAbsence = await prisma.absence.findUnique({
      where: { id: params.id },
      include: { user: { select: { department: true } } },
    });

    if (!existingAbsence) {
      return NextResponse.json({ error: 'Absence not found' }, { status: 404 });
    }

    // Check permission to update status (decision logic)
    const isChangingStatus = status && status !== existingAbsence.status;
    if (isChangingStatus) {
      const allowed = canDecideAbsence({
        actorRole,
        actorDepartment,
        targetDepartment: existingAbsence.user?.department,
      });

      if (!allowed) {
        return NextResponse.json({ error: 'You can only approve/reject absences within your department' }, { status: 403 });
      }
    }

    // Construct update data
    const updateData: any = {};

    // Allow status update logic (existing)
    if (status && (status === 'approved' || status === 'rejected')) {
       updateData.status = status;
       updateData.approvedBy = userId;
       updateData.approvedAt = new Date();
    } else if (status === 'pending') {
       // Allow resetting to pending if needed
       updateData.status = status;
       updateData.approvedBy = null;
       updateData.approvedAt = null;
    }

    // Allow editing other fields
    if (body.startDate) updateData.startDate = new Date(body.startDate);
    if (body.endDate) updateData.endDate = new Date(body.endDate);
    if (body.type) updateData.type = body.type;
    if (body.reason !== undefined) updateData.reason = body.reason;

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const absence = await prisma.absence.update({
      where: { id: params.id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            name: true,
          },
        },
      },
    });

    // Create notification only if status changed
    if (status && status !== existingAbsence.status && (status === 'approved' || status === 'rejected')) {
      await prisma.notification.create({
        data: {
          userId: absence.userId,
          type: 'absence_' + status,
          title: `Absence request ${status}`,
          message: `Your absence request from ${new Date(absence.startDate).toLocaleDateString()} to ${new Date(absence.endDate).toLocaleDateString()} has been ${status}`,
          link: '/calendar',
        },
      });

      // Best-effort email notification (do not fail the request on email errors)
      const to = String(absence.user?.email || '').trim();
      if (to) {
        const email = buildAbsenceDecisionEmail({
          status,
          startDateLabel: new Date(absence.startDate).toLocaleDateString(),
          endDateLabel: new Date(absence.endDate).toLocaleDateString(),
          link: '/calendar',
        });
        const r = await sendEmail({ to, subject: email.subject, html: email.html, text: email.text });
        if (!r.ok) console.error('Absence email failed:', r.error);
      }
    }

    return NextResponse.json({ absence });
  } catch (error) {
    console.error('Update absence error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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
    const userRole = (session.user as any).role || 'member';
    const calendarEnabled = (session.user as any).calendarEnabled !== false;

    if (userRole !== 'admin' && !calendarEnabled) {
      return NextResponse.json({ error: 'Calendar access is disabled for your account' }, { status: 403 });
    }

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
  }
}
