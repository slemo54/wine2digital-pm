import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { deleteDriveFile } from "@/lib/google-drive";
import { getTaskAccessFlags } from "@/lib/task-access";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; attachmentId: string } }
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

    // Verify task access
    const access = await getTaskAccessFlags(prisma, params.id, userId);
    if (!access) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Check permissions - same as upload
    const isProjectManager = access.projectRole === "owner" || access.projectRole === "manager";
    const canWrite =
      role === "admin" ||
      isProjectManager ||
      (role === "manager" && access.isProjectMember) ||
      (role === "member" && access.isProjectMember);

    if (!canWrite) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // Get attachment
    const attachment = await prisma.taskAttachment.findUnique({
      where: { id: params.attachmentId },
    });

    if (!attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    if (attachment.taskId !== params.id) {
      return NextResponse.json({ error: "Attachment does not belong to this task" }, { status: 400 });
    }

    // Extract Google Drive file ID from filePath (format: gdrive:<id>)
    const driveFileId = attachment.filePath?.startsWith("gdrive:")
      ? attachment.filePath.substring(7)
      : null;

    // Delete from Google Drive if we have a Drive file ID
    if (driveFileId) {
      try {
        await deleteDriveFile({ fileId: driveFileId });
      } catch (error) {
        console.error("Error deleting from Google Drive:", error);
        // Continue with database deletion even if Drive deletion fails
        // This prevents orphaned database records
      }
    }

    // Delete from database
    await prisma.taskAttachment.delete({
      where: { id: params.attachmentId },
    });

    // Log activity
    await prisma.taskActivity.create({
      data: {
        taskId: params.id,
        actorId: userId,
        type: "task.attachment_deleted",
        metadata: {
          attachmentId: params.attachmentId,
          fileName: attachment.fileName,
          driveFileId
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting attachment:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete attachment" },
      { status: 500 }
    );
  }
}
