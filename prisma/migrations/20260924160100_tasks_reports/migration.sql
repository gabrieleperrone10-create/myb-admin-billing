-- Task/follow-up e spesa pubblicitaria (report ROAS).

CREATE TYPE "TaskType" AS ENUM ('TODO', 'CALL', 'EMAIL', 'WHATSAPP', 'MEETING');
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'DONE');

CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "TaskType" NOT NULL DEFAULT 'TODO',
    "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "dueAt" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "assigneeUserId" TEXT,
    "createdByUserId" TEXT,
    "contactId" TEXT,
    "opportunityId" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdSpend" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "campaign" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "AdSpend_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Task_companyId_status_dueAt_idx" ON "Task"("companyId", "status", "dueAt");
CREATE INDEX "Task_companyId_assigneeUserId_status_dueAt_idx" ON "Task"("companyId", "assigneeUserId", "status", "dueAt");
CREATE INDEX "Task_contactId_status_idx" ON "Task"("contactId", "status");
CREATE INDEX "Task_opportunityId_idx" ON "Task"("opportunityId");
CREATE INDEX "AdSpend_companyId_periodStart_idx" ON "AdSpend"("companyId", "periodStart");
CREATE INDEX "AdSpend_companyId_source_campaign_idx" ON "AdSpend"("companyId", "source", "campaign");

ALTER TABLE "Task" ADD CONSTRAINT "Task_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdSpend" ADD CONSTRAINT "AdSpend_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FK composite multi-azienda (vedi 20260924100200_crm_constraints_backfill):
-- sui figli nullable NO ACTION, la FK semplice azzera la colonna.
ALTER TABLE "Task" ADD CONSTRAINT "Task_contact_company_fkey"
  FOREIGN KEY ("contactId", "companyId") REFERENCES "Contact"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_opportunity_company_fkey"
  FOREIGN KEY ("opportunityId", "companyId") REFERENCES "Opportunity"("id", "companyId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- Permessi delle nuove sezioni sui ruoli esistenti: stesso livello di CLIENTS
-- (solo inserimenti, nessuna modifica ai permessi gia' presenti).
INSERT INTO "AppRolePermission" ("id", "roleId", "section", "level", "companyId")
SELECT 'rp' || replace(gen_random_uuid()::text, '-', ''), p."roleId", s.section::"AppSection", p."level", p."companyId"
FROM "AppRolePermission" p
CROSS JOIN (VALUES ('TASKS'), ('REPORTS')) AS s(section)
WHERE p."section" = 'CLIENTS'
ON CONFLICT ("roleId", "section") DO NOTHING;
