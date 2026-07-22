import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isClockifyEnabled } from "@/lib/feature-flags";
import {
  CLOCKIFY_ANNOUNCEMENT_KEY,
  shouldShowClockifyAnnouncement,
} from "@/lib/clockify-announcement";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const read = await prisma.userAnnouncementRead.findUnique({
    where: {
      userId_announcementKey: {
        userId,
        announcementKey: CLOCKIFY_ANNOUNCEMENT_KEY,
      },
    },
    select: { readAt: true },
  });

  return NextResponse.json({
    show: shouldShowClockifyAnnouncement({
      enabled: isClockifyEnabled(),
      readAt: read?.readAt || null,
    }),
  });
}

export async function POST() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.userAnnouncementRead.upsert({
    where: {
      userId_announcementKey: {
        userId,
        announcementKey: CLOCKIFY_ANNOUNCEMENT_KEY,
      },
    },
    create: { userId, announcementKey: CLOCKIFY_ANNOUNCEMENT_KEY },
    update: { readAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
