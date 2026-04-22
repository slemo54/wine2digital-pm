import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session-user";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const me = await getSessionUser();
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (me.globalRole !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const q = String(searchParams.get("q") || "").trim();
    const role = String(searchParams.get("role") || "").trim();
    const active = searchParams.get("active");

    const users = await prisma.user.findMany({
      where: {
        AND: [
          q
            ? {
                OR: [
                  { email: { contains: q, mode: "insensitive" } },
                  { name: { contains: q, mode: "insensitive" } },
                  { firstName: { contains: q, mode: "insensitive" } },
                  { lastName: { contains: q, mode: "insensitive" } },
                ],
              }
            : {},
          role ? { role } : {},
          active === "true" ? { isActive: true } : {},
          active === "false" ? { isActive: false } : {},
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        department: true,
        role: true,
        isActive: true,
        calendarEnabled: true,
        disabledAt: true,
        createdAt: true,
        updatedAt: true,
        sessions: {
          orderBy: {
            expires: 'desc'
          },
          take: 1,
          select: {
            expires: true
          }
        },
      },
    });

    type UserWithSessions = {
      id: string;
      email: string;
      name: string | null;
      firstName: string | null;
      lastName: string | null;
      department: string | null;
      role: string;
      isActive: boolean;
      calendarEnabled: boolean;
      disabledAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      sessions?: { expires: Date }[];
    };
    const usersWithLastLogin = users.map((user: UserWithSessions) => {
      const lastSession = user.sessions && user.sessions.length > 0 ? user.sessions[0] : null;
      let lastSignInAt: string | null = null;

      if (lastSession && lastSession.expires) {
        const loginDate = new Date(lastSession.expires);
        loginDate.setDate(loginDate.getDate() - 30);
        lastSignInAt = loginDate.toISOString();
      }

      // eslint-disable-next-line
      const { sessions, ...userWithoutSessions } = user;
      return {
        ...userWithoutSessions,
        lastSignInAt
      };
    });

    return NextResponse.json({ users: usersWithLastLogin });
  } catch (error) {
    console.error("Admin list users error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}




