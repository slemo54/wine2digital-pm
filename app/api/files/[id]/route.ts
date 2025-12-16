import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { unlink } from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

// DELETE - Delete file
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    const file = await prisma.fileUpload.findUnique({
      where: { id: params.id },
    });

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Only uploader or admin can delete
    if (file.uploadedBy !== userId && user?.role !== 'admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Delete physical file
    try {
      const relative = String(file.filePath || "").replace(/^\/+/, "");
      const filePath = path.join(process.cwd(), relative);
      await unlink(filePath);
    } catch (error) {
      console.error('Error deleting physical file:', error);
    }

    // Delete from database
    await prisma.fileUpload.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete file error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
