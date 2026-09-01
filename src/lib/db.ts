import "server-only";
import { PrismaClient, Prisma } from "@prisma/client";

/**
 * Accesso al database con isolamento per azienda.
 *
 * La difesa è doppia, e le due metà coprono buchi diversi:
 *
 *  1. SCRITTURE → le impone il compilatore. `companyId` è NOT NULL nello schema,
 *     quindi ogni `create` deve passarlo esplicitamente. Le estensioni Prisma non
 *     modificano i tipi di input, quindi qui il type checker è il controllo vero:
 *     un punto dimenticato non compila.
 *
 *  2. LETTURE / UPDATE / DELETE → le impone l'estensione qui sotto, che inietta
 *     `companyId` nel `where`. Sui tipi di lettura il compilatore non può aiutare
 *     (`where` è sempre opzionale), quindi serve il presidio a runtime.
 *
 * Cosa NON è coperto, e va fatto a mano:
 *  - le nested write (`create: { tags: { create: [...] } }`): Prisma risolve i
 *    callback solo per l'operazione top-level, i figli sono solo `args` del padre;
 *  - `$queryRaw`: le operazioni raw non passano da `$allModels`.
 *  In entrambi i casi il backstop finale è il NOT NULL sulla colonna: un punto
 *  dimenticato esplode all'insert invece di scrivere una riga senza azienda.
 */

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

/**
 * Client NON filtrato. Da usare solo qui dentro, nei cron che iterano le aziende
 * e nel provisioning (che deve creare la Company prima che esista un client scoped).
 */
export const basePrisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = basePrisma;

/** Modelli che appartengono a un'azienda. Tutto il resto è globale. */
const TENANT_MODELS = new Set([
  "Client", "Product", "Contract", "Deposit", "Invoice", "CreditNote", "Payment",
  "Expense", "Automation", "SopFolder", "SopTag", "SopSopTag", "SopAttachment",
  "Sop", "Tag", "TeamMember", "TeamMemberTag", "CourseCategory", "CourseCategoryTag",
  "Course", "Module", "Lesson", "LessonAttachment", "LessonProgress", "Event",
  "EventRsvp", "Objective", "KeyResult", "CheckIn", "AppRole", "AppRolePermission",
  "AppUserRole",
]);

/** Operazioni il cui `where` va filtrato per azienda. */
const SCOPED_WHERE = new Set([
  "findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany",
  "count", "aggregate", "groupBy", "update", "updateMany", "delete", "deleteMany",
]);

type AnyArgs = Record<string, unknown>;

function withCompany(where: unknown, companyId: string): AnyArgs {
  return { ...(where as AnyArgs ?? {}), companyId };
}

/**
 * Client filtrato su una singola azienda.
 *
 * `$extends` restituisce un proxy sullo stesso client base: non apre nuove
 * connessioni, quindi costruirlo per richiesta è gratuito. Va costruito per
 * richiesta e non messo in cache per azienda, così un companyId stantio non può
 * sopravvivere fra una richiesta e l'altra.
 */
export function companyDb(companyId: string) {
  return basePrisma
    .$extends({
      client: { $companyId: companyId },
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            if (!model || !TENANT_MODELS.has(model)) return query(args);

            const a = args as AnyArgs;

            if (SCOPED_WHERE.has(operation)) {
              // extendedWhereUnique è GA in Prisma 5: un campo non-unique nel where
              // di findUnique/update/delete è ammesso, quindi non serve riscriverli
              // in findFirst. Prisma emette `WHERE id = ? AND "companyId" = ?`.
              return query({ ...a, where: withCompany(a.where, companyId) } as typeof args);
            }

            if (operation === "create") {
              const data = (a.data ?? {}) as AnyArgs;
              assertSameCompany(model, data.companyId, companyId);
              return query({ ...a, data: { ...data, companyId } } as typeof args);
            }

            if (operation === "createMany" || operation === "createManyAndReturn") {
              const rows = a.data;
              const stamp = (r: unknown) => {
                assertSameCompany(model, (r as AnyArgs).companyId, companyId);
                return { ...(r as AnyArgs), companyId };
              };
              return query({ ...a, data: Array.isArray(rows) ? rows.map(stamp) : stamp(rows) } as typeof args);
            }

            if (operation === "upsert") {
              // Deliberatamente NON si tocca `where`: deve essere una unique composta
              // che contiene già companyId. Si stampa solo il ramo `create`.
              const create = (a.create ?? {}) as AnyArgs;
              assertSameCompany(model, create.companyId, companyId);
              return query({ ...a, create: { ...create, companyId } } as typeof args);
            }

            throw new Error(
              `[db] operazione non gestita "${operation}" sul modello "${model}". ` +
              `Aggiungerla a src/lib/db.ts prima di usarla: senza una regola esplicita ` +
              `non c'e' garanzia di isolamento fra aziende.`,
            );
          },
        },
      },
    });
}

function assertSameCompany(model: string, provided: unknown, companyId: string) {
  if (provided !== undefined && provided !== companyId) {
    throw new Error(
      `[db] tentata scrittura su ${model} con companyId="${String(provided)}" ` +
      `da un client filtrato su "${companyId}".`,
    );
  }
}

export type CompanyDb = ReturnType<typeof companyDb>;
export type { Prisma };
