import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { uploadFileToDrive } from "@/lib/google-drive";

export const dynamic = 'force-dynamic';

// GET - List files for a project
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = String((session.user as any).id || '');
    const globalRole = String((session.user as any).role || '');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = (searchParams.get('projectId') || '').trim();

    if (!projectId || projectId === 'undefined' || projectId === 'null') {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
    }

    // Permissions: only project members (or global admin)
    if (globalRole !== 'admin') {
      const membership = await prisma.projectMember.findFirst({
        where: { projectId, userId },
        select: { id: true },
      });
      if (!membership) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
    }

    const files = await prisma.fileUpload.findMany({
      where: { projectId },
      include: {
        uploader: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ files });
  } catch (error) {
    console.error('List files error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Upload file
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = String((session.user as any).id || '');
    const globalRole = String((session.user as any).role || '');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const projectId = String(formData.get('projectId') || '').trim();

    if (!file || !projectId || projectId === 'undefined' || projectId === 'null') {
      return NextResponse.json({ error: 'Missing file or project ID' }, { status: 400 });
    }

    // Permissions: only project members (or global admin)
    if (globalRole !== 'admin') {
      const membership = await prisma.projectMember.findFirst({
        where: { projectId, userId },
        select: { id: true },
      });
      if (!membership) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
    }

    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) {
      return NextResponse.json({ error: "Missing GOOGLE_DRIVE_FOLDER_ID" }, { status: 500 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    let uploaded: { id: string; webViewLink?: string; webContentLink?: string };
    try {
      uploaded = await uploadFileToDrive({
        folderId,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        bytes,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const storedPath =
      uploaded.webViewLink || uploaded.webContentLink || `gdrive:${uploaded.id}`;

    // Save to database
    const fileRecord = await prisma.fileUpload.create({
      data: {
        projectId,
        uploadedBy: userId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        filePath: storedPath,
      },
      include: {
        uploader: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ file: fileRecord });
  } catch (error) {
    console.error('Upload file error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
