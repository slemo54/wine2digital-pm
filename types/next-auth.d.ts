import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      department?: string | null;
      calendarEnabled?: boolean;
      accessToken?: string;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: string;
    department?: string | null;
    calendarEnabled?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    department?: string | null;
    calendarEnabled?: boolean;
    accessToken?: string;
    accessTokenExpires?: number;
    refreshToken?: string;
    isActive?: boolean;
    lastDbSync?: number;
  }
}
