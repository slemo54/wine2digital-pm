## Permessi ruoli (member / manager / admin)

### Scopo
Questo documento descrive **i permessi effettivi** applicati dall’app (principalmente lato API) per i ruoli:
- **member**
- **manager**
- **admin**

Riferimento: implementazione attuale sotto `nextjs_space/` (API routes in `nextjs_space/app/api/**`).

### Definizioni (importante)
- **Ruolo globale (utente)**: `User.role` ∈ `member | manager | admin`
- **Ruolo nel progetto**: `ProjectMember.role` ∈ `owner | manager | member`

Molti permessi sono **condizionali**: dipendono sia dal ruolo globale sia dal ruolo nel progetto (es. “project manager” = `owner` o `manager` nel progetto).

### Tabella riassuntiva (alto livello)
Legenda: “Cond.” = condizionale (serve anche essere membro/owner/manager del progetto o assegnatario, vedi dettagli).

| Area / Azione | member (globale) | manager (globale) | admin (globale) |
|---|---|---|---|
| **Pannello Admin** (`/admin/*`) | No | No | Sì |
| **Gestione utenti (ruolo/attivo/reparto)** | No | No | Sì |
| **Audit log** | No | No | Sì |
| **Impostazioni globali (WorkSettings)** | No | No | Sì |
| **Assenze – vedere richieste** | Solo proprie | Tutte | Tutte |
| **Assenze – approvare/rifiutare/modificare** | No | Sì | Sì |
| **Assenze – eliminare** | Solo proprie | Solo proprie | Tutte |
| **Progetti – lista** | Solo progetti dove sei creator/membro | Idem | Idem (*nota: l’admin può aprire per ID anche senza essere membro*) |
| **Progetti – creare** | Sì | Sì | Sì |
| **Progetti – modificare** | Cond. (creator o project `owner/manager`) | Cond. (creator o project `owner/manager`) | Sì |
| **Progetti – eliminare** | Cond. (creator o project `owner`) | Cond. (creator o project `owner`) | Sì |
| **Membri progetto – vedere elenco** | Cond. (devi essere membro del progetto) | Cond. (devi essere membro del progetto) | Cond. (devi essere membro del progetto) |
| **Membri progetto – invitare/aggiungere/cambiare ruolo/rimuovere** | Cond. (project `owner/manager`) | Cond. (project `owner/manager`) | Cond. (*richiede comunque membership; poi l’admin bypassa*) |
| **Liste task (TaskList) – creare/rinominare/eliminare** | Cond. (project `owner/manager`) | Cond. (project `owner/manager`) | Cond. (*richiede comunque membership; poi l’admin bypassa*) |
| **Tag progetto – creare/rinominare/eliminare** | Cond. (project `owner/manager`) | Cond. (project `owner/manager`) | Cond. (*richiede comunque membership; poi l’admin bypassa*) |
| **Wiki progetto – leggere** | Cond. (membro del progetto) | Cond. (membro del progetto) | Sì (anche senza membership) |
| **Wiki progetto – creare/modificare/archiviare** | Cond. (membro del progetto) | Cond. (membro del progetto) | Sì (anche senza membership) |
| **Task – vedere** | Cond. (assegnatario **o** membro progetto) | Cond. (assegnatario **o** membro progetto) | Sì (anche senza membership) |
| **Task – creare** | Cond. (membro progetto) | Cond. (membro progetto) | Sì (anche senza membership) |
| **Task – modificare (titolo/descrizione/date/priorità/...)** | Cond. (se assegnatario **oppure** project `owner/manager`) | Cond. (se membro progetto) | Sì |
| **Task – cambiare solo “status”** | Cond. (se assegnatario) | Cond. (se membro progetto) | Sì |
| **Task – assegnare persone (assignees)** | Cond. (solo se project `owner/manager`) | Cond. (se membro progetto) | Sì |
| **Task – tag/importo/archiviazione** | Cond. (solo se project `owner/manager`) | Cond. (se membro progetto) | Sì |
| **Task – eliminare** | Cond. (solo se project `owner/manager`) | Cond. (se membro progetto) | Sì |
| **Commenti/Allegati task** | Cond. (crea se assegnatario; modifica/elimina anche se autore/uploader) | Cond. (se membro progetto; può anche moderare) | Sì |
| **Subtask – creare/modificare** | Cond. (se assegnatario task **o** assegnatario subtask, oppure project `owner/manager`) | Cond. (se membro progetto) | Sì |
| **Subtask – assegnare (assigneeId)** | Cond. (solo project `owner/manager`) | No (a meno di essere project `owner/manager`) | Sì |
| **Subtask – eliminare** | Cond. (solo project `owner/manager`) | No (a meno di essere project `owner/manager`) | Sì |
| **Checklist subtask – creare/modificare/eliminare** | Cond. (solo project `owner/manager`) | Cond. (solo project `owner/manager`) | Sì |
| **Dipendenze subtask – creare/eliminare** | Cond. (se assegnatario task) | Cond. (se membro progetto) | Sì |
| **Riordinare subtasks (reorder)** | **Sì (solo login)** \* | **Sì (solo login)** \* | **Sì (solo login)** \* |
| **Chat progetto – leggere/scrivere messaggi** | Cond. (membro progetto) | Cond. (membro progetto) | Sì (anche senza membership) |
| **File progetto – lista/caricamento** | Cond. (membro progetto) | Cond. (membro progetto) | Sì (anche senza membership) |
| **File progetto – eliminare** | Cond. (solo uploader) | Cond. (solo uploader) | Sì (tutti) |
| **Notifiche** | Solo proprie | Solo proprie | Solo proprie |
| **Directory utenti (lista utenti)** | Sì | Sì | Sì |
| **Ricerca globale** | Solo contenuti dentro i tuoi progetti (creator/membro) | Idem | Idem |
| **Clockify – visibilità dati** | Solo propri | Reparto (se assegnato) altrimenti solo propri | Tutti |

