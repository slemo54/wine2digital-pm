import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

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
    async jwt({ token, user, account, profile }) {
      // First-time login: store user info in token
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      }

      // OAuth login: handle new user setup
      if (account?.provider === 'google' && user) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
          });

          if (dbUser) {
            token.role = dbUser.role;

            // If this is a new Google user, update name fields
            // Check if firstName is empty (indicates new user created by adapter)
            if (!dbUser.firstName && user.name) {
              // Extract firstName and lastName from name
              const nameParts = user.name.split(' ');
              const firstName = nameParts[0] || '';
              const lastName = nameParts.slice(1).join(' ') || '';

              console.info('[AUTH] Updating new Google user profile:', {
                userId: user.id,
                email: user.email,
                name: user.name,
              });

              await prisma.user.update({
                where: { id: dbUser.id },
                data: {
                  name: user.name,
                  firstName,
                  lastName,
                },
              });
            }
          } else {
            console.error('[AUTH] User not found in database during jwt callback:', user.id);
          }
        } catch (error) {
          console.error('[AUTH] Error in jwt callback:', error);
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session?.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      // For OAuth providers, ensure user has required fields
      if (account?.provider === 'google' && user.email) {
        // Validate email format
        if (!user.email.includes('@')) {
          console.error('[SSO DENIED] Invalid email format:', user.email);
          return false;
        }

        // Check workspace domain restriction
        const workspaceDomain = process.env.GOOGLE_WORKSPACE_DOMAIN?.trim();
        const normalizedDomain = workspaceDomain?.toLowerCase();
        const emailDomain = user.email.split('@')[1].toLowerCase();

        console.info('[AUTH] Google sign-in attempt', {
          email: user.email,
          emailDomain,
          workspaceDomain: normalizedDomain,
          provider: account?.provider,
          profileData: profile, // Debug: log entire profile
        });

        if (workspaceDomain) {
          if (emailDomain !== normalizedDomain) {
            console.error(`[SSO DENIED] Email domain ${emailDomain} does not match workspace domain ${normalizedDomain}`);
            // Return false to reject sign-in - NextAuth will show error page
            return false;
          }
        }

        // Additional security: verify email is verified by Google (if available)
        // This prevents account takeover when allowDangerousEmailAccountLinking is true
        const emailVerified = (profile as any)?.email_verified;
        if (emailVerified === false) {
          // Only block if explicitly false (not undefined/null)
          console.error('[SSO DENIED] Google email not verified:', user.email);
          return false;
        }

        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
        });

        // Determine role based on email lists (trim whitespace)
        const adminEmails = (process.env.GOOGLE_ADMIN_EMAILS || '').split(',').map(e => e.trim());
        const managerEmails = (process.env.GOOGLE_MANAGER_EMAILS || '').split(',').map(e => e.trim());

        let role: 'admin' | 'manager' | 'member' = 'member';
        if (adminEmails.includes(user.email)) {
          role = 'admin';
        } else if (managerEmails.includes(user.email)) {
          role = 'manager';
        }

        // Update existing user's role if it has changed based on email lists
        if (existingUser && existingUser.role !== role) {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { role },
          });
        }

        // Store role in user object for jwt callback to pick up
        (user as any).role = role;
      }
      return true;
    },
  },
};
