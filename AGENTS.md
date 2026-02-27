# Wine2Digital PM - AI Agent Guide

> This document provides essential information for AI coding agents working on the Wine2Digital PM project.
> 
> **Project Language**: Italian (documentation), English (code)
> **Last Updated**: 2026-02-27

---

## Project Overview

Wine2Digital PM is a **Next.js 14 project management application** designed for team collaboration. It provides Kanban boards, task tracking, absence management (calendar), team chat, file sharing, wiki documentation, and Clockify-style time reporting.

### Key Features
- **Project Management**: Projects with tasks, subtasks, tags, custom fields
- **Kanban Board**: Drag-and-drop task management with status columns (todo, in_progress, done)
- **Absence/Calendar**: Vacation requests, sick leave, team calendar
- **Team Chat**: Project-specific messaging
- **File Management**: Upload and organize project files
- **Wiki**: Project documentation with revision history
- **Time Tracking**: Clockify-style daily reporting
- **Notifications**: In-app and email notifications via Resend

---

## Technology Stack

| Category | Technology |
|----------|------------|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript 5.2 |
| **Runtime** | Node.js 22.x |
| **Database** | PostgreSQL (Supabase-compatible) |
| **ORM** | Prisma 6.7 |
| **Auth** | NextAuth 4.24 (Google OAuth + Credentials) |
| **Styling** | TailwindCSS 3.3 + shadcn/ui |
| **State Management** | Zustand, Jotai, TanStack Query |
| **Testing** | Node.js Test Runner (tsx --test) |
| **Deployment** | Vercel |

---

## Project Structure

```
├── app/                    # Next.js App Router
│   ├── api/               # API Routes (REST endpoints)
│   ├── admin/             # Admin panel pages
│   ├── auth/              # Login/signup pages
│   ├── project/[id]/      # Project detail pages
│   ├── tasks/             # Global task view
│   ├── calendar/          # Absence calendar
│   ├── clockify/          # Time reporting
│   └── *.tsx              # Root pages
├── components/
│   ├── ui/                # shadcn/ui components (reusable)
│   ├── kanban/            # Kanban board components
│   ├── task-detail/       # Task detail components
│   ├── calendar/          # Calendar components
│   ├── custom-fields/     # Custom field management
│   └── *.tsx              # App-specific components
├── lib/                   # Utilities, helpers, business logic
│   ├── auth-options.ts    # NextAuth configuration
│   ├── prisma.ts          # Prisma client singleton
│   ├── project-permissions.ts  # Permission checks
│   ├── task-access.ts     # Task access control
│   ├── email/             # Email notification logic
│   └── *.test.ts          # Unit tests
├── hooks/                 # Custom React hooks
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── migrations/        # Database migrations
├── scripts/
│   └── seed.ts            # Database seeding
└── public/                # Static assets
```

---

## Build & Development Commands

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Push schema changes to database
npx prisma db push

# Run database migrations
npx prisma migrate deploy

# Seed database with demo data
npx prisma db push && node --require dotenv/config scripts/seed.ts

# Start development server
npm run dev

# Build for production
npm run build

# Run linter
npm run lint

# Run tests
npm run test

# Prisma Studio (database GUI)
npx prisma studio
```

---

## Environment Variables

Create `.env` file in project root:

```bash
# Database
DATABASE_URL="postgresql://..."

# NextAuth
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"  # or production URL

# Google OAuth
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_WORKSPACE_DOMAIN="mammajumboshrimp.com"

# Role assignment (comma-separated emails)
GOOGLE_ADMIN_EMAILS="admin@example.com,admin2@example.com"
GOOGLE_MANAGER_EMAILS="manager@example.com,manager2@example.com"

