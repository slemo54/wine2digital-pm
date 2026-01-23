import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getTaskAccessFlags } from "@/lib/task-access";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/resend";
import { buildMentionEmail } from "@/lib/email/notifications";
import {
  buildMentionNotifications,
  filterMentionedUserIdsToAllowed,
  isEffectivelyEmptyRichContent,
  normalizeMentionedUserIds,
  sanitizeRichHtml,
} from "@/lib/rich-text";

type CreateBody = {
  content?: string;
  mentionedUserIds?: unknown;
};

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

    const comments = await prisma.subtaskComment.findMany({
      where: { subtaskId: params.subtaskId },
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
    console.error("Error fetching subtask comments:", error);
    return NextResponse.json({ error: "Failed to fetch subtask comments" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
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

    const isProjectManager = access.projectRole === "owner" || access.projectRole === "manager";
    const canWrite =
      role === "admin" ||
      isProjectManager ||
      (role === "manager" && access.isProjectMember) ||
      (role === "member" && access.isProjectMember);
    if (!canWrite) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });

    const body = (await request.json().catch(() => ({}))) as CreateBody;
    const raw = typeof body?.content === "string" ? body.content.trim() : "";
    const sanitized = sanitizeRichHtml(raw);
    if (!sanitized || isEffectivelyEmptyRichContent(sanitized)) {
      return NextResponse.json({ error: "content required" }, { status: 400 });
    }

    const mentionedUserIds = normalizeMentionedUserIds((body as any)?.mentionedUserIds, userId);

    const comment = await prisma.subtaskComment.create({
      data: {
        subtaskId: params.subtaskId,
        userId,
        content: sanitized,
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

    await prisma.taskActivity.create({
      data: {
        taskId: params.id,
        actorId: userId,
        type: "subtask.comment_added",
        metadata: { subtaskId: params.subtaskId, commentId: comment.id },
      },
    });

    if (mentionedUserIds.length > 0) {
      const task = await prisma.task.findUnique({
        where: { id: params.id },
        select: { title: true, projectId: true },
      });
      if (!task?.projectId) {
        return NextResponse.json(comment, { status: 201 });
      }

      const [subtask, allowedMembers] = await Promise.all([
        prisma.subtask.findUnique({ where: { id: params.subtaskId }, select: { title: true } }),
        prisma.projectMember.findMany({
          where: { projectId: task.projectId, userId: { in: mentionedUserIds } },
          select: { userId: true },
        }),
      ]);

      const authorLabel = String(comment.user?.name || comment.user?.email || "Un collega");
      const subtaskTitle = String(subtask?.title || "Subtask");
      const taskTitle = String(task?.title || "Task");

      const allowedUserIds = allowedMembers.map((m) => m.userId);
      const filteredMentioned = filterMentionedUserIdsToAllowed(mentionedUserIds, allowedUserIds);
      if (filteredMentioned.length === 0) {
        return NextResponse.json(comment, { status: 201 });
      }

      await prisma.notification.createMany({
        data: buildMentionNotifications({
          mentionedUserIds: filteredMentioned,
          authorLabel,
          taskId: params.id,
          subtaskId: params.subtaskId,
          taskTitle,
          subtaskTitle,
        }),
      });

      // Best-effort email notifications (do not fail the request on email errors)
      const recipients = await prisma.user.findMany({
        where: { id: { in: filteredMentioned } },
        select: { email: true },
      });

      const link = `/tasks?taskId=${encodeURIComponent(params.id)}&subtaskId=${encodeURIComponent(params.subtaskId)}`;
      const email = buildMentionEmail({ authorLabel, taskTitle, subtaskTitle, link });
      await Promise.allSettled(
        recipients
          .map((u) => String(u.email || "").trim())
          .filter(Boolean)
          .map(async (to) => {
            const r = await sendEmail({ to, subject: email.subject, html: email.html, text: email.text });
            if (!r.ok) console.error("Mention email failed:", r.error);
          })
      );
    }

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error("Error creating subtask comment:", error);
    return NextResponse.json({ error: "Failed to create subtask comment" }, { status: 500 });
  }
}


