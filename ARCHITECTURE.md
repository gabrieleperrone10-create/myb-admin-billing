# Architecture & Codebase Map — MYB Admin Billing

> Documento vivo. Aggiornato ad ogni sessione con nuove funzionalità, bug risolti e pattern identificati.
> Ultimo aggiornamento: 2026-06-08

---

## Stack

| Layer | Tecnologia |
|-------|-----------|
| Framework | Next.js App Router (v15+) — `"use server"` / `"use client"` |
| Database | PostgreSQL via Supabase — schema gestito con Prisma 5 |
| Auth | Clerk v7 — `auth()` in server components, `useUser()` in client |
| Email | Resend — template inline HTML |
| PDF | `@react-pdf/renderer` — generazione lato server |
| AI | Anthropic SDK — agent loop in API routes |
| Deploy | Vercel — cron jobs, Blob storage |
| Styling | Tailwind CSS + CSS vars (`--fg`, `--surface`, `--border`, ecc.) |

---

## Mappa sezioni → file principali

| Sezione | Page | Client Component | Server Actions | API Route |
|---------|------|-----------------|---------------|-----------|
| Dashboard | `dashboard/page.tsx` | `BankBalanceCard.tsx`, `TrendChart.tsx`, `DashboardCharts.tsx` | `actions/settings.ts` | — |
| Fatture | `invoices/page.tsx` | `invoices/[id]/*` | `actions/invoices.ts` | `api/invoices/[id]/pdf` |
| AI Fatture | `invoices/ai/page.tsx` | `InvoiceAIClient.tsx` | — | `api/invoices/ai/route.ts` |
| Clienti | `clients/page.tsx` | — | `actions/clients.ts` | — |
| Contratti | `contracts/page.tsx` | `ContractForm.tsx` | `actions/contracts.ts` | — |
| Spese | `expenses/page.tsx` | — | `actions/expenses.ts` | — |
| Prodotti | `products/page.tsx` | — | `actions/products.ts` | — |
| Pagamenti | `payments/page.tsx` | — | — | — |
| Depositi | `deposits/page.tsx` | — | — | — |
| Obiettivi | `objectives/page.tsx` | `ObjectivesClient.tsx` | `actions/objectives.ts` | — |
| Academy | `academy/page.tsx` | — | `actions/academy.ts` | — |
| SOP | `sop/page.tsx` | — | `actions/sop.ts` | `api/sop/ai/route.ts` |
| Team | `team/page.tsx` | — | `actions/team.ts` | — |
| Eventi | `events/page.tsx` | — | `actions/events.ts` | — |
| Impostazioni | `settings/page.tsx` | — | `actions/settings.ts` | — |
| Ruoli | `settings/roles/page.tsx` | `RoleEditorClient.tsx` | `actions/roles.ts` | — |
| Utenti | `settings/users/page.tsx` | — | `actions/users.ts` | — |
| Knowledge | `knowledge/page.tsx` | — | — | — |
| Automazioni | `automations/page.tsx` | — | `actions/automations.ts` | — |

Tutti i path sono relativi a `src/app/(dashboard)/` per le pagine e `src/app/` per le API.

---

## File di libreria condivisi

| File | Scopo |
|------|-------|
| `src/lib/prisma.ts` | Singleton Prisma Client |
| `src/lib/permissions.ts` | RBAC: `getUserPermissions()`, `canView()`, `canEdit()`, `ALL_SECTIONS` |
| `src/lib/objectives.ts` | Utility pure: `getPeriodDates()`, `krProgress()`, `objectiveProgress()` |
| `src/lib/expenses.ts` | `EXPENSE_CATEGORY_CFG` — label e colori categorie spese |
| `src/lib/utils.ts` | `formatCurrency()`, `formatDate()` |
| `src/lib/pdf/InvoicePDF.tsx` | Template PDF fattura con `@react-pdf/renderer` |

---

## Intersezioni critiche

### 1. Aggiungere una nuova sezione (AppSection)
Toccare **obbligatoriamente** questi 5 file:

1. `prisma/schema.prisma` → aggiungi valore all'enum `AppSection`
2. `src/lib/permissions.ts` → aggiungi a `ALL_SECTIONS`
3. `src/components/layout/Sidebar.tsx` → aggiungi a `SECTION_MAP` e all'array nav
4. `src/components/layout/BottomNav.tsx` → aggiungi a `SECTION_MAP` e `MORE_SECTIONS`
5. `src/app/(dashboard)/settings/roles/[id]/RoleEditorClient.tsx` → aggiungi a `SECTION_LABELS`
6. `src/components/layout/Topbar.tsx` → aggiungi a `SECTIONS` map
7. **SQL Supabase**: `ALTER TYPE "AppSection" ADD VALUE IF NOT EXISTS 'NUOVA_SEZIONE';`

