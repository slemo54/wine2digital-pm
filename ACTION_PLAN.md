# Piano d'Azione - Ottimizzazione Performance Wine2Digital PM

## 🎯 Obiettivo

Ridurre il **Time to Interactive (TTI)** e migliorare la **perceived performance** per renderla immediata e fluida.

---

## 📋 Quick Wins (Settimana 1-2)

### 1.1 Implementare React Query / TanStack Query

**Priorità:** 🔴 P0 - **IMPATTO MASSIMO**
**Sforzo:** Medio (2-3 giorni)

**Azioni:**
1. Installare `@tanstack/react-query` v5
2. Creare provider wrapper
3. Migrare le chiamate API principali

```typescript
// lib/query-client.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minuti
      cacheTime: 1000 * 60 * 30, // 30 minuti
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// hooks/use-task.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useTask(taskId: string) {
  return useQuery({
    queryKey: ['task', taskId],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (!res.ok) throw new Error('Failed to fetch task');
      return res.json();
    },
    enabled: !!taskId,
  });
}

export function useTaskDetails(taskId: string) {
  // Combina tutte le chiamate in una sola query
  return useQuery({
    queryKey: ['task-details', taskId],
    queryFn: async () => {
      const [task, subtasks, comments, attachments, activity] = await Promise.all([
        fetch(`/api/tasks/${taskId}`).then(r => r.json()),
        fetch(`/api/tasks/${taskId}/subtasks`).then(r => r.json()),
        fetch(`/api/tasks/${taskId}/comments`).then(r => r.json()),
        fetch(`/api/tasks/${taskId}/attachments`).then(r => r.json()),
        fetch(`/api/tasks/${taskId}/activity`).then(r => r.json()),
      ]);
      return { task, subtasks, comments, attachments, activity };
    },
    enabled: !!taskId,
    staleTime: 1000 * 30, // 30 secondi
  });
}
```

**Beneficio:**
- Dati cached tra apertura/chiusura modali
- Deduplicazione richieste
- Background refetch automatico
- **Risparmio stimato: 300-500ms per apertura modal**

---

### 1.2 Creare API Unificata per Task Details

**Priorità:** 🔴 P0
**Sforzo:** Basso (1 giorno)

**File:** `app/api/tasks/[id]/full/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const taskId = params.id;

  // SINGLE QUERY con tutte le relazioni
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      project: {
        select: { id: true, name: true },
      },
      taskList: {
        select: { id: true, name: true },
      },
      tags: true,
      assignees: {
        include: {
          user: {
            select: { id: true, name: true, firstName: true, lastName: true, image: true, email: true },
          },
        },
      },
      subtasks: {
        orderBy: { position: 'asc' },
        include: {
          assignee: {
            select: { id: true, name: true, firstName: true, lastName: true, image: true, email: true },
          },
          dependencies: true,
          _count: { select: { comments: true, attachments: true } },
        },
      },
      comments: {
        orderBy: { createdAt: 'desc' },
        take: 50, // Paginazione
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
      },
      attachments: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: {
          actor: {
            select: { id: true, name: true, firstName: true, lastName: true, email: true, image: true },
          },
        },
      },
      customFieldValues: {
        include: {
          customField: true,
        },
      },
      _count: {
        select: { comments: true, attachments: true, subtasks: true },
      },
    },
  });

  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  return NextResponse.json({ task });
}
```

**Modifica task-detail-modal.tsx:**
```typescript
// Prima: 5 chiamate parallele
// Dopo: 1 sola chiamata
const { data, isLoading } = useQuery({
  queryKey: ['task-full', taskId],
  queryFn: () => fetch(`/api/tasks/${taskId}/full`).then(r => r.json()),
  enabled: open && !!taskId,
});
```

**Beneficio:**
- **Riduzione da 5 a 1 round-trip**
- **Risparmio stimato: 200-400ms**

---

### 1.3 Ottimizzare Dashboard con Parallel Fetching

**Priorità:** 🔴 P0
**Sforzo:** Basso (2 ore)

**File:** `app/dashboard/page.tsx`

```typescript
// Sostituire useEffect sequenziale con Promise.all
useEffect(() => {
  if (status !== "authenticated") return;
  
  // Fetch paralleli
  Promise.all([
    fetchProjects(),
    fetchMyTasks(),
    fetchMySubtasks(),
    fetchNotifications(),
    fetchActivity(),
  ]);
}, [status]);

// O ancora meglio con React Query:
function useDashboardData() {
  const projectsQuery = useQuery({
    queryKey: ['dashboard', 'projects'],
    queryFn: fetchProjects,
  });
  
  const tasksQuery = useQuery({
    queryKey: ['dashboard', 'my-tasks'],
    queryFn: fetchMyTasks,
  });
  
  // ... altre queries
  
  return {
    isLoading: projectsQuery.isLoading || tasksQuery.isLoading || ...,
    projects: projectsQuery.data,
    tasks: tasksQuery.data,
    // ...
  };
}
```

