import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { buildAbsenceVisibilityWhere } from '@/lib/absence-permissions';

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
          },
        },
      },
    });

    return NextResponse.json({ absence });
  } catch (error) {
    console.error('Create absence error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
