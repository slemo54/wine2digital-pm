import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tasks/[id]/custom-fields
 * Get all custom field values for a task
 */
export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const taskId = params.id;

        const values = await prisma.customFieldValue.findMany({
            where: { taskId },
        });

        return NextResponse.json({ values });
    } catch (error) {
        console.error('List custom field values error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * POST /api/tasks/[id]/custom-fields
 * Update or Create a custom field value for a task
 */
export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const taskId = params.id;
        const { fieldId, value } = await req.json();

        if (!fieldId) {
            return NextResponse.json({ error: 'fieldId is required' }, { status: 400 });
        }

        const result = await prisma.customFieldValue.upsert({
            where: {
                customFieldId_taskId: {
                    customFieldId: fieldId,
                    taskId: taskId,
                },
            },
            update: {
                value: value,
            },
            create: {
                customFieldId: fieldId,
                taskId: taskId,
                value: value,
            },
        });

        return NextResponse.json({ success: true, value: result });
    } catch (error) {
        console.error('Update custom field value error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
