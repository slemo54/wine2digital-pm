---
name: review-velocita-webapp
overview: Review strutturata per migliorare la velocità percepita e reale (INP/TTFB) della web app, con focus su /project, liste task e drawer task, includendo audit frontend, API/DB e deploy/monitoring.
todos:
  - id: baseline-metrics
    content: Raccogliere baseline (overlay perf + Server-Timing) su /project e apertura drawer task
    status: completed
  - id: third-party-scripts
    content: Audit e mitigazione impatto script terze parti in app/layout.tsx (lazy/on-demand/route-gating)
    status: completed
  - id: project-code-splitting
    content: Ridurre JS iniziale su /project/[id] con dynamic import dei tab non iniziali e review RSC parziale
    status: completed
  - id: task-lists-rendering
    content: Ridurre DOM/rendering in ProjectTaskLists (virtualizzazione o limitazione iniziale + progressive load)
    status: completed
  - id: drawer-payload-split
    content: Ridurre payload core drawer task e demand-load per members/lists/tags/picker
    status: completed
  - id: api-timing-expansion
    content: Estendere Server-Timing ai principali endpoint del flusso /project e /tasks per profilare auth/db/total
    status: completed
  - id: db-index-audit
    content: Audit indici su Task/Message/Notification + migrazioni sicure (anche CONCURRENTLY se necessario)
    status: completed
  - id: perf-regression-tests
    content: Aggiungere test (unit/integration) e smoke e2e per prevenire regressioni di performance
    status: completed
isProject: false
---

# Piano review performance web app

## Obiettivi (misurabili)

- **Interattività UI (INP)**: migliorare la responsività su `/project/[id]` (click su task → drawer) e su navigazione sidebar.
- **Drawer task**: mostrare feedback immediato (skeleton/loader) e rendere disponibili i dati core (titolo/stato/assegnati) il prima possibile.
- **Backend**: ridurre latenza e variabilità (cold start/DB) sulle chiamate critiche.

## Baseline (prima di cambiare altro)

- **Client perf**: usare overlay `?perf=1` (già presente) per registrare eventi di apertura drawer e fetch (es. `TaskDetailModal.fetchTaskCore`).
- **Server perf**: raccogliere `Server-Timing` (già presente su task/subtasks) dalle chiamate:
- `GET /api/tasks/:id?perf=1`
- `GET /api/tasks/:id/subtasks?perf=1`
- **Output atteso**: una tabella “prima/dopo” con mediana/p95 per:
- tempo UI (overlay)
- `total` e `db` (Server-Timing)

## Workstream A — Tagliare impatto di script terze parti (alto impatto, basso rischio)

- In `[nextjs_space/app/layout.tsx](nextjs_space/app/layout.tsx)` oggi vengono caricati globalmente:
- `https://apps.abacus.ai/chatllm/appllm-lib.js` (strategy `afterInteractive`)
- `https://elfsightcdn.com/platform.js` (strategy `afterInteractive`)
- **Review**:
- misurare impatto su INP/CPU (soprattutto su `/project/[id]`)
- verificare errori console “invalid origin” e loro costo runtime
- **Azioni candidate**:
- caricare in modo **più tardivo** (`lazyOnload`) o **on-demand** (solo dopo interazione / solo su alcune route)
- isolare in un componente client dedicato che inietta script con `requestIdleCallback`

## Workstream B — `/project/[id]`: ridurre JS iniziale e lavoro in main thread

- In `[nextjs_space/app/project/[id]/page.tsx](nextjs_space/app/project/[id]/page.tsx)` la pagina è `"use client"` e importa componenti non necessari al tab iniziale.
- **Review**:
- verificare bundle/parse e quali componenti entrano nel JS iniziale
- **Azioni candidate**:
- dynamic import per contenuti tab non iniziali (`ProjectChat`, `ProjectFiles`, wiki panel)
- mantenere la pagina funzionante a step piccoli (una tab alla volta)
- opzione “medium risk”: trasformare parte della pagina in server component e passare dati iniziali ai client component

## Workstream C — Liste task: DOM e rendering (virtualizzazione/limitazione)

- In `[nextjs_space/components/project-task-lists.tsx](nextjs_space/components/project-task-lists.tsx)` si caricano fino a `pageSize=200` e si renderizza per lista.
- **Review**:
- contare numero totale di nodi renderizzati (liste x task) e correlare con INP
- **Azioni candidate**:
- **virtualizzazione** delle righe task quando superano una soglia (es. >200)
- limitare rendering iniziale (es. prime N task per lista + “mostra altre”)
- ridurre payload iniziale (pageSize più basso + prefetch progressivo)

## Workstream D — Drawer task: ridurre payload “core” e demand-load di dati pesanti

- In `[nextjs_space/components/task-detail-modal.tsx](nextjs_space/components/task-detail-modal.tsx)` il drawer è già impostato per caricare progressivamente.
- **Review**:
- controllare se `GET /api/tasks/:id` include dati non indispensabili al primo paint (es. `project.members` completo)
- **Azioni candidate**:
- spostare members/list/tags su fetch “on-demand” (apertura picker assignee/tag/list)
- aggiungere `Server-Timing` anche su endpoint correlati (es. `/api/projects/:id`, `/api/tasks`)

## Workstream E — API/DB: indici e query plan sui flussi più usati

- Indici già critici (subtasks) sono stati aggiunti; ora serve una **review completa** su tabelle più calde:
- `Task` (filtri per `projectId`, `status`, `updatedAt`, `listId`)
- `Message` (chat: `projectId`, `createdAt`) — oggi **manca un index** in schema (`model Message` in `[nextjs_space/prisma/schema.prisma](nextjs_space/prisma/schema.prisma)`)
- `Notification` (per utente e ordering)
- **Azioni candidate**:
- aggiungere `@@index` mirati in Prisma + migration
- per tabelle grandi: usare migrazioni SQL con `CREATE INDEX CONCURRENTLY` per evitare lock (valutare su Supabase)

## Workstream F — Rollout, test e regressioni

- **Test**:
- unit test per funzioni di selezione/payload (collocati vicino al codice)
- integration test per endpoint API modificati (shape, permessi, view param)
- smoke e2e manuale: `/project` → apri task → verifica tempi e number of requests
- **Rollout**:
- deploy preview → verifica overlay + Server-Timing
- deploy prod → migrazioni → monitor (Vercel + overlay)

## Deliverable finale

- Report “prima/dopo” con: INP (percepito), overlay timings, `Server-Timing` (auth/db/total), e lista cambiamenti con impatto stimato.

