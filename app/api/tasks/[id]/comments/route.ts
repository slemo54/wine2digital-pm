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
    const comments = await prisma.taskComment.findMany({
      where: { taskId: params.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            firstName: true,
            lastName: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error("Error fetching comments:", error);
    return NextResponse.json(
      { error: "Failed to fetch comments" },
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
    const { content } = await request.json();
    const userId = (session.user as any).id;

    const comment = await prisma.taskComment.create({
      data: {
        taskId: params.id,
        userId,
        content,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            firstName: true,
            lastName: true,
            image: true,
          },
        },
      },
    });

    return NextResponse.json(comment);
  } catch (error) {
    console.error("Error creating comment:", error);
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    );
  }
}