\* Nota importante: l’endpoint di reorder subtasks attualmente verifica solo che l’utente sia autenticato, **senza controlli di permesso** sul task/progetto.

---

### Dettagli per ruolo (cosa può / non può fare)

### member (ruolo globale)
- **Può (in generale)**:
  - **Creare progetti** (diventando `owner` di quel progetto).
  - **Vedere** progetti dove è creator o membro.
  - **Vedere task** se è assegnatario oppure membro del progetto.
  - **Creare task** solo nei progetti di cui è membro.
  - **Aggiornare task**:
    - se è “semplice membro” (non `owner/manager` del progetto) ma è **assegnatario della task**: può modificare **`title`, `description`, `status`, `priority`, `dueDate`**.
    - se nel progetto è `owner` o `manager`: può gestire task in modo più ampio (come un project manager).
  - **Commentare e caricare allegati** su task/subtask **se è assegnatario** (poi può modificare/eliminare i propri commenti/allegati).
  - **Gestire membri / tag / liste / inviti** **solo se** nel progetto è `owner` o `manager`.
  - **Wiki**: leggere/scrivere **solo** nei progetti di cui è membro.
  - **Assenze**: creare richieste; vedere le proprie; eliminare le proprie.
  - **Clockify**: vedere/creare solo i propri dati.

- **Non può**:
  - Accedere al **pannello Admin** (utenti, audit, impostazioni, archivio assenze admin).
  - **Approvare/rifiutare** assenze (serve manager/admin).
  - Modificare progetti o task dove non è membro/assegnatario (salvo casi “project manager” nel progetto).
  - Gestire checklist subtasks se non è `owner/manager` nel progetto.

### manager (ruolo globale)
- **Può (in generale)**:
  - Tutto ciò che può un `member`, più:
  - **Assenze**:
    - vedere **tutte** le richieste
    - approvare/rifiutare/modificare richieste
  - **Task** (nei progetti di cui è membro):
    - creare
    - modificare (non solo status)
    - assegnare persone (assignees)
    - tag/importo/archiviazione
    - eliminare
  - **Commenti/Allegati** (nei progetti di cui è membro): può anche moderare (edit/delete) oltre ai propri.
  - **Subtask**: può creare/modificare nei progetti di cui è membro, ma:
    - assegnare (assigneeId) e cancellare richiede essere project `owner/manager` (o admin).
  - **Clockify**: visibilità di reparto (se il reparto è impostato e valido), altrimenti solo self.

- **Non può**:
  - Accedere alle funzioni **admin-only** (gestione utenti, audit, settings globali, archivio assenze admin).
  - Gestire membri/tag/liste/inviti **solo perché “global manager”**: serve comunque essere `owner/manager` nel progetto.
  - Gestire checklist subtasks se non è project `owner/manager`.

### admin (ruolo globale)
- **Può**:
  - Tutto ciò che possono fare `member` e `manager`.
  - Accedere e usare tutte le funzioni admin (`/admin/*`): utenti (ruoli/attivi/reparti), audit log, work settings, archivio assenze admin.
  - Accedere “cross-project” su molte aree anche senza membership:
    - **Progetto per ID** (lettura/modifica/cancellazione)
    - **Task per ID** (lettura/modifica/cancellazione)
    - **Wiki** (leggere/scrivere)
    - **Chat** (leggere/scrivere)
    - **File progetto** (lista/upload) e cancellazione di qualsiasi file

- **Limiti / cose non ovvie (implementazione attuale)**:
  - **Liste “di elenco” non sono admin-aware**:
    - la lista progetti (`/api/projects`) mostra solo progetti dove l’admin è creator/membro
    - la lista task (`/api/tasks`) e la ricerca globale (`/api/search`) sono filtrate su membership/assegnazione, non su ruolo admin
    - però l’admin può aprire risorse per ID (es. `/api/projects/[id]`, `/api/tasks/[id]`) anche senza membership
  - **Gestione membri progetto / tag / liste / inviti**: attualmente richiede comunque che l’admin sia **membro del progetto** (poi il check permessi passa perché admin).

---

### Note tecniche / punti di verità (per manutenzione)
- **Ruoli globali**: `nextjs_space/prisma/schema.prisma` (`User.role`)
- **Permessi membri progetto**: `nextjs_space/lib/project-permissions.ts`
- **Accesso task (flags)**: `nextjs_space/lib/task-access.ts`
- **Permessi wiki**: `nextjs_space/lib/wiki-permissions.ts`
- **Assenze**: `nextjs_space/app/api/absences/**` e `nextjs_space/app/api/admin/absences/**`
- **Task**: `nextjs_space/app/api/tasks/**`
- **Progetti**: `nextjs_space/app/api/projects/**`
- **Chat**: `nextjs_space/app/api/messages/route.ts`
- **File**: `nextjs_space/app/api/files/**`
- **Clockify scope**: `nextjs_space/lib/clockify-scope.ts`

