import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { JWT } from 'next-auth/jwt';

type GlobalRole = 'admin' | 'manager' | 'member';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
          scope: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/calendar.readonly',
          ].join(' '),
          // Force Google to show only accounts from this workspace domain
          hd: process.env.GOOGLE_WORKSPACE_DOMAIN || 'mammajumboshrimp.com',
        },
      },
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password required');
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          throw new Error('Invalid email or password');
        }

        if (user.isActive === false) {
          throw new Error('Account disabled');
        }

        if (!user.password) {
          throw new Error('Please sign in with Google');
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);

        if (!isValid) {
          throw new Error('Invalid email or password');
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          role: user.role,
          department: user.department,
          calendarEnabled: user.calendarEnabled,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/auth/login',
    signOut: '/auth/login',
    error: '/auth/login', // Redirect to login page on error
  },
  events: {
    async createUser({ user }) {
      // Logic to update role/name after creation
      const adminEmails = (process.env.GOOGLE_ADMIN_EMAILS || '').split(',').map(e => e.trim());
      const managerEmails = (process.env.GOOGLE_MANAGER_EMAILS || '').split(',').map(e => e.trim());
      
      let role: 'admin' | 'manager' | 'member' = 'member';
      if (user.email && adminEmails.includes(user.email)) role = 'admin';
      else if (user.email && managerEmails.includes(user.email)) role = 'manager';

      // Parse name into first/last
      const nameParts = user.name?.split(' ') || [];
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      await prisma.user.update({
        where: { id: user.id },
        data: { role, firstName, lastName },
      });
      console.log(`[AUTH] User created and updated: ${user.email} with role ${role}`);
    },
    async linkAccount({ user, account }) {
      console.log(`[AUTH] Account linked: ${user.email} provider=${account.provider} id=${account.providerAccountId}`);
    }
  },
  callbacks: {
    async jwt({ token, user, account }) {
      const gToken = token as GoogleToken;

      // First-time login: store user info in token
      if (user) {
        gToken.id = user.id;
        gToken.role = ((user as any).role || 'member').toLowerCase();
        gToken.department = (user as any).department || null;
        gToken.calendarEnabled = (user as any).calendarEnabled ?? true;
      }

      // OAuth login: ensure role and tokens are set for new users
      if (account?.provider === 'google' && user) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
        });
        if (dbUser) {
          gToken.role = (dbUser.role || 'member').toLowerCase();
        }

        // Persist Google tokens for API access
        gToken.accessToken = account.access_token;
        gToken.refreshToken = account.refresh_token ?? gToken.refreshToken;
        gToken.accessTokenExpires = account.expires_at
          ? account.expires_at * 1000
          : Date.now() + 60 * 60 * 1000;
          
        console.log(`[AUTH] JWT updated for ${user.email} (role=${gToken.role})`);
      }

      // Keep role/isActive synced with DB (avoid stale sessions after admin changes)
      // Time-gated: only sync every 5 minutes to reduce DB load
      const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
      const now = Date.now();
      const shouldSync = gToken.id && (!gToken.lastDbSync || now - gToken.lastDbSync > SYNC_INTERVAL_MS);
      
      if (shouldSync) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: gToken.id },
            select: { role: true, isActive: true, department: true, calendarEnabled: true },
          });
          if (dbUser) {
            gToken.role = (dbUser.role || 'member').toLowerCase();
            gToken.isActive = dbUser.isActive;
            gToken.department = dbUser.department || null;
            gToken.calendarEnabled = dbUser.calendarEnabled;
          }
          gToken.lastDbSync = now;
        } catch {
          // Best-effort: keep previous token values
        }
      }

      // If token expired, refresh using refresh_token
      if (gToken.accessToken && gToken.accessTokenExpires && Date.now() > gToken.accessTokenExpires) {
        const refreshed = await refreshGoogleAccessToken(gToken);
        return refreshed;
      }

      return gToken;
    },
    async session({ session, token }) {
      if (session?.user) {
        const gToken = token as GoogleToken;
        (session.user as any).id = gToken.id;
        (session.user as any).role = gToken.role;
        (session.user as any).department = gToken.department;
        (session.user as any).calendarEnabled = gToken.calendarEnabled;
        (session.user as any).accessToken = gToken.accessToken;
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      // For OAuth providers, ensure user has required fields
      if (account?.provider === 'google' && user.email) {
        console.log(`[AUTH] SignIn attempt: ${user.email} (sub=${(profile as any)?.sub})`);
        
        // Check workspace domain restriction
        const workspaceDomain = process.env.GOOGLE_WORKSPACE_DOMAIN?.trim();
        const normalizedDomain = workspaceDomain?.toLowerCase();
        const emailDomain = user.email.split('@')[1]?.toLowerCase();

        if (workspaceDomain) {
          if (emailDomain !== normalizedDomain) {
            console.error(`[AUTH] Domain mismatch: ${emailDomain} != ${normalizedDomain}`);
            return false;
          }
        }
        
        // Existing user role update logic for RETURNING users
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
        });

        if (existingUser) {
           const adminEmails = (process.env.GOOGLE_ADMIN_EMAILS || '').split(',').map(e => e.trim());
           const managerEmails = (process.env.GOOGLE_MANAGER_EMAILS || '').split(',').map(e => e.trim());

           if (existingUser.isActive === false) {
             console.warn(`[AUTH] Disabled user attempted sign-in: ${user.email}`);
             return false;
           }

           // Env lists can promote (never demote) returning users.
           // Admin panel remains the source of truth for manual role changes.
           const desired: GlobalRole | null = adminEmails.includes(user.email)
             ? "admin"
             : managerEmails.includes(user.email)
               ? "manager"
               : null;

           const shouldPromoteToAdmin = desired === "admin" && existingUser.role !== "admin";
           const shouldPromoteToManager = desired === "manager" && existingUser.role === "member";
           if (shouldPromoteToAdmin || shouldPromoteToManager) {
             const nextRole: GlobalRole = shouldPromoteToAdmin ? "admin" : "manager";
             await prisma.user.update({
               where: { id: existingUser.id },
               data: { role: nextRole },
             });
             console.log(`[AUTH] User role promoted on signin: ${user.email} -> ${nextRole}`);
           }
        }
      }
      return true;
    },
  },
};

type GoogleToken = JWT & {
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpires?: number;
  id?: string;
  role?: string;
  department?: string | null;
  calendarEnabled?: boolean;
  isActive?: boolean;
  lastDbSync?: number; // Timestamp of last DB sync for role/isActive
};

export async function refreshGoogleAccessToken(token: GoogleToken): Promise<GoogleToken> {
  if (!token.refreshToken) {
    return token;
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
      }),
    });

    const refreshedTokens = await response.json();

    if (!response.ok) {
      throw refreshedTokens;
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + (refreshedTokens.expires_in || 3600) * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken, // fall back to old refresh token
    };
  } catch (error) {
    // In case of error keep the old token; caller can handle unauthenticated state
    return {
      ...token,
      error: 'RefreshAccessTokenError',
    };
  }
}
