# 🛡️ Guida (Admin) — Wine2Digital PM

Questa guida è per gli **amministratori** che gestiscono utenti, permessi e configurazioni globali.

## Ruoli: cosa contano davvero

### Ruolo globale account
- `member`: uso standard.
- `manager`: alcune funzioni avanzate (approvazioni/gestione in certi contesti).
- `admin`: accesso completo + sezione **Admin** nel menu.

### Ruolo dentro un progetto
- `member`: partecipa al progetto.
- `manager` / `owner`: può gestire membri e inviti del progetto.

## Admin · Utenti (`/admin/users`)

Qui puoi:
- **cercare utenti** (email/nome)
- filtrare per **ruolo** (admin/manager/member)
- filtrare per **stato** (attivo/disattivato)
- cambiare **ruolo**
- **disattivare/riattivare** un account (switch “Attivo”)
- aprire l’**Audit** dell’utente (bottone “Audit”)

### Buona pratica
- Se qualcuno lascia l’azienda: **disattiva** l’account (non serve “cancellare”).
- Tieni pochi admin: promuovi solo chi serve davvero.

## Admin · Settings (`/admin/settings`)

Qui imposti le **regole globali** (Work Rules).

Attualmente nella UI trovi soprattutto:
- **Standard Start Time**
- **Standard End Time**

(Nel database esistono anche altri campi “work settings”, ma potrebbero non essere esposti in UI.)

## Admin · Audit Log (`/admin/audit`)

Serve per tracciare azioni amministrative.

Puoi filtrare:
- `entityType` (es. `User`)
- `entityId` (opzionale)

Mostra:
- azione
- data/ora
- attore (chi ha fatto l’azione)
- metadata (dettagli)

## Admin · Archivio richieste (`/admin/absences`)

Pagina per gestire lo **storico delle richieste di assenza**:
- filtri (utente/email, status, tipo, range date)
- **Export CSV** (con limite massimo per evitare esportazioni gigantesche)
- eliminazione di una singola riga oppure **bulk delete** (con “dry run” per stimare quante righe verranno eliminate)

## Gestione membri nei progetti (owner/manager/admin)

Dentro un progetto, nel riquadro “Team”:
- se hai permessi vedi **Membri** con tab:
  - **Membri**: elenco + cambio ruolo progetto (member/manager/owner)
  - **Aggiungi**: aggiungi utenti interni già registrati
  - **Invita**: genera un link invito

### Link invito progetto
Puoi creare un link che porta a:
- **`/invites/join?token=...`**

Impostazioni invito tipiche:
- ruolo del nuovo membro (`member` o `manager`)
- scadenza (24h / 7gg / 30gg / mai)
- max utilizzi (opzionale)

## Calendario assenze: approvazioni

In **Calendario**, le azioni **Approve/Reject** sono visibili per `admin` e `manager`.

## Consigli “governance” (semplici)

- Ogni progetto dovrebbe avere:
  - almeno 1 **owner/manager**
  - una Wiki minima (brief + link + checklist)
- Incoraggia l’uso di:
  - **tag** (per raggruppare lavoro)
  - **commenti nelle task** (decisioni tracciate)
  - **allegati nelle task** (file legati a una singola attività)

