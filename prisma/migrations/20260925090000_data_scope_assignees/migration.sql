-- Visibilita' dei dati per ruolo ("Tutti" / "Solo assegnati") e assegnatari
-- multipli dei contatti. Solo aggiunte: i permessi esistenti restano ALL
-- (nessun cambiamento di comportamento finche' non si configura un ruolo).

CREATE TYPE "DataScope" AS ENUM ('ALL', 'OWN');

ALTER TABLE "AppRolePermission" ADD COLUMN     "scope" "DataScope" NOT NULL DEFAULT 'ALL';

CREATE TABLE "ContactAssignee" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "ContactAssignee_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContactAssignee_companyId_userId_idx" ON "ContactAssignee"("companyId", "userId");
CREATE UNIQUE INDEX "ContactAssignee_contactId_userId_key" ON "ContactAssignee"("contactId", "userId");

ALTER TABLE "ContactAssignee" ADD CONSTRAINT "ContactAssignee_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactAssignee" ADD CONSTRAINT "ContactAssignee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FK composita multi-azienda, come per gli altri figli di Contact.
ALTER TABLE "ContactAssignee" ADD CONSTRAINT "ContactAssignee_contact_company_fkey"
  FOREIGN KEY ("contactId", "companyId") REFERENCES "Contact"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;
