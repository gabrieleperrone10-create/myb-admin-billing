# Conversione multi-azienda — guida operativa

Stato: fasi 0–2 fatte e committate. Fase 3 (routing `[company]`) in corso.
Il piano completo sta in `~/.claude/plans/dobbiamo-implementare-la-possibilit-replicated-torvalds.md`.

## Il modello in una riga

Un solo database, un solo schema, colonna `companyId` su ogni tabella di dominio.
L'azienda attiva e' il **primo segmento dell'URL**: `/market-your-business/invoices/abc`.

## I due presidi (leggere prima di toccare qualsiasi query)

Le estensioni Prisma **non modificano i tipi di input**, e da questo discende tutto:

| | chi lo impone | come |
|---|---|---|
| **scritture** (`create`, `createMany`) | il **compilatore** | `companyId` e' NOT NULL → va passato a mano. Un punto dimenticato non compila |
| **letture, update, delete** | l'**estensione** in `src/lib/db.ts` | inietta `companyId` nel `where` a runtime |

**Non coperti**, da fare a mano ogni volta:
- **nested write** (`create: { tags: { create: [...] } }`) — Prisma risolve i callback solo per l'operazione top-level;
- **`$queryRaw`** — le operazioni raw non passano da `$allModels`.

In entrambi i casi il backstop e' il `NOT NULL` sulla colonna: un punto dimenticato
esplode all'insert invece di scrivere in silenzio una riga senza azienda.

## Come si converte una server action

File di riferimento gia' convertiti: `src/app/actions/clients.ts` (semplice),
`src/app/actions/invoices.ts` (numerazione + transazione).

```ts
"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { companyAction } from "@/lib/companyAction";

export const createThing = companyAction(async (ctx, formData: FormData) => {
  await ctx.db.thing.create({ data: { companyId: ctx.companyId, ... } });
  revalidatePath(`/${ctx.slug}/things`);
  redirect(`/${ctx.slug}/things`);
});
```

`ctx` contiene `{ company, companyId, slug, userId, db }`, con la membership gia'
verificata contro Clerk.

Lato chiamante: `<form action={createThing.bind(null, slug)}>`.

### Regole non negoziabili

1. **Lo slug e' input non fidato.** Arriva dal client. `companyAction` lo rigira a
   `requireCompany()`, che ricontrolla la membership a ogni invocazione. Le server
   action sono endpoint POST autonomi: la guardia del layout non le copre.
2. **Mai un cookie come portatore dell'azienda.** Con due schede aperte su aziende
   diverse contiene quella caricata per ultima, e una modifica fatta nella scheda A
   finisce nell'azienda B — con il controllo di membership che *passa*, perche'
   l'utente appartiene a entrambe. Non e' un problema di sicurezza risolvibile: e'
   un bug di correttezza intrinseco al cookie.
3. **Mai `try/catch` attorno a `redirect()` / `notFound()`.** Funzionano lanciando
   un segnale di controllo che deve propagare.
4. **`revalidatePath` con lo slug reale**, non col pattern `/[company]/...`: un path
   letterale non richiede il secondo argomento `type`.
5. **Prima di scrivere su un figlio, verificare il padre.** Vedi `markInvoicePaid`:
   senza il `findUnique` sulla fattura, un id di un'altra azienda creerebbe comunque
   il `Payment`, che non ha modo di accorgersene.

## Pagine

```tsx
export default async function Page({ params }: { params: Promise<{ company: string; id: string }> }) {
  const { company: slug, id } = await params;   // params e' una Promise in Next 16
  const { db } = await requireCompany(slug);
  ...
}
```

`requireCompany` e' memoizzata con `cache()`: chiamarla in layout, pagina e
componenti annidati costa una query sola.

## Link

- Server component: `const h = withCompany(slug)` da `@/lib/paths` → `h("/invoices")`
- Client component: `const h = useCompanyHref()` da `@/lib/useCompany`
- Le mappe di navigazione restano con path **relativi**; il prefisso si applica al render.

## Verifica

```bash
npx tsc --noEmit        # il gate principale: enumera ogni punto non convertito
npm run test:isolation  # prova su dati reali che le aziende non si vedano
npm run db:deploy       # applica le migration (NON e' piu' dentro build)
```
