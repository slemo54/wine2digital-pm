import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { deleteDriveFile } from "@/lib/google-drive";

export const dynamic = 'force-dynamic';

function extractDriveFileId(filePath: string | null | undefined): string | null {
  if (!filePath) return null;
  const s = String(filePath).trim();
  if (!s) return null;

  const gdrivePrefix = /^gdrive:([a-zA-Z0-9_-]+)$/;
  const m1 = s.match(gdrivePrefix);
  if (m1?.[1]) return m1[1];

  // Common Drive URL patterns:
  // https://drive.google.com/file/d/<id>/view
  const m2 = s.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m2?.[1]) return m2[1];

  // https://drive.google.com/open?id=<id>
  // https://drive.google.com/uc?id=<id>
  try {
    const url = new URL(s);
    const id = url.searchParams.get("id");
    if (id) return id;
  } catch {
    // not a URL
  }

  return null;
}

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

    // Delete from Drive if possible (best-effort)
    const driveFileId = extractDriveFileId(file.filePath);
    if (driveFileId) {
      try {
        await deleteDriveFile({ fileId: driveFileId });
      } catch (error) {
        console.error("Error deleting Drive file:", error);
      }
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
