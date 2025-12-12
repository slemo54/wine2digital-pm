import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { uploadFileToDrive } from "@/lib/google-drive";
import { getTaskAccessFlags } from "@/lib/task-access";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = (session.user as any).id as string | undefined;
    const role = ((session.user as any).role as string | undefined) || "member";
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await getTaskAccessFlags(prisma, params.id, userId);
    if (!access) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const canRead = role === "admin" || access.isAssignee || access.isProjectMember;
    if (!canRead) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const attachments = await prisma.taskAttachment.findMany({
      where: { taskId: params.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(attachments);
  } catch (error) {
    console.error("Error fetching attachments:", error);
    return NextResponse.json(
      { error: "Failed to fetch attachments" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const userId = (session.user as any).id;
    const role = ((session.user as any).role as string | undefined) || "member";
    const fileName = file.name;
    const fileSize = file.size;
    const mimeType = file.type;
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) {
      return NextResponse.json(
        { error: "Missing GOOGLE_DRIVE_FOLDER_ID" },
        { status: 501 }
      );
    }

    const access = await getTaskAccessFlags(prisma, params.id, userId);
    if (!access) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    const canWrite =
      role === "admin" ||
      (role === "manager" && access.isProjectMember) ||
      (role === "member" && access.isAssignee);
    if (!canWrite) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const uploaded = await uploadFileToDrive({
      folderId,
      fileName,
      mimeType: mimeType || "application/octet-stream",
      bytes,
    });

    const filePath = uploaded.webViewLink || uploaded.webContentLink || `gdrive:${uploaded.id}`;

    const attachment = await prisma.taskAttachment.create({
      data: {
        taskId: params.id,
        fileName,
        fileSize,
        mimeType,
        filePath,
        uploadedBy: userId,
      },
    });

    await prisma.taskActivity.create({
      data: {
        taskId: params.id,
        actorId: userId,
        type: "task.attachment_uploaded",
        metadata: { attachmentId: attachment.id, fileName, filePath, driveFileId: uploaded.id },
      },
    });

    return NextResponse.json(attachment);
  } catch (error) {
    console.error("Error creating attachment:", error);
    return NextResponse.json(
      { error: "Failed to create attachment" },
      { status: 500 }
    );
  }
}
