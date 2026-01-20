# Wine2Digital PM – Next.js / Prisma

Applicazione Next.js 14 con NextAuth, Prisma/PostgreSQL (Supabase-compatible) e Tailwind. Questo README è pensato per handover e passaggio di consegne.

## Documentazione (uso piattaforma)
- `GUIDA_UTILIZZO.md` – indice generale
- `GUIDA_UTILIZZO_COLLEGHI_SOLO_CALENDARIO.md` – guida per chi usa solo Calendario (assenze)
- `GUIDA_UTILIZZO_COLLEGHI_CALENDARIO_PM.md` – guida per chi usa Calendario + PM (task/progetti)
- `GUIDA_UTILIZZO_ADMIN.md` – guida amministratori

## Stack
- Next.js 14 (app router, TypeScript)
- NextAuth (Google OAuth + credenziali)
- Prisma + PostgreSQL (database hostabile su Supabase)
- TailwindCSS

## Requisiti
- Node.js 18+
- Accesso al database PostgreSQL (`DATABASE_URL`)
- Variabili d’ambiente configurate (vedi sotto)

## Variabili d’ambiente (non committare)
Impostare in `.env` locale e su Vercel:
- `DATABASE_URL` – stringa Postgres/Supabase
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL` – es. `http://localhost:3000` in locale, URL Vercel in prod
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_WORKSPACE_DOMAIN` – dominio consentito per SSO
- `GOOGLE_ADMIN_EMAILS` – lista CSV di email admin
- `GOOGLE_MANAGER_EMAILS` – lista CSV di email manager

### Notifiche email (Resend)
Per inviare email (oltre alle notifiche in-app) per menzioni/chat/assenze:
- `EMAIL_NOTIFICATIONS_ENABLED=true`
- `RESEND_API_KEY` – API key Resend
- `RESEND_FROM=it@mammajumboshrimp.com` – mittente (dominio deve essere verificato su Resend)

Note:
- Le email includono link assoluti basati su `NEXTAUTH_URL` (impostalo correttamente in prod).
- Se `EMAIL_NOTIFICATIONS_ENABLED` non è `"true"`, l’app invia solo notifiche in-app.
- `RESEND_FROM` ha fallback a `it@mammajumboshrimp.com` se non impostato.

## Setup locale
```bash
npm install
npx prisma generate
npx prisma db push      # o migrate deploy su ambienti con migrazioni
npm run dev
```

Seed (cancella i dati e ricrea utenti/progetti di esempio):
```bash
npx prisma db push
node --require dotenv/config scripts/seed.ts
```

## Build & test
```bash
npm run build
npm run lint            # lint Next.js/TypeScript
```

## Deploy (Vercel)
1) Collegare il repo GitHub a Vercel.
2) Impostare le env sopra in Vercel (Production/Preview).
3) Build command: `npm run build` – Output dir: `.next`.
4) Dopo il deploy, eseguire eventuale `prisma migrate deploy`/`db push` contro il DB gestito (es. Supabase).

## Note su autenticazione
- SSO Google vincolato al dominio `GOOGLE_WORKSPACE_DOMAIN`; ruoli determinati da liste `GOOGLE_ADMIN_EMAILS`/`GOOGLE_MANAGER_EMAILS`.
- Credenziali email/password supportate; le password sono hashate con bcrypt.

## Percorsi chiave
- `app/` – pagine e route Next.js
- `lib/auth-options.ts` – configurazione NextAuth
- `lib/prisma.ts` / `lib/db.ts` – client Prisma (singleton)
- `prisma/schema.prisma` – schema DB
- `scripts/seed.ts` – dati demo

## Checklist handover
- Aggiornare `.env` locale e Vercel con i valori corretti.
- Verificare accesso al DB (Supabase/Postgres) e applicare migrazioni.
- Eseguire `npm run build` prima del primo deploy per validare la pipeline.
- Proteggere il branch `main` (PR + CI) se necessario.

