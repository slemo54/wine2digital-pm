import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { JWT } from 'next-auth/jwt';
import crypto from 'crypto';

function hashPII(value: string | null | undefined): string | null {
  if (!value) return null;
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 12);
}

// #region agent log
fetch('http://127.0.0.1:7242/ingest/6090270f-7a3a-4674-9bb8-f9c09b7fe98f', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: 'debug-session',
    runId: 'pre-fix-redirect',
    hypothesisId: 'H1-H3',
    location: 'lib/auth-options.ts:init',
    message: 'Auth options init',
    data: {
      nextauthUrl: process.env.NEXTAUTH_URL || null,
      workspaceDomain: process.env.GOOGLE_WORKSPACE_DOMAIN || null,
      nodeEnv: process.env.NODE_ENV || null,
    },
    timestamp: Date.now(),
  }),
}).catch(() => {});
// #endregion

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
  callbacks: {
    async jwt({ token, user, account }) {
      const gToken = token as GoogleToken;

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/6090270f-7a3a-4674-9bb8-f9c09b7fe98f', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'debug-session',
          runId: 'pre-fix-login-mismatch',
          hypothesisId: 'H1',
          location: 'lib/auth-options.ts:jwt:entry',
          message: 'JWT callback entry',
          data: {
            tokenSub: (token as any)?.sub ?? null,
            tokenId: (token as any)?.id ?? null,
            userId: user ? (user as any).id : null,
            accountProvider: account?.provider ?? null,
            providerAccountIdHash: account?.providerAccountId
              ? hashPII(account.providerAccountId)
              : null,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion

      // First-time login: store user info in token
      if (user) {
        gToken.id = user.id;
        gToken.role = (user as any).role;
      }

      // OAuth login: ensure role and tokens are set for new users
      if (account?.provider === 'google' && user) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
        });
        if (dbUser) {
          gToken.role = dbUser.role;
        }

        // Persist Google tokens for API access
        gToken.accessToken = account.access_token;
        gToken.refreshToken = account.refresh_token ?? gToken.refreshToken;
        gToken.accessTokenExpires = account.expires_at
          ? account.expires_at * 1000
          : Date.now() + 60 * 60 * 1000;
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
        (session.user as any).accessToken = gToken.accessToken;
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/6090270f-7a3a-4674-9bb8-f9c09b7fe98f', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'debug-session',
          runId: 'pre-fix-login-mismatch',
          hypothesisId: 'H1',
          location: 'lib/auth-options.ts:session',
          message: 'Session callback',
          data: {
            tokenSub: (token as any)?.sub ?? null,
            tokenId: (token as any)?.id ?? null,
            sessionUserId: (session?.user as any)?.id ?? null,
            sessionEmailHash: session?.user?.email ? hashPII(session.user.email) : null,
            sessionEmailDomain: session?.user?.email
              ? session.user.email.split('@')[1]?.toLowerCase() ?? null
              : null,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion

      return session;
    },
    async signIn({ user, account, profile }) {
      // For OAuth providers, ensure user has required fields
      if (account?.provider === 'google' && user.email) {
        // Check workspace domain restriction
        const workspaceDomain = process.env.GOOGLE_WORKSPACE_DOMAIN?.trim();
        const normalizedDomain = workspaceDomain?.toLowerCase();
        const emailDomain = user.email.split('@')[1]?.toLowerCase();

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/6090270f-7a3a-4674-9bb8-f9c09b7fe98f', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: 'debug-session',
            runId: 'pre-fix-login-mismatch',
            hypothesisId: 'H2',
            location: 'lib/auth-options.ts:signIn',
            message: 'Google sign-in attempt',
            data: {
              emailHash: hashPII(user.email),
              emailDomain,
              workspaceDomain: normalizedDomain || null,
              nextauthUrl: process.env.NEXTAUTH_URL || null,
              provider: account?.provider || null,
              providerAccountIdHash: account?.providerAccountId
                ? hashPII(account.providerAccountId)
                : null,
              profileSubHash: (profile as any)?.sub ? hashPII(String((profile as any).sub)) : null,
              googleClientIdSuffix: process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.slice(-6) : null,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion

        if (workspaceDomain) {
          if (emailDomain !== normalizedDomain) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/6090270f-7a3a-4674-9bb8-f9c09b7fe98f', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sessionId: 'debug-session',
                runId: 'pre-fix-login-mismatch',
                hypothesisId: 'H2',
                location: 'lib/auth-options.ts:signIn',
                message: 'Domain mismatch - denying sign-in',
                data: { emailDomain, workspaceDomain: normalizedDomain },
                timestamp: Date.now(),
              }),
            }).catch(() => {});
            // #endregion
            // Return false to reject sign-in - NextAuth will show error page
            return false;
          }
        }

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/6090270f-7a3a-4674-9bb8-f9c09b7fe98f', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: 'debug-session',
            runId: 'pre-fix-login-mismatch',
            hypothesisId: 'H2',
            location: 'lib/auth-options.ts:signIn',
            message: 'Domain check passed',
            data: { emailHash: hashPII(user.email), emailDomain, workspaceDomain: normalizedDomain },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion

        // Determine role based on email lists (trim whitespace)
        const adminEmails = (process.env.GOOGLE_ADMIN_EMAILS || '').split(',').map(e => e.trim());
        const managerEmails = (process.env.GOOGLE_MANAGER_EMAILS || '').split(',').map(e => e.trim());
        
        let role: 'admin' | 'manager' | 'member' = 'member';
        if (adminEmails.includes(user.email)) {
          role = 'admin';
        } else if (managerEmails.includes(user.email)) {
          role = 'manager';
        }
        
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
        });
        
        // If user exists via email/password, the adapter will link accounts automatically
        // thanks to allowDangerousEmailAccountLinking: true
        if (!existingUser) {
          // New OAuth user - set role and name
          // Wait for adapter to create the user first
          const userEmail = user.email; // Store in const for type safety
          setTimeout(async () => {
            const createdUser = await prisma.user.findUnique({
              where: { email: userEmail },
            });
            
            if (createdUser) {
              // Extract firstName and lastName from name
              const nameParts = user.name?.split(' ') || [];
              const firstName = nameParts[0] || '';
              const lastName = nameParts.slice(1).join(' ') || '';
              
              await prisma.user.update({
                where: { id: createdUser.id },
                data: {
                  role,
                  name: user.name,
                  firstName,
                  lastName,
                },
              });
            }
          }, 100);
        } else if (existingUser) {
          // Update existing user's role if it has changed based on email lists
          if (existingUser.role !== role) {
            await prisma.user.update({
              where: { id: existingUser.id },
              data: { role },
            });
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