# Email notifications (optional)
EMAIL_NOTIFICATIONS_ENABLED="true"
RESEND_API_KEY="..."
RESEND_FROM="pm@justdothework.it"
```

---

## Code Style Guidelines

### TypeScript
- Strict mode enabled (`strict: true`)
- Use explicit return types for public functions
- Prefer `type` over `interface` for simple shapes
- Use `@/` path alias for imports from project root

### Naming Conventions
- **Components**: PascalCase (e.g., `KanbanBoard.tsx`)
- **Files**: kebab-case for pages, camelCase for utilities
- **Database models**: PascalCase (Prisma convention)
- **API routes**: lowercase with hyphens (Next.js convention)

### Component Patterns
- Use `"use client"` directive for client components
- Server Components are default (no directive needed)
- Prefer composition over inheritance
- Use shadcn/ui components as base for UI elements

### Styling
- TailwindCSS for all styling
- Use `cn()` utility from `lib/utils.ts` for conditional classes
- Dark mode supported via `class` strategy
- CSS variables for theming (see `app/globals.css`)

---

## Testing Strategy

### Test Framework
- **Runner**: Node.js built-in test runner (`tsx --test`)
- **Location**: Co-located with source files (`*.test.ts`)
- **Pattern**: `app/api/**/*.test.ts` for API tests

### Test Examples
```typescript
// lib/example.test.ts
import { test } from 'node:test';
import assert from 'node:assert';
import { myFunction } from './example';

test('myFunction should work', () => {
  assert.strictEqual(myFunction('input'), 'expected');
});
```

### Running Tests
```bash
# Run all tests
npm run test

