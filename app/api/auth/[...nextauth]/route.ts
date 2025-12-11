import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth-options';

export const dynamic = 'force-dynamic';

// #region agent log
fetch('http://127.0.0.1:7242/ingest/6090270f-7a3a-4674-9bb8-f9c09b7fe98f', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: 'debug-session',
    runId: 'pre-fix-redirect',
    hypothesisId: 'H1-H3',
    location: 'app/api/auth/[...nextauth]/route.ts',
    message: 'NextAuth route loaded',
    data: {
      nextauthUrl: process.env.NEXTAUTH_URL || null,
      workspaceDomain: process.env.GOOGLE_WORKSPACE_DOMAIN || null,
      nodeEnv: process.env.NODE_ENV || null,
    },
    timestamp: Date.now(),
  }),
}).catch(() => {});
// #endregion

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