### 2. Aggiungere un valore a un enum Prisma
- Modifica `prisma/schema.prisma`
- Esegui `npx prisma generate` in locale
- Esegui SQL su Supabase: `ALTER TYPE "NomeEnum" ADD VALUE IF NOT EXISTS 'VALORE';`
- Deploy su Vercel (regenera automaticamente il client)

### 3. Aggiungere colonne a una tabella esistente
- Modifica `prisma/schema.prisma`
- Esegui `npx prisma generate` in locale
- Esegui SQL su Supabase: `ALTER TABLE "NomeTabella" ADD COLUMN IF NOT EXISTS "nomeColonna" TIPO;`
- ⚠️ Senza il SQL su Supabase le pagine che fanno SELECT su quella colonna crashano con "server error"

### 4. Cron jobs (fatture ricorrenti)
- File: `src/app/api/cron/generate-invoices/route.ts`
- Logica per tipo contratto:
  - `RECURRING`: nessun limite di rate, importo = `contract.amount` (già il valore per periodo)
  - `INSTALLMENT`: si ferma dopo `contract.installments` rate, importo = `contract.amount / installments`
  - `ONE_SHOT`: massimo 1 fattura, importo = `contract.amount`
- Dipende dall'automazione `RECURRING_INVOICES` essere attiva nel DB

### 5. Dashboard — logica entrate
- **Escluso dai conteggi**: qualsiasi `Payment` con `method = "STRIPE"` (pass-through Multiplicator)
- **Incluso**: `BANK_TRANSFER` e `PAYPAL`
- Questo si applica a: `periodRev`, `prevRev`, grafici 12 mesi, grafici 30 giorni, saldo stimato CC
- File: `src/app/(dashboard)/dashboard/page.tsx`

### 6. Saldo CC
- Salvato in `CompanySettings.bankBalance` + `CompanySettings.bankBalanceAt`
- Il saldo stimato = `bankBalance + pagamenti non-STRIPE da bankBalanceAt - spese da bankBalanceAt`
- Client component con eye toggle: `dashboard/BankBalanceCard.tsx`
- Server action: `actions/settings.ts → updateBankBalance()`

### 7. Server Components vs Client Components
- ❌ **Mai** usare `onSubmit`, `onClick` o altri event handler in Server Components
- ✅ Per confirm dialog usare `src/components/ui/DeleteConfirmButton.tsx` (client component)
- ✅ Per form actions in Server Component: `action={serverAction.bind(null, id)}`

### 8. Server Actions — regole
- File con `"use server"` possono esportare **solo** funzioni `async`
- Le funzioni pure (utility) NON vanno nei file `"use server"` → metterle in `src/lib/`
- `redirect()` da `next/navigation` usato in server actions funziona correttamente
- Chiamare una server action (con `revalidatePath`) da dentro una API Route causa errori — usare logica inline

---

## Schema Prisma — tabelle principali

```
CompanySettings (singleton)
  bankBalance Float?        ← aggiunto 2026-06
  bankBalanceAt DateTime?   ← aggiunto 2026-06

Client
  → Invoice (many)
  → Contract (many)

Contract
  type: RECURRING | ONE_SHOT | INSTALLMENT   ← INSTALLMENT aggiunto 2026-06
  amount: Float     ← per RECURRING = importo per periodo; per INSTALLMENT/ONE_SHOT = totale
  installments: Int?  ← solo per INSTALLMENT
  billingPeriod: MONTHLY | QUARTERLY | ANNUALLY
  billingDay: Int?
  → Invoice (many)
  → Deposit (one?)

Invoice
  status: DRAFT | SENT | PAID | OVERDUE | CANCELLED
  → Payment (one?)

Payment
  method: STRIPE | PAYPAL | BANK_TRANSFER
  ← STRIPE escluso da tutti i conteggi dashboard

Objective
  period: Q1|Q2|Q3|Q4|ANNUAL|CUSTOM|M1-M12
  → KeyResult (many, CASCADE delete)
  → CheckIn (many, CASCADE delete)

KeyResult
  type: METRIC | MILESTONE
  dataSource: INVOICES_AMOUNT | CLIENT_COUNT | EXPENSES_AMOUNT | CONTRACT_COUNT | null

AppRole → AppRolePermission → AppSection (RBAC)
AppUserRole (clerkUserId → roleId)
```

