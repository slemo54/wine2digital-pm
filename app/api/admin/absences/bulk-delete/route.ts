import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session-user";
import {
  MAX_BULK_DELETE_MATCHES,
  validateBulkDeleteInput,
} from "@/lib/admin-absences-filters";

export const dynamic = "force-dynamic";

type BulkDeleteBody = {
  ids?: string[];
  before?: string; // ISO date-time
  createdFrom?: string; // ISO date-time
  createdTo?: string; // ISO date-time
  dryRun?: boolean;
};

export async function POST(req: NextRequest) {
  try {
    const me = await getSessionUser();
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (me.globalRole !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = (await req.json()) as BulkDeleteBody;
    const dryRun = Boolean(body?.dryRun);

    const validation = validateBulkDeleteInput(body as any);
    if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });
    const { where, ids, before, createdFrom, createdTo } = validation;

    const count = await prisma.absence.count({ where: where as any });

    if (dryRun) {
      return NextResponse.json({ count });
    }

    if (count > MAX_BULK_DELETE_MATCHES) {
      return NextResponse.json(
        { error: `Too many matches (${count}). Refine the filter (max ${MAX_BULK_DELETE_MATCHES}).` },
        { status: 400 }
      );
    }

    const result = await prisma.absence.deleteMany({ where: where as any });

    await prisma.auditLog.create({
      data: {
        actorId: me.id,
        actionType: "admin.absence_bulk_deleted",
        entityType: "Absence",
        entityId: null,
        metadata: {
          countRequested: count,
          countDeleted: result.count,
          criteria: {
            ids: ids.length ? ids.slice(0, 50) : undefined,
            idsCount: ids.length || undefined,
            before: before ? before.toISOString() : undefined,
            createdFrom: createdFrom ? createdFrom.toISOString() : undefined,
            createdTo: createdTo ? createdTo.toISOString() : undefined,
          },
        },
      },
    });

    return NextResponse.json({ deletedCount: result.count });
  } catch (error) {
    console.error("Admin bulk delete absences error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

