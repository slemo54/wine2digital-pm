import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { buildAbsenceVisibilityWhere } from '@/lib/absence-permissions';
import { findAbsenceRequestRecipientsWithEmails } from '@/lib/absence-notification-recipients';
import { getAbsenceTypeLabel } from '@/lib/absence-labels';
import { buildAbsenceRequestEmail } from '@/lib/email/notifications';
import { sendEmail } from '@/lib/email/resend';

export const dynamic = 'force-dynamic';

type AbsenceStatus = 'pending' | 'approved' | 'rejected';

function parseOptionalInt(input: string | null): number | null {
  if (input === null) return null;
  const n = Number(input);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function parseOptionalDate(input: string | null): Date | null {
  if (!input) return null;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

// GET - List all absences (user's own + all if admin/manager)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role || 'member';
    const userDepartment = (session.user as any).department || null;
    const calendarEnabled = (session.user as any).calendarEnabled !== false;

    if (userRole !== 'admin' && !calendarEnabled) {
      return NextResponse.json({ error: 'Calendar access is disabled for your account' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const statusParam = (searchParams.get('status') || '').trim();
    const includeCounts = (searchParams.get('includeCounts') || '').trim() === 'true';
    const takeRaw = parseOptionalInt(searchParams.get('take'));
    const skipRaw = parseOptionalInt(searchParams.get('skip'));

    const from = parseOptionalDate(searchParams.get('from'));
    const to = parseOptionalDate(searchParams.get('to'));
    if ((searchParams.get('from') && !from) || (searchParams.get('to') && !to)) {
      return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
    }

    const take = takeRaw === null ? undefined : Math.max(0, Math.min(2000, takeRaw));
    const skip = skipRaw === null ? undefined : Math.max(0, skipRaw);

    const baseWhere = buildAbsenceVisibilityWhere({
      role: userRole,
      userId: userId,
      department: userDepartment,
    });

    const statusFilter: Partial<{ status: AbsenceStatus }> =
      statusParam === 'pending' || statusParam === 'approved' || statusParam === 'rejected'
        ? { status: statusParam as AbsenceStatus }
        : {};

    const dateFilter =
      from || to
        ? {
          // overlap filter: [startDate,endDate] intersects [from,to]
          ...(to ? { startDate: { lte: to } } : {}),
          ...(from ? { endDate: { gte: from } } : {}),
        }
        : {};

    const where = {
      ...baseWhere,
      ...statusFilter,
      ...dateFilter,
    } as const;

    const [absences, counts] = await Promise.all([
      prisma.absence.findMany({
        where: where as any,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              department: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        ...(typeof skip === 'number' ? { skip } : {}),
        ...(typeof take === 'number' ? { take } : {}),
      }),
      includeCounts
        ? prisma.absence.groupBy({
          by: ['status'],
          where: baseWhere as any,
          _count: { _all: true },
        })
        : Promise.resolve([] as Array<{ status: string; _count: { _all: number } }>),
    ]);

    const countsByStatus = (() => {
      if (!includeCounts) return undefined;
      const map = new Map<string, number>();
      for (const row of counts) map.set(String(row.status), Number(row._count?._all || 0));
      const pending = map.get('pending') || 0;
      const approved = map.get('approved') || 0;
      const rejected = map.get('rejected') || 0;
      return { pending, approved, rejected, total: pending + approved + rejected };
    })();

    return NextResponse.json({ absences, ...(countsByStatus ? { counts: countsByStatus } : {}) });
  } catch (error) {
    console.error('List absences error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new absence request
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await req.json();
    const { type, startDate, endDate, startTime, endTime, isFullDay, reason } = body;

    if (!type || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate year is complete (prevent 2-digit years like "26" -> year 0026)
    const startYear = new Date(startDate).getFullYear();
    const endYear = new Date(endDate).getFullYear();
    if (startYear < 2000 || endYear < 2000) {
      return NextResponse.json({ error: "Anno non valido. Inserisci l'anno completo (es. 2026)." }, { status: 400 });
    }
    if (new Date(startDate) > new Date(endDate)) {
      return NextResponse.json({ error: "La data di inizio deve essere precedente alla data di fine." }, { status: 400 });
    }

    const absence = await prisma.absence.create({
      data: {
        userId,
        type,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        startTime,
        endTime,
        isFullDay: isFullDay !== false,
        reason,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            name: true,
            department: true,
          },
        },
      },
    });

    // Send notifications to admins and department managers (best-effort)
    try {
      const recipients = await findAbsenceRequestRecipientsWithEmails({
        requesterUserId: userId,
        requesterDepartment: absence.user.department,
      });

      if (recipients.length > 0) {
        // Create in-app notifications
        try {
          const requesterName = absence.user.name || absence.user.email || "Un membro";
          const startDateLabel = new Date(absence.startDate).toLocaleDateString("it-IT");
          const endDateLabel = new Date(absence.endDate).toLocaleDateString("it-IT");

          await prisma.notification.createMany({
            data: recipients.map((recipient) => ({
              userId: recipient.id,
              type: "absence_request_pending",
              title: "Nuova richiesta di permesso",
              message: `${requesterName} ha richiesto ${getAbsenceTypeLabel(absence.type)} dal ${startDateLabel} al ${endDateLabel}`,
              link: "/admin/absences?status=pending",
            })),
          });
        } catch (notificationError) {
          console.error("Failed to create absence notifications:", notificationError);
        }

        // Send emails (best-effort, don't fail the request)
        const emailResults = await Promise.allSettled(
          recipients.map(async (recipient) => {
            const requesterName = absence.user.name || absence.user.email || "Un membro";
            const startDateLabel = new Date(absence.startDate).toLocaleDateString("it-IT");
            const endDateLabel = new Date(absence.endDate).toLocaleDateString("it-IT");

            const email = buildAbsenceRequestEmail({
              requesterName,
              absenceType: getAbsenceTypeLabel(absence.type),
              startDateLabel,
              endDateLabel,
              link: "/admin/absences?status=pending",
            });

            return sendEmail({
              to: [recipient.email],
              subject: email.subject,
              html: email.html,
              text: email.text,
            });
          })
        );

        // Log email failures (don't fail the request)
        emailResults.forEach((result, index) => {
          if (result.status === "rejected") {
            console.error(`Email failed for ${recipients[index].email}:`, result.reason);
          }
        });
      }
    } catch (recipientError) {
      // Log but don't fail the request
      console.error("Failed to send absence request notifications:", recipientError);
    }

    return NextResponse.json({ absence });
  } catch (error) {
    console.error('Create absence error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
