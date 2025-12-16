import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

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

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'uploads', projectId);
    await mkdir(uploadsDir, { recursive: true });

    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileName = `${Date.now()}-${file.name}`;
    const filePath = path.join(uploadsDir, fileName);
    await writeFile(filePath, buffer);

    // Save to database
    const fileRecord = await prisma.fileUpload.create({
      data: {
        projectId,
        uploadedBy: userId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        filePath: `/uploads/${projectId}/${fileName}`,
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
