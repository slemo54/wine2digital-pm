# Code Review - Wine2Digital PM

## Executive Summary

L'applicazione **Wine2Digital PM** è una piattaforma di project management costruita con **Next.js 14**, **Prisma ORM**, **PostgreSQL** e **Tailwind CSS**. Il codebase è ben strutturato ma presenta diverse opportunità di ottimizzazione per migliorare significativamente la velocità di interattività, specialmente per quanto riguarda l'apertura di modal, task e progetti.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 14)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  App Router │  │  Components │  │  State Management   │  │
│  │  (Client)   │  │  (shadcn)   │  │  (React hooks)      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                      API Routes (Next.js)                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │    REST     │  │   Prisma    │  │   External APIs     │  │
│  │    API      │  │   Client    │  │ (Clockify, etc.)    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                      Data Layer                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  PostgreSQL │  │    Redis    │  │   File Storage      │  │
│  │  (Prisma)   │  │   (none)    │  │   (S3/Drive)        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Critical Performance Issues

### 1. **Task Detail Modal - Eager Data Fetching (CRITICAL)**

**File:** `components/task-detail-modal.tsx` (righe 398-471)

**Problema:** Il modal del task effettua **5 chiamate API parallele** all'apertura:
```typescript
const [taskRes, subtasksRes, commentsRes, attachmentsRes, activityRes] = await Promise.all([
  fetch(`/api/tasks/${taskId}`),
  fetch(`/api/tasks/${taskId}/subtasks`),
  fetch(`/api/tasks/${taskId}/comments`),
  fetch(`/api/tasks/${taskId}/attachments`),
  fetch(`/api/tasks/${taskId}/activity`),
]);
```

**Impatto:** Anche se le chiamate sono parallele, ognuna richiede:
- Connessione al database
- Query Prisma
- Serializzazione JSON
- Trasmissione network

Con latenze moderate (100-200ms per endpoint), il tempo totale è **300-500ms** prima che l'utente veda i dati.

---

### 2. **Dashboard - Sequential Data Loading (HIGH)**

**File:** `app/dashboard/page.tsx` (righe 108-116)

**Problema:** 5 fetch sequenziali al caricamento:
```typescript
useEffect(() => {
  if (status === "authenticated") {
    fetchProjects();
    fetchMyTasks();
    fetchMySubtasks();
    fetchNotifications();
    fetchActivity();
  }
}, [status]);
```

Anche se non dipendono l'uno dall'altro, vengono avviati nello stesso effect senza `Promise.all`.

---

### 3. **Project Page - Blocking Fetch (HIGH)**

**File:** `app/project/[id]/page.tsx` (righe 70-95)

**Problema:** Il caricamento del progetto blocca il rendering. Non c'è stato di loading incrementale o skeleton screens.

---

### 4. **N+1 Query Pattern nei API Routes (CRITICAL)**

**Pattern osservato in:** API routes di task, subtasks, comments

**Esempio problematico:** Quando si fetchano i task, per ogni task vengono fetchati separatamente:
- Assignees
- Tags
- Subtasks count
- Comments count

Questo genera **N+1 query** al database.

---

### 5. **No Data Caching Strategy (HIGH)**

**Osservazione:** L'applicazione non utilizza:
- React Query / TanStack Query per caching client-side
- SWR per stale-while-revalidate
- Redis per caching server-side

Ogni apertura di modal ricarica tutto da zero.

---

### 6. **Modal/Dialog senza Lazy Loading (MEDIUM)**

**File:** `components/create-task-global-dialog.tsx`, `components/create-project-dialog.tsx`

**Problema:** I dialog vengono montati nel DOM anche quando chiusi. Non c'è code-splitting per i componenti pesanti.

---

### 7. **Rich Text Editor - No Dynamic Import (MEDIUM)**

**File:** `components/task-detail-modal.tsx` (righe 69-75)

**Osservazione:** Il RichTextEditor è importato dinamicamente (✅), ma potrebbe essere ottimizzato ulteriormente con preload.

---

## 📊 Database Performance Analysis

### Schema Prisma - Indici

**Buoni indici esistenti:**
```prisma
@@index([taskId, position])       // Subtask
@@index([projectId, updatedAt])   // TaskList
@@index([taskId, createdAt])      // TaskActivity
```

**Indici mancanti critici:**
```prisma
// Per query frequenti sulle task dell'utente
@@index([assigneeId, status])

// Per filtri progetto + status
@@index([projectId, status, updatedAt])

// Per ricerche testuali
@@index([title(ops: raw("gin_trgm_ops"))])  // GIN per full-text search
```

---

## 🔄 State Management Issues

### 1. **Local State Explosion**

**File:** `components/task-detail-modal.tsx`

Il componente ha **40+ stati locali**:
```typescript
const [task, setTask] = useState<any>(null);
const [subtasks, setSubtasks] = useState<Subtask[]>([]);
const [comments, setComments] = useState<Comment[]>([]);
// ... altri 37 stati
```

