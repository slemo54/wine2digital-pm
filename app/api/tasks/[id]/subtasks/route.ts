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
    const subtasks = await prisma.subtask.findMany({
      where: { taskId: params.id },
      orderBy: { position: "asc" },
    });

    return NextResponse.json(subtasks);
  } catch (error) {
    console.error("Error fetching subtasks:", error);
    return NextResponse.json(
      { error: "Failed to fetch subtasks" },
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
    const { title, description } = await request.json();

    // Get max position
    const maxPosition = await prisma.subtask.aggregate({
      where: { taskId: params.id },
      _max: { position: true },
    });

    const subtask = await prisma.subtask.create({
      data: {
        taskId: params.id,
        title,
        description,
        position: (maxPosition._max.position || 0) + 1,
      },
    });

    return NextResponse.json(subtask);
  } catch (error) {
    console.error("Error creating subtask:", error);
    return NextResponse.json(
      { error: "Failed to create subtask" },
      { status: 500 }
    );
  }
}
