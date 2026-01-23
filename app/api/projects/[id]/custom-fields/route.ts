import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/projects/[id]/custom-fields
 * List all custom field definitions for a project
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

        const projectId = params.id;

        const customFields = await prisma.customField.findMany({
            where: { projectId },
            orderBy: { createdAt: 'asc' },
        });

        return NextResponse.json({ customFields });
    } catch (error) {
        console.error('List custom fields error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * POST /api/projects/[id]/custom-fields
 * Create a new custom field definition
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

        const projectId = params.id;
        const { name, type, description, options } = await req.json();

        if (!name || !type) {
            return NextResponse.json({ error: 'Name and type are required' }, { status: 400 });
        }

        const customField = await prisma.customField.create({
            data: {
                projectId,
                name,
                type,
                description,
                options: options || undefined,
            },
        });

        return NextResponse.json({ customField }, { status: 201 });
    } catch (error) {
        console.error('Create custom field error:', error);
        if ((error as any).code === 'P2002') {
            return NextResponse.json({ error: 'A field with this name already exists in this project' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
