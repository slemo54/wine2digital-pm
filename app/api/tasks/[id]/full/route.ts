import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

/**
 * API Endpoint unificato per ottenere tutti i dati di un task in una singola chiamata
 * Questo riduce le chiamate da 5 a 1, migliorando significativamente le performance
 *
 * Risposta include:
 * - Task details
 * - Subtasks con assignee e counts
 * - Comments (ultimi 50)
 * - Attachments (ultimi 20)
 * - Activity log (ultimi 30)
 * - Custom fields
 * - Counts
 */
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

    const taskId = params.id;

    // SINGLE QUERY con tutte le relazioni necessarie
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            members: {
              select: {
                userId: true,
                role: true,
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
            },
          },
        },
        taskList: {
          select: { id: true, name: true },
        },
        tags: {
          select: { id: true, name: true, color: true },
        },
        assignees: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
                image: true,
                email: true,
              },
            },
          },
        },
        subtasks: {
          orderBy: { position: 'asc' },
          include: {
            assignee: {
              select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
                image: true,
                email: true,
              },
            },
            dependencies: {
              include: {
                dependsOn: {
                  select: {
                    id: true,
                    title: true,
                    status: true,
                  },
                },
              },
            },
            _count: {
              select: {
                comments: true,
                attachments: true,
              },
            },
          },
        },
        comments: {
          orderBy: { createdAt: 'desc' },
          take: 50, // Paginazione - primi 50 commenti
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
        attachments: {
          orderBy: { createdAt: 'desc' },
          take: 20, // Paginazione - primi 20 attachments
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 30, // Paginazione - primi 30 activity logs
          include: {
            actor: {
              select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
                email: true,
                image: true,
              },
            },
          },
        },
        customFieldValues: {
          include: {
            customField: true,
          },
        },
        _count: {
          select: {
            comments: true,
            attachments: true,
            subtasks: true,
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Permission check
    const isAssignee = task.assignees.some((a) => a.userId === userId);
    const isProjectMember = task.project?.members?.some((m) => m.userId === userId) || false;
    const canRead = role === "admin" || isAssignee || isProjectMember;

    if (!canRead) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    return NextResponse.json({
      task,
      // Metadata aggiuntivi utili per il client
      meta: {
        totalComments: task._count.comments,
        totalAttachments: task._count.attachments,
        totalSubtasks: task._count.subtasks,
        hasMoreComments: task._count.comments > 50,
        hasMoreAttachments: task._count.attachments > 20,
      },
    });
  } catch (error) {
    console.error("Error fetching full task details:", error);
    return NextResponse.json(
      { error: "Failed to fetch task details" },
      { status: 500 }
    );
  }
}