# Run specific test file
npx tsx --test app/api/tasks/route.test.ts
```

---

## Database Schema (Key Models)

### User & Authentication
- `User` - Core user model with role (member/manager/admin)
- `Account` - NextAuth OAuth accounts
- `Session` - NextAuth sessions

### Project Management
- `Project` - Projects with status (active/completed/archived)
- `ProjectMember` - Junction table (user + project + role)
- `ProjectTag` - Tags for categorizing tasks
- `TaskList` - Lists within projects
- `CustomField` - Project-specific custom fields

### Tasks
- `Task` - Main task entity (status: todo/in_progress/done)
- `TaskAssignee` - Junction for task assignments
- `TaskComment` - Comments on tasks
- `TaskAttachment` - File attachments
- `TaskDependency` - Task dependencies
- `TaskActivity` - Activity log for tasks

### Subtasks
- `Subtask` - Tasks within tasks
- `SubtaskChecklist` - Checklists within subtasks
- `SubtaskComment` - Comments on subtasks
- `SubtaskAttachment` - File attachments on subtasks
- `SubtaskDependency` - Subtask dependencies

### Other
- `Absence` - Vacation/sick leave requests
- `Message` - Project chat messages
- `FileUpload` - Project file uploads
- `WikiPage` / `WikiPageRevision` - Documentation
- `Notification` - User notifications
- `ClockifyEntry` / `ClockifyProject` - Time tracking
- `AuditLog` - Admin audit trail

---

## Role-Based Permissions

### Global Roles (User.role)
- **member**: Basic access, can create projects
- **manager**: + Can approve absences in their department
- **admin**: + Full admin panel access, can manage all users

### Project Roles (ProjectMember.role)
- **member**: Can view and work on assigned tasks
- **manager**: + Can manage tasks, assign people
- **owner**: + Can delete project, manage members

### Permission Check Locations
- `lib/project-permissions.ts` - Project-level permissions
- `lib/task-access.ts` - Task access control
- `lib/absence-permissions.ts` - Absence management
- `lib/wiki-permissions.ts` - Wiki access
- `lib/clockify-scope.ts` - Time report visibility

---

## API Routes Organization

### Structure Pattern
```
app/api/[resource]/
├── route.ts          # GET (list), POST (create)
├── [id]/
│   └── route.ts      # GET (detail), PATCH, DELETE
└── *.test.ts         # Tests
```

### Key API Areas
- `/api/auth/[...nextauth]` - Authentication
- `/api/projects/*` - Project CRUD
- `/api/tasks/*` - Task management
- `/api/subtasks/*` - Subtask operations
- `/api/absences/*` - Absence requests
- `/api/admin/*` - Admin operations
- `/api/clockify/*` - Time tracking
- `/api/files/*` - File uploads
- `/api/messages/*` - Project chat

---

## Security Considerations

### Authentication
- JWT-based sessions with NextAuth
- Google OAuth restricted to workspace domain
- Credentials provider with bcrypt password hashing
- Session role sync on every request (prevents stale permissions)

### Authorization
- All API routes check user session
- Permission checks in route handlers
- Project membership required for most operations
- Admin bypass available for cross-project access

### Data Protection
- Prisma handles SQL injection prevention
- File uploads validated (mime type, size)
- User can only access own notifications
- Absence visibility restricted by department/role

---

## Deployment (Vercel)

### Build Settings
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

### Post-Deploy
After deployment, ensure database migrations are applied:
```bash
npx prisma migrate deploy
# or for development
npx prisma db push
```

### Environment Variables on Vercel
Set all required env vars in Vercel dashboard:
- Production environment
- Preview environment (for PR previews)

---

## Common Development Tasks

### Adding a New API Route
1. Create folder structure in `app/api/`
2. Implement `route.ts` with GET/POST/PATCH/DELETE handlers
3. Add permission checks using session
4. Create `*.test.ts` for tests
5. Use Prisma client from `lib/prisma.ts`

### Adding a New Component
1. Check shadcn/ui registry first: `npx shadcn add [component]`
2. For custom components, add to `components/`
3. Use `cn()` utility for conditional classes
4. Follow existing component patterns

### Database Changes
1. Update `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name [description]`
3. Or `npx prisma db push` for prototyping
4. Regenerate client: `npx prisma generate`
5. Update seed script if needed

### Adding Permissions
1. Add check function to appropriate `lib/*-permissions.ts` file
2. Use in API route handlers
3. Update `PERMESSI_RUOLI.md` documentation

---

## Documentation Files

- `README.md` - Project overview and setup
- `PERMESSI_RUOLI.md` - Detailed role permissions (Italian)
- `GUIDA_UTILIZZO.md` - User guide index (Italian)
- `GUIDA_UTILIZZO_ADMIN.md` - Admin user guide (Italian)
- `GUIDA_UTILIZZO_COLLEGHI_*.md` - End-user guides (Italian)
- `PERFORMANCE_OPTIMIZATION_GUIDE.md` - Performance tuning
- `ACTION_PLAN.md` - Development action items
- `CODE_REVIEW.md` - Code review checklist

---

## Troubleshooting

### Common Issues

**Prisma Client not found**
```bash
npx prisma generate
```

**Database connection errors**
- Check `DATABASE_URL` format
- Ensure IP allowlist on Supabase includes your IP

**Build fails on Vercel**
- Check all env vars are set
- Ensure `postinstall` script runs `prisma generate`

**Auth issues**
- Verify `NEXTAUTH_SECRET` and `NEXTAUTH_URL`
- Check Google OAuth credentials
- Ensure `GOOGLE_WORKSPACE_DOMAIN` matches user's email domain

---

## External Integrations

- **Google OAuth**: Authentication + Calendar readonly access
- **Resend**: Email notifications
- **Supabase**: PostgreSQL hosting (optional, any Postgres works)
- **Vercel**: Hosting and deployments
- **Google Tag Manager**: Analytics (GTM-NLK65L2B)
- **Microsoft Clarity**: User analytics
- **Elfsight**: AI Chatbot widget

---

## Notes for AI Agents

1. **Language**: Code in English, documentation can be Italian
2. **Imports**: Always use `@/` path aliases
3. **Types**: Prefer strict typing, avoid `any`
4. **Tests**: Add tests for new API routes
5. **Permissions**: Always check permissions in API routes
6. **Database**: Use Prisma transactions for multi-table operations
7. **Components**: Reuse shadcn/ui components when possible
8. **Styling**: Use Tailwind classes, avoid inline styles
9. **Error Handling**: Return proper HTTP status codes from APIs
10. **Logging**: Use `console.log` with `[PREFIX]` for auth/debug logs
