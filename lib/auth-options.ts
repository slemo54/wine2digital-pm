import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

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
    async jwt({ token, user, account }) {
      // First-time login: store user info in token
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      }
      
      // OAuth login: ensure role is set for new users
      if (account?.provider === 'google' && user) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
        });
        if (dbUser) {
          token.role = dbUser.role;
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
        // Check workspace domain restriction
        const workspaceDomain = process.env.GOOGLE_WORKSPACE_DOMAIN;
        if (workspaceDomain) {
          const emailDomain = user.email.split('@')[1];
          if (emailDomain !== workspaceDomain) {
            console.error(`[SSO DENIED] Email domain ${emailDomain} does not match workspace domain ${workspaceDomain}`);
            // Return false to reject sign-in - NextAuth will show error page
            return false;
          }
        }

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