---

## Bug risolti e cause

### Bug 1 — AI invoice agent 500 error
- **Causa**: `sendInvoiceEmail` era una server action con `revalidatePath` chiamata da una API Route
- **Fix**: logica email inline nella API route con try-catch. File: `api/invoices/ai/route.ts`

### Bug 2 — Funzioni sync in file "use server"
- **Causa**: `getPeriodDates`, `krProgress`, `objectiveProgress` esportate da file con `"use server"`
- **Fix**: spostate in `src/lib/objectives.ts` (no directive). Le server actions importano da lì
- **Regola**: file `"use server"` → solo funzioni `async`

### Bug 3 — Cron genera fatture ogni giorno
- **Causa**: contratti `ONE_SHOT` con `installments = null` non avevano mai il check di stop
- **Fix**: `effectiveInstallments = type === "ONE_SHOT" ? (installments ?? 1) : installments`
- **Ulteriore ristrutturazione**: aggiunto tipo `INSTALLMENT` separato con logica propria

### Bug 4 — Pagine crashano con "server error"
- **Causa A**: colonne `bankBalance`/`bankBalanceAt` non esistevano su Supabase. Prisma cercava di selezionarle → crash
- **Fix A**: SQL `ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS ...`
- **Causa B**: `onSubmit` con funzione inline in un Server Component (non permesso in Next.js App Router)
- **Fix B**: `DeleteConfirmButton` client component in `src/components/ui/DeleteConfirmButton.tsx`

### Bug 5 — Obiettivi non visibili nel menu
- **Causa**: `OBJECTIVES` non era in `ALL_SECTIONS` in `permissions.ts`
- **Fix**: aggiunto `"OBJECTIVES"` all'array. Senza questo `fullPerms()` non include la sezione e viene filtrata

### Bug 7 — Piano fatturazione mostra 0/N e cron genera duplicati ogni giorno
- **Causa**: filtro Prisma `notes: { not: "Acconto / deposito" }` → in PostgreSQL `NULL != 'valore'` restituisce NULL (non TRUE) → le fatture rate con `notes = null` venivano escluse dal conteggio sia nella pagina contratto che nel cron → il cron vedeva sempre 0 fatture e generava una nuova ogni giorno
- **Fix**: cambiato il filtro in `{ OR: [{ notes: null }, { notes: { not: "Acconto / deposito" } }] }` in tutti e 3 i posti: `contracts/[id]/page.tsx`, `api/cron/generate-invoices/route.ts`, `actions/contracts.ts`
- **Regola**: mai usare `{ not: "valore" }` su colonne nullable in Prisma — includere sempre il caso null esplicitamente

### Bug 8 — Cron generava una fattura per giorno invece di recuperare tutto l'arretrato
- **Causa**: il cron creava al massimo 1 fattura per contratto per esecuzione → contratti con più mesi arretrati venivano "riparati" una rata per giorno
- **Fix**: sostituito il singolo `if` con un `while(true)` loop che genera tutte le rate scadute in una sola passata

### Bug 6 — Valore fattura errato (€12.000 invece della rata)
- **Causa**: per contratti ONE_SHOT senza `installments`, il cron usava `contract.amount` direttamente (totale)
- **Fix**: calcolo corretto per tipo: INSTALLMENT = `amount / installments`, RECURRING = `amount`, ONE_SHOT = `amount` (1 rata)

---

## Pattern ricorrenti

### Aggiungere un campo a CompanySettings
1. Schema Prisma → campo opzionale (`Float?`, `String?`, ecc.)
2. `npx prisma generate`
3. SQL Supabase: `ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS ...`
4. Server action in `actions/settings.ts`
5. Se usato in pagine esistenti (anche dettaglio fattura), verifica che l'upsert senza `select` non causi crash

### Aggiungere delete a una sezione
1. Server action con guard (es. no delete se status = PAID)
2. `redirect()` dopo delete
3. Bottone nella pagina: usare `DeleteConfirmButton` (client component) — MAI `onSubmit` inline in server component

### Ricerca globale
- API: `src/app/api/search/route.ts` — query parallele su tutte le entità
- UI: `src/components/layout/SearchModal.tsx` — CMD+K, debounced 250ms, keyboard nav
- Attivazione: `Sidebar.tsx` con keydown listener globale