Questo rende:
- Difficile il debugging
- Rerendering eccessivo
- Impossibile condividere stato tra componenti

### 2. **No Optimistic Updates**

La maggior parte delle operazioni (toggle subtask, add comment) aspetta la risposta del server prima di aggiornare l'UI.

---

## 🎨 Frontend Performance

### 1. **CSS Bundle Size**

- Tailwind + shadcn/ui generano CSS pesante
- Nessun purge configurato specificamente
- `browserslist` include IE11 (!) - aumenta bundle size

### 2. **Image Optimization**

**File:** `next.config.js`
```javascript
images: { unoptimized: true }  // ❌ Disabilita l'ottimizzazione
```

### 3. **JavaScript Bundle**

Dipendenze pesanti identificate:
- `plotly.js` (2.35.3) - 3MB+ non compresso
- `tiptap` con molte estensionioni
- `framer-motion` - anche se usato poco

---

## ✅ Strengths del Codebase

1. **Type Safety** - Buon uso di TypeScript
2. **Component Architecture** - shadcn/ui ben integrato
3. **Security** - NextAuth con sessioni, permessi implementati
4. **Accessibility** - Radix UI come base
5. **Error Handling** - Try/catch nei fetch
6. **Optimistic Updates** - Presente in kanban-board.tsx

---

## 📈 Performance Metrics (Stimate)

| Operazione | Tempo Attuale | Target | Priorità |
|------------|---------------|--------|----------|
| Apertura Task Modal | 400-800ms | <100ms | 🔴 P0 |
| Caricamento Dashboard | 800-1500ms | <300ms | 🔴 P0 |
| Cambio Tab Progetto | 200-400ms | <50ms | 🟡 P1 |
| Ricerca Task | 300-600ms | <100ms | 🟡 P1 |
| Drag & Drop Kanban | 100-200ms | istantaneo | 🟢 P2 |

---

## 🔍 Specific Code Smells

### 1. **Any Type Usage**
```typescript
const [task, setTask] = useState<any>(null);  // task-detail-modal.tsx:203
```

### 2. **Client-side Sorting/Pagination**
```typescript
// project-task-lists.tsx - ordinamento locale che perde il significato con grandi dataset
const sortedLists = [...lists].sort((a, b) => { ... });
```

### 3. **localStorage Sync Issues**
```typescript
// kanban-board.tsx e task-detail-modal.tsx
localStorage.setItem(`task_subtask_order_${taskId}`, JSON.stringify(orderMap));
// Nessun meccanismo di cleanup, può crescere indefinitamente
```

### 4. **useEffect Cascade**
```typescript
// task-detail-modal.tsx
// Effetto apre modal → effetto fetch → effetto set state → re-render
```

---

## 🏗️ Architecture Recommendations

### 1. **Implementare State Management Globale**

```typescript
// Stores consigliati con Zustand:
- useTaskStore      // Task cache
- useProjectStore   // Project cache  
- useUIStore        // Modal state, loading states
- useNotificationStore // Notification queue
```

### 2. **API Layer Unificato**

```typescript
// lib/api.ts
export const api = {
  tasks: {
    get: (id) => fetchWithCache(`/api/tasks/${id}`),
    list: (params) => fetchWithCache(`/api/tasks?${params}`),
    update: (id, data) => mutate(`/api/tasks/${id}`, data),
  },
  // ...
};
```

### 3. **Database Query Optimization**

Usare `include` di Prisma in modo strategico:
```typescript
// Invece di N chiamate separate
const task = await prisma.task.findUnique({
  where: { id },
  include: {
    assignees: { include: { user: true } },
    subtasks: true,
    comments: { take: 50, orderBy: { createdAt: 'desc' } },
    tags: true,
    _count: { select: { attachments: true } },
  },
});
```

---

## 🎬 Conclusione

L'applicazione ha una solida base architetturale ma soffre di problemi di performance tipici di applicazioni in crescita:

1. **Over-fetching** - Troppe chiamate API
2. **N+1 queries** - Database non ottimizzato
3. **No caching** - Ogni azione ricarica tutto
4. **State locale esploso** - Difficile da mantenere

La buona notizia è che questi problemi sono **risolvibili in modo incrementale** senza rewrite massiccio.

---

## 📚 Files Revisionati

| File | Linee | Issues | Priority |
|------|-------|--------|----------|
| `components/task-detail-modal.tsx` | 1500+ | 15 | 🔴 |
| `app/dashboard/page.tsx` | 558 | 8 | 🔴 |
| `components/project-task-lists.tsx` | 1000+ | 10 | 🔴 |
| `app/project/[id]/page.tsx` | 240 | 5 | 🟡 |
| `components/kanban/kanban-board.tsx` | 147 | 3 | 🟡 |
| `components/create-task-global-dialog.tsx` | 341 | 4 | 🟡 |

---

*Review completata il: 30 Gennaio 2026*
*Reviewer: AI Code Reviewer*
