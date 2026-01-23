import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string, fieldId: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { fieldId } = params;

        await prisma.customField.delete({
            where: { id: fieldId },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete custom field error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
