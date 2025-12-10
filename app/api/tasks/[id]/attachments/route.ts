import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
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
    const fileName = file.name;
    const fileSize = file.size;
    const mimeType = file.type;

    // For now, store a placeholder path - you'll need to implement actual file storage
    const filePath = `/uploads/tasks/${params.id}/${Date.now()}-${fileName}`;

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

    return NextResponse.json(attachment);
  } catch (error) {
    console.error("Error creating attachment:", error);
    return NextResponse.json(
      { error: "Failed to create attachment" },
      { status: 500 }
    );
  }
}
