# Clockify (report giornaliero) — Modulo separato

Questa sezione aggiunge un modulo “Clockify-like” **separato** da Progetti/Task della parte Project Management.

## Scopo
- **Report giornaliero** (e viste Settimana/Mese) delle attività svolte.
- **Inserimento manuale** delle time entry dentro wine2digital-pm.
- **Visibilità per ruoli + reparto** (department):
  - **member**: vede solo le proprie entry
  - **manager**: vede le entry degli utenti del proprio reparto (se reparto valido), altrimenti vede solo sé
  - **admin**: vede tutto

## Cosa include (UI)
Pagina: `/clockify`
- **Header** con CTA: `Nuova entry`, `Export CSV`
- **Summary cards** con totali del periodo selezionato
- **Filtri**: ricerca, progetto, utente (solo admin/manager)
- **Viste**:
  - **Giorno**: tabella dettagliata
  - **Settimana**: vista calendario (griglia oraria)
  - **Mese**: vista compatta (totali per giorno). Click su un giorno → torna a “Giorno”.

Nota UX:
- In vista **Settimana/Mese** per **admin/manager** è richiesto un **singolo utente** (niente “Tutti”) per mantenere la vista **compatta e scalabile**.

## Data model (Prisma)
Modelli aggiunti (separati da `Project`/`Task`):
- `ClockifyProject`: lista progetti (name + client)
- `ClockifyEntry`: time entry manuali

Migrazione:
- `prisma/migrations/20260113_clockify_reporting/migration.sql`

## API
Base path: `/api/clockify/*`
- `GET /api/clockify/projects` → lista progetti Clockify
- `GET /api/clockify/users` → lista utenti visibili (scope per ruolo/reparto)
- `GET /api/clockify/entries` → entries con filtri:
  - `date=YYYY-MM-DD` (giorno singolo)
  - oppure `from=YYYY-MM-DD&to=YYYY-MM-DD` (range)
  - `q`, `projectId`, `userId`
- `POST /api/clockify/entries` → crea entry **sempre per l’utente loggato**

## Import progetti (da CSV Clockify)
Script idempotente:
- `scripts/import-clockify-projects.ts`

Esempio:
```bash
cd nextjs_space
tsx scripts/import-clockify-projects.ts /path/to/Clockify_Time_Report_Detailed_....csv
```

Lo script fa **upsert** delle coppie uniche (Project, Client) su `ClockifyProject`.

## Reparti (Admin → Utenti)
Il reparto utente è gestito da admin in `Admin · Utenti` come **dropdown fisso**:
- `Backoffice`
- `IT`
- `Grafica`
- `Social`

Valori “legacy/non standard” restano salvati in DB finché un admin non li riallinea.

## Feature flag (attivazione/disattivazione)
Clockify è controllato da una variabile ambiente:
- `NEXT_PUBLIC_CLOCKIFY_ENABLED=true`

Se non impostata o diversa da `"true"`, Clockify viene:
- **nascosto dalla sidebar**
- la route `/clockify` **non viene mostrata** (redirect a `/dashboard`)

Per riattivarlo:
1) Impostare `NEXT_PUBLIC_CLOCKIFY_ENABLED=true` (Vercel → Environment Variables)
2) Fare redeploy

