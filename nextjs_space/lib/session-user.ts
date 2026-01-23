import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export type SessionUser = {
  id: string;
  email: string;
  globalRole: string;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const user = session.user as any;
  const id = String(user.id || "");
  if (!id) return null;
  return {
    id,
    email: String(user.email || ""),
    globalRole: String(user.role || ""),
  };
}