**Beneficio:**
- **Riduzione tempo caricamento dashboard: 50%**

---

## 🚀 Miglioramenti Medi (Settimana 3-4)

### 2.1 Implementare Virtual Scrolling

**Priorità:** 🟡 P1
**Sforzo:** Medio (2-3 giorni)

Per liste lunghe di task/subtasks:

```typescript
// npm install @tanstack/react-virtual

import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualTaskList({ tasks }: { tasks: Task[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72, // Altezza stimata riga
  });

  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: virtualItem.size,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <TaskCard task={tasks[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Beneficio:**
- Renderizza solo elementi visibili
- Supporta liste con 10.000+ task senza lag

---

### 2.2 Implementare Optimistic Updates

**Priorità:** 🟡 P1
**Sforzo:** Medio (2-3 giorni)

```typescript
// hooks/use-subtask-mutations.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useToggleSubtask(taskId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ subtaskId, completed }: { subtaskId: string; completed: boolean }) => {
      const res = await fetch(`/api/tasks/${taskId}/subtasks/${subtaskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed }),
      });
      if (!res.ok) throw new Error('Failed to update');
      return res.json();
    },
    
    // OPTIMISTIC UPDATE
    onMutate: async ({ subtaskId, completed }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['task-details', taskId] });
      
      // Snapshot previous value
      const previousData = queryClient.getQueryData(['task-details', taskId]);
      
      // Optimistically update
      queryClient.setQueryData(['task-details', taskId], (old: any) => ({
        ...old,
        task: {
          ...old.task,
          subtasks: old.task.subtasks.map((s: any) =>
            s.id === subtaskId ? { ...s, completed, status: completed ? 'done' : 'todo' } : s
          ),
        },
      }));
      
      return { previousData };
    },
    
    // Rollback on error
    onError: (err, variables, context) => {
      queryClient.setQueryData(['task-details', taskId], context?.previousData);
      toast.error('Failed to update subtask');
    },
    
    // Refetch after success (optional)
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['task-details', taskId] });
    },
  });
}
```

**Beneficio:**
- **UI risponde immediatamente (<16ms)**
- Migliore UX per operazioni frequenti (toggle, commenti)

---

### 2.3 Lazy Loading dei Dialog

**Priorità:** 🟡 P1
**Sforzo:** Basso (1 giorno)

```typescript
// components/dialogs/index.ts
import { lazy, Suspense } from 'react';

const CreateTaskDialog = lazy(() => import('./create-task-dialog'));
const TaskDetailModal = lazy(() => import('./task-detail-modal'));
const CreateProjectDialog = lazy(() => import('./create-project-dialog'));

export function LazyCreateTaskDialog(props: any) {
  return (
    <Suspense fallback={<DialogSkeleton />}>
      <CreateTaskDialog {...props} />
    </Suspense>
  );
}

// DialogSkeleton.tsx
function DialogSkeleton() {
  return (
    <div className="animate-pulse p-6 space-y-4">
      <div className="h-6 bg-gray-200 rounded w-1/3" />
      <div className="h-4 bg-gray-200 rounded w-2/3" />
      <div className="h-32 bg-gray-200 rounded" />
    </div>
  );
}
```

**Modifica next.config.js:**
```javascript
const nextConfig = {
  // ... existing config
  experimental: {
    // Abilita lazy loading ottimizzato
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
};
```

---

### 2.4 Aggiungere Indici Database

**Priorità:** 🟡 P1
**Sforzo:** Basso (2 ore)

**Migration Prisma:**

```prisma
// schema.prisma aggiunte

model Task {
  // ... existing fields
  
  @@index([projectId, status, updatedAt])
  @@index([assignees(userId), status]) // Virtual index via relation
}

model TaskAssignee {
  // ... existing fields
  
  @@index([userId, taskId])
}

model Subtask {
  // ... existing fields
  
  @@index([assigneeId, status])
  @@index([taskId, status, position])
}

model Notification {
  // ... existing fields
  
  @@index([userId, isRead, createdAt])
}
```

**Comandi:**
```bash
npx prisma migrate dev --name add_performance_indexes
```

---

## 🔧 Ottimizzazioni Avanzate (Settimana 5-6)

### 3.1 Implementare Server-Side Rendering Selettivo

**Priorità:** 🟢 P2
**Sforzo:** Alto (4-5 giorni)

Per pagine come il progetto, usare SSR per i dati iniziali:

```typescript
// app/project/[id]/page.tsx
import { Suspense } from 'react';

// Questo componente viene renderizzato server-side
async function ProjectHeader({ projectId }: { projectId: string }) {
  const project = await getProject(projectId); // Server action
  return <ProjectHeaderView project={project} />;
}

// Questo viene renderizzato client-side con streaming
function ProjectTasks({ projectId }: { projectId: string }) {
  return (
    <Suspense fallback={<TasksSkeleton />}>
      <ProjectTaskLists projectId={projectId} />
    </Suspense>
  );
}

export default function ProjectPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <ProjectHeader projectId={params.id} />
      <ProjectTasks projectId={params.id} />
    </div>
  );
}
```

---

### 3.2 Implementare Infinite Scroll

**Priorità:** 🟢 P2
**Sforzo:** Medio (2-3 giorni)

```typescript
// hooks/use-infinite-tasks.ts
import { useInfiniteQuery } from '@tanstack/react-query';

export function useInfiniteTasks(projectId: string) {
  return useInfiniteQuery({
    queryKey: ['tasks', 'infinite', projectId],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await fetch(
        `/api/tasks?projectId=${projectId}&page=${pageParam}&pageSize=50`
      );
      return res.json();
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.tasks.length < 50) return undefined;
      return allPages.length + 1;
    },
    initialPageParam: 1,
  });
}

// Componente
import { useInView } from 'react-intersection-observer';

function TaskList({ projectId }: { projectId: string }) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteTasks(projectId);
  const { ref, inView } = useInView();
  
  useEffect(() => {
    if (inView && hasNextPage) fetchNextPage();
  }, [inView, hasNextPage]);
  
  return (
    <div>
      {data?.pages.map((page, i) => (
        <div key={i}>
          {page.tasks.map(task => <TaskCard key={task.id} task={task} />)}
        </div>
      ))}
      <div ref={ref}>
        {isFetchingNextPage && <LoadingSpinner />}
      </div>
    </div>
  );
}
```

---

### 3.3 Implementare State Management con Zustand

**Priorità:** 🟢 P2
**Sforzo:** Medio (3-4 giorni)

```typescript
// stores/task-store.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface TaskState {
  // Cache task
  tasks: Record<string, Task>;
  // Cache dettagli
  taskDetails: Record<string, TaskDetails>;
  // UI state
  openTaskId: string | null;
  isTaskModalOpen: boolean;
  
  // Actions
  setTask: (task: Task) => void;
  setTaskDetails: (taskId: string, details: TaskDetails) => void;
  openTask: (taskId: string) => void;
  closeTask: () => void;
  updateSubtask: (taskId: string, subtaskId: string, data: Partial<Subtask>) => void;
}

export const useTaskStore = create<TaskState>()(
  devtools(
    persist(
      (set, get) => ({
        tasks: {},
        taskDetails: {},
        openTaskId: null,
        isTaskModalOpen: false,
        
        setTask: (task) => set((state) => ({
          tasks: { ...state.tasks, [task.id]: task },
        })),
        
        setTaskDetails: (taskId, details) => set((state) => ({
          taskDetails: { ...state.taskDetails, [taskId]: details },
        })),
        
        openTask: (taskId) => set({ openTaskId: taskId, isTaskModalOpen: true }),
        closeTask: () => set({ openTaskId: null, isTaskModalOpen: false }),
        
        updateSubtask: (taskId, subtaskId, data) => set((state) => {
          const details = state.taskDetails[taskId];
          if (!details) return state;
          
          return {
            taskDetails: {
              ...state.taskDetails,
              [taskId]: {
                ...details,
                subtasks: details.subtasks.map(s =>
                  s.id === subtaskId ? { ...s, ...data } : s
                ),
              },
            },
          };
        }),
      }),
      {
        name: 'task-store',
        partialize: (state) => ({ tasks: state.tasks }), // Persist only tasks cache
      }
    )
  )
);
```

---

### 3.4 Implementare Prefetching Intelligente

**Priorità:** 🟢 P2
**Sforzo:** Medio (2 giorni)

```typescript
// components/task-card.tsx
import { useQueryClient } from '@tanstack/react-query';

function TaskCard({ task }: { task: Task }) {
  const queryClient = useQueryClient();
  
  const handleMouseEnter = () => {
    // Prefetch quando l'utente hovera sulla card
    queryClient.prefetchQuery({
      queryKey: ['task-full', task.id],
      queryFn: () => fetch(`/api/tasks/${task.id}/full`).then(r => r.json()),
      staleTime: 1000 * 60 * 5, // 5 minuti
    });
  };
  
  return (
    <div onMouseEnter={handleMouseEnter}>
      {/* ... card content */}
    </div>
  );
}
```

---

## 🎨 Ottimizzazioni UI/UX

### 4.1 Skeleton Screens

**File:** `components/skeletons/task-modal-skeleton.tsx`

```typescript
export function TaskModalSkeleton() {
  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-6 w-6 rounded-full" />
      </div>
      
      {/* Meta info */}
      <div className="flex gap-2">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-24" />
      </div>
      
      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
      
      {/* Content */}
      <div className="space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-3/4" />
      </div>
    </div>
  );
}
```

---

### 4.2 Transizioni Fluide

```typescript
// components/ui/sheet.tsx modifiche
import { motion, AnimatePresence } from 'framer-motion';

// Aggiungere animazioni ai modal
const slideInVariants = {
  hidden: { x: '100%', opacity: 0 },
  visible: { 
    x: 0, 
    opacity: 1,
    transition: { type: 'spring', damping: 25, stiffness: 200 }
  },
  exit: { 
    x: '100%', 
    opacity: 0,
    transition: { duration: 0.2 }
  },
};
```

---

## 📊 Monitoring e Metriche

### 5.1 Implementare Web Vitals Tracking

```typescript
// lib/analytics.ts
export function reportWebVitals(metric: any) {
  // Invia a analytics
  if (window.gtag) {
    window.gtag('event', metric.name, {
      value: Math.round(metric.value),
      event_category: 'Web Vitals',
      event_label: metric.id,
      non_interaction: true,
    });
  }
  
  // Log in console per debug
  if (process.env.NODE_ENV === 'development') {
    console.log(metric);
  }
}

// app/layout.tsx
import { reportWebVitals } from '@/lib/analytics';

export function reportWebVitals(metric: any) {
  reportWebVitals(metric);
}
```

### 5.2 Performance Marks

```typescript
// hooks/use-performance-marks.ts
export function usePerformanceMark(name: string) {
  useEffect(() => {
    performance.mark(`${name}-start`);
    
    return () => {
      performance.mark(`${name}-end`);
      performance.measure(name, `${name}-start`, `${name}-end`);
      
      const measure = performance.getEntriesByName(name)[0];
      console.log(`${name}: ${measure.duration}ms`);
    };
  }, [name]);
}

// Uso nel modal
function TaskDetailModal({ taskId }: { taskId: string }) {
  usePerformanceMark(`task-modal-${taskId}`);
  // ...
}
```

---

## 🗓️ Timeline di Implementazione

```
Settimana 1:
├── Giorno 1-2: Installare React Query, setup provider
├── Giorno 3: Creare API /tasks/[id]/full
└── Giorno 4-5: Migrare task-detail-modal a React Query

Settimana 2:
├── Giorno 1-2: Ottimizzare Dashboard con Promise.all
├── Giorno 3: Implementare optimistic updates
└── Giorno 4-5: Aggiungere skeleton screens

Settimana 3:
├── Giorno 1-2: Implementare lazy loading dialogs
├── Giorno 3: Aggiungere indici database
└── Giorno 4-5: Implementare virtual scrolling per liste lunghe

Settimana 4:
├── Giorno 1-2: Setup Zustand store
├── Giorno 3-4: Implementare prefetching
└── Giorno 5: Testing e ottimizzazioni finali

Settimana 5-6 (Opzionale):
├── Implementare SSR selettivo
├── Setup monitoring Web Vitals
└── Ottimizzazioni bundle (code splitting)
```

---

## 🎯 KPI di Successo

| Metrica | Attuale | Target | Come Misurare |
|---------|---------|--------|---------------|
| Apertura Task Modal | 400-800ms | <150ms | React Query devtools + Performance API |
| Dashboard Load | 800-1500ms | <400ms | Lighthouse TTI |
| Time to Interactive | 3-5s | <2s | Lighthouse |
| Cumulative Layout Shift | ~0.1 | <0.05 | Lighthouse CLS |
| First Contentful Paint | 1.5-2s | <1s | Lighthouse FCP |

---

## 🛠️ Checklist Implementazione

### Pre-implementazione:
- [ ] Backup database
- [ ] Setup branch `performance-optimization`
- [ ] Installare React Query DevTools

### Durante implementazione:
- [ ] Testare ogni modifica in locale
- [ ] Verificare non ci siano regressioni
- [ ] Aggiornare test se necessario

### Post-implementazione:
- [ ] Deploy su staging
- [ ] Test con dati realistici
- [ ] Monitorare errori
- [ ] Misurare miglioramenti

---

## 📚 Risorse Utili

1. **React Query Documentation**: https://tanstack.com/query/latest
2. **Next.js Performance**: https://nextjs.org/docs/advanced-features/measuring-performance
3. **Web Vitals**: https://web.dev/vitals/
4. **Prisma Optimization**: https://www.prisma.io/docs/guides/performance-and-optimization

---

*Piano creato il: 30 Gennaio 2026*
*Prossima review: dopo completamento Settimana 2*
