import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { resolveDriveUploadFolderId, uploadFileToDrive } from "@/lib/google-drive";
import { getTaskAccessFlags } from "@/lib/task-access";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string; subtaskId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const userId = (session.user as any).id as string | undefined;
    const role = ((session.user as any).role as string | undefined) || "member";
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const access = await getTaskAccessFlags(prisma, params.id, userId);
    if (!access) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const canRead = role === "admin" || access.isAssignee || access.isProjectMember;
    if (!canRead) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });

    const attachments = await prisma.subtaskAttachment.findMany({
      where: { subtaskId: params.subtaskId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(attachments);
  } catch (error) {
    console.error("Error fetching subtask attachments:", error);
    return NextResponse.json({ error: "Failed to fetch subtask attachments" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; subtaskId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const userId = (session.user as any).id as string | undefined;
    const role = ((session.user as any).role as string | undefined) || "member";
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) {
      return NextResponse.json({ error: "Missing GOOGLE_DRIVE_FOLDER_ID" }, { status: 501 });
    }

    const access = await getTaskAccessFlags(prisma, params.id, userId);
    if (!access) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const canWrite =
      role === "admin" ||
      (role === "manager" && access.isProjectMember) ||
      (role === "member" && access.isAssignee);
    if (!canWrite) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });

    const task = await prisma.task.findUnique({
      where: { id: params.id },
      select: { projectId: true, project: { select: { name: true } } },
    });
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const fileName = file.name;
    const fileSize = file.size;
    const mimeType = file.type;

    let uploadFolderId = folderId;
    try {
      uploadFolderId = await resolveDriveUploadFolderId({
        baseFolderId: folderId,
        projectId: task.projectId,
        projectName: task.project?.name,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    let uploaded: { id: string; webViewLink?: string; webContentLink?: string };
    try {
      uploaded = await uploadFileToDrive({
        folderId: uploadFolderId,
        fileName,
        mimeType: mimeType || "application/octet-stream",
        bytes,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.toLowerCase().includes("service account") || msg.toLowerCase().includes("drive")) {
        return NextResponse.json({ error: msg }, { status: 502 });
      }
      throw e;
    }
    const filePath = uploaded.webViewLink || uploaded.webContentLink || `gdrive:${uploaded.id}`;

    const attachment = await prisma.subtaskAttachment.create({
      data: {
        subtaskId: params.subtaskId,
        fileName,
        fileSize,
        mimeType: mimeType || "application/octet-stream",
        filePath,
        uploadedBy: userId,
      },
    });

    await prisma.taskActivity.create({
      data: {
        taskId: params.id,
        actorId: userId,
        type: "subtask.attachment_uploaded",
        metadata: {
          subtaskId: params.subtaskId,
          attachmentId: attachment.id,
          fileName,
          filePath,
          driveFileId: uploaded.id,
        },
      },
    });

    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    console.error("Error uploading subtask attachment:", error);
    return NextResponse.json({ error: "Failed to upload subtask attachment" }, { status: 500 });
  }
}


