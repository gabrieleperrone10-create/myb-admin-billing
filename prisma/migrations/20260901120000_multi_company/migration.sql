-- Multi-company: CompanySettings -> Company, companyId ovunque.
-- Scritta a mano: `prisma migrate dev` vedrebbe il rename come DROP+CREATE
-- e cancellerebbe la riga aziendale con i dati fiscali.

-- ── 1. CompanySettings -> Company ─────────────────────────────────────────
ALTER TABLE "CompanySettings" RENAME TO "Company";
ALTER TABLE "Company" RENAME CONSTRAINT "CompanySettings_pkey" TO "Company_pkey";
ALTER TABLE "Company" ALTER COLUMN "id" DROP DEFAULT;

ALTER TABLE "Company" ADD COLUMN "slug" TEXT;
ALTER TABLE "Company" ADD COLUMN "logoUrl" TEXT;
ALTER TABLE "Company" ADD COLUMN "emailFromName" TEXT;
ALTER TABLE "Company" ADD COLUMN "emailFromAddress" TEXT;
ALTER TABLE "Company" ADD COLUMN "emailReplyTo" TEXT;
ALTER TABLE "Company" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Company" ADD COLUMN "invoicePrefix" TEXT NOT NULL DEFAULT 'INV';
ALTER TABLE "Company" ADD COLUMN "creditNotePrefix" TEXT NOT NULL DEFAULT 'NC';
ALTER TABLE "Company" ADD COLUMN "numberPadding" INTEGER NOT NULL DEFAULT 4;
ALTER TABLE "Company" ADD COLUMN "brandColor" TEXT NOT NULL DEFAULT '#4f7deb';
ALTER TABLE "Company" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'it-IT';
ALTER TABLE "Company" ADD COLUMN "defaultCurrency" TEXT NOT NULL DEFAULT 'EUR';
ALTER TABLE "Company" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Europe/Rome';
ALTER TABLE "Company" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- "updatedAt" e' @updatedAt lato Prisma e NON ha default nel DB: va valorizzato a mano.
INSERT INTO "Company" ("id","name","email","slug","updatedAt")
VALUES ('singleton','Market Your Business','','market-your-business', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

UPDATE "Company" SET "slug" = 'market-your-business', "invoicePrefix" = 'MYB' WHERE "slug" IS NULL;
ALTER TABLE "Company" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- ── 2. Tabelle nuove ──────────────────────────────────────────────────────
CREATE TYPE "IntegrationProvider" AS ENUM ('STRIPE', 'PAYPAL', 'RESEND');
CREATE TYPE "DocumentKind" AS ENUM ('INVOICE', 'CREDIT_NOTE');

CREATE TABLE "CompanyMember" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompanyMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CompanyMember_companyId_clerkUserId_key" ON "CompanyMember"("companyId", "clerkUserId");
CREATE INDEX "CompanyMember_clerkUserId_idx" ON "CompanyMember"("clerkUserId");

CREATE TABLE "CompanyIntegration" (
    "companyId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "publicKey" TEXT,
    "secretCipher" BYTEA,
    "secretIv" BYTEA,
    "secretTag" BYTEA,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CompanyIntegration_pkey" PRIMARY KEY ("companyId", "provider")
);

CREATE TABLE "DocumentCounter" (
    "companyId" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "year" INTEGER NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "DocumentCounter_pkey" PRIMARY KEY ("companyId", "kind", "year")
);

-- ── 3. companyId: nullable -> backfill -> NOT NULL -> FK -> indice ────────
-- Tutti i dati esistenti appartengono a Market Your Business.

ALTER TABLE "Client" ADD COLUMN "companyId" TEXT;
UPDATE "Client" SET "companyId" = 'singleton' WHERE "companyId" IS NULL;
ALTER TABLE "Client" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Client" ADD CONSTRAINT "Client_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Client_companyId_idx" ON "Client"("companyId");

ALTER TABLE "Product" ADD COLUMN "companyId" TEXT;
UPDATE "Product" SET "companyId" = 'singleton' WHERE "companyId" IS NULL;
ALTER TABLE "Product" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Product" ADD CONSTRAINT "Product_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Product_companyId_idx" ON "Product"("companyId");

ALTER TABLE "Contract" ADD COLUMN "companyId" TEXT;
UPDATE "Contract" SET "companyId" = 'singleton' WHERE "companyId" IS NULL;
ALTER TABLE "Contract" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Contract_companyId_idx" ON "Contract"("companyId");

ALTER TABLE "Deposit" ADD COLUMN "companyId" TEXT;
UPDATE "Deposit" SET "companyId" = 'singleton' WHERE "companyId" IS NULL;
ALTER TABLE "Deposit" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Deposit_companyId_idx" ON "Deposit"("companyId");

ALTER TABLE "Invoice" ADD COLUMN "companyId" TEXT;
UPDATE "Invoice" SET "companyId" = 'singleton' WHERE "companyId" IS NULL;
ALTER TABLE "Invoice" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Invoice_companyId_idx" ON "Invoice"("companyId");

ALTER TABLE "CreditNote" ADD COLUMN "companyId" TEXT;
UPDATE "CreditNote" SET "companyId" = 'singleton' WHERE "companyId" IS NULL;
ALTER TABLE "CreditNote" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "CreditNote_companyId_idx" ON "CreditNote"("companyId");

ALTER TABLE "Payment" ADD COLUMN "companyId" TEXT;
UPDATE "Payment" SET "companyId" = 'singleton' WHERE "companyId" IS NULL;
ALTER TABLE "Payment" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Payment_companyId_idx" ON "Payment"("companyId");

ALTER TABLE "Expense" ADD COLUMN "companyId" TEXT;
UPDATE "Expense" SET "companyId" = 'singleton' WHERE "companyId" IS NULL;
ALTER TABLE "Expense" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Expense_companyId_idx" ON "Expense"("companyId");

ALTER TABLE "Automation" ADD COLUMN "companyId" TEXT;
UPDATE "Automation" SET "companyId" = 'singleton' WHERE "companyId" IS NULL;
ALTER TABLE "Automation" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Automation" ADD CONSTRAINT "Automation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Automation_companyId_idx" ON "Automation"("companyId");

ALTER TABLE "SopFolder" ADD COLUMN "companyId" TEXT;
UPDATE "SopFolder" SET "companyId" = 'singleton' WHERE "companyId" IS NULL;
ALTER TABLE "SopFolder" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "SopFolder" ADD CONSTRAINT "SopFolder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "SopFolder_companyId_idx" ON "SopFolder"("companyId");

ALTER TABLE "SopTag" ADD COLUMN "companyId" TEXT;
UPDATE "SopTag" SET "companyId" = 'singleton' WHERE "companyId" IS NULL;
ALTER TABLE "SopTag" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "SopTag" ADD CONSTRAINT "SopTag_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "SopTag_companyId_idx" ON "SopTag"("companyId");

ALTER TABLE "SopSopTag" ADD COLUMN "companyId" TEXT;
UPDATE "SopSopTag" SET "companyId" = 'singleton' WHERE "companyId" IS NULL;
ALTER TABLE "SopSopTag" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "SopSopTag" ADD CONSTRAINT "SopSopTag_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "SopSopTag_companyId_idx" ON "SopSopTag"("companyId");

ALTER TABLE "SopAttachment" ADD COLUMN "companyId" TEXT;
UPDATE "SopAttachment" SET "companyId" = 'singleton' WHERE "companyId" IS NULL;
ALTER TABLE "SopAttachment" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "SopAttachment" ADD CONSTRAINT "SopAttachment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "SopAttachment_companyId_idx" ON "SopAttachment"("companyId");

ALTER TABLE "Sop" ADD COLUMN "companyId" TEXT;
UPDATE "Sop" SET "companyId" = 'singleton' WHERE "companyId" IS NULL;
ALTER TABLE "Sop" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Sop" ADD CONSTRAINT "Sop_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Sop_companyId_idx" ON "Sop"("companyId");

ALTER TABLE "Tag" ADD COLUMN "companyId" TEXT;
UPDATE "Tag" SET "companyId" = 'singleton' WHERE "companyId" IS NULL;
ALTER TABLE "Tag" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Tag_companyId_idx" ON "Tag"("companyId");

ALTER TABLE "TeamMember" ADD COLUMN "companyId" TEXT;
UPDATE "TeamMember" SET "companyId" = 'singleton' WHERE "companyId" IS NULL;
ALTER TABLE "TeamMember" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "TeamMember_companyId_idx" ON "TeamMember"("companyId");

ALTER TABLE "TeamMemberTag" ADD COLUMN "companyId" TEXT;
UPDATE "TeamMemberTag" SET "companyId" = 'singleton' WHERE "companyId" IS NULL;
ALTER TABLE "TeamMemberTag" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "TeamMemberTag" ADD CONSTRAINT "TeamMemberTag_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "TeamMemberTag_companyId_idx" ON "TeamMemberTag"("companyId");

ALTER TABLE "CourseCategory" ADD COLUMN "companyId" TEXT;
UPDATE "CourseCategory" SET "companyId" = 'singleton' WHERE "companyId" IS NULL;
ALTER TABLE "CourseCategory" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "CourseCategory" ADD CONSTRAINT "CourseCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "CourseCategory_companyId_idx" ON "CourseCategory"("companyId");

ALTER TABLE "CourseCategoryTag" ADD COLUMN "companyId" TEXT;
UPDATE "CourseCategoryTag" SET "companyId" = 'singleton' WHERE "companyId" IS NULL;
ALTER TABLE "CourseCategoryTag" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "CourseCategoryTag" ADD CONSTRAINT "CourseCategoryTag_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "CourseCategoryTag_companyId_idx" ON "CourseCategoryTag"("companyId");

ALTER TABLE "Course" ADD COLUMN "companyId" TEXT;
UPDATE "Course" SET "companyId" = 'singleton' WHERE "companyId" IS NULL;
ALTER TABLE "Course" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Course" ADD CONSTRAINT "Course_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Course_companyId_idx" ON "Course"("companyId");

ALTER TABLE "Module" ADD COLUMN "companyId" TEXT;
UPDATE "Module" SET "companyId" = 'singleton' WHERE "companyId" IS NULL;
ALTER TABLE "Module" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Module" ADD CONSTRAINT "Module_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Module_companyId_idx" ON "Module"("companyId");

ALTER TABLE "Lesson" ADD COLUMN "companyId" TEXT;
UPDATE "Lesson" SET "companyId" = 'singleton' WHERE "companyId" IS NULL;
ALTER TABLE "Lesson" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Lesson_companyId_idx" ON "Lesson"("companyId");

ALTER TABLE "LessonAttachment" ADD COLUMN "companyId" TEXT;
UPDATE "LessonAttachment" SET "companyId" = 'singleton' WHERE "companyId" IS NULL;
ALTER TABLE "LessonAttachment" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "LessonAttachment" ADD CONSTRAINT "LessonAttachment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "LessonAttachment_companyId_idx" ON "LessonAttachment"("companyId");

ALTER TABLE "LessonProgress" ADD COLUMN "companyId" TEXT;
UPDATE "LessonProgress" SET "companyId" = 'singleton' WHERE "companyId" IS NULL;
ALTER TABLE "LessonProgress" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "LessonProgress_companyId_idx" ON "LessonProgress"("companyId");

ALTER TABLE "Event" ADD COLUMN "companyId" TEXT;
UPDATE "Event" SET "companyId" = 'singleton' WHERE "companyId" IS NULL;
ALTER TABLE "Event" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Event" ADD CONSTRAINT "Event_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Event_companyId_idx" ON "Event"("companyId");

ALTER TABLE "EventRsvp" ADD COLUMN "companyId" TEXT;
UPDATE "EventRsvp" SET "companyId" = 'singleton' WHERE "companyId" IS NULL;
ALTER TABLE "EventRsvp" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "EventRsvp" ADD CONSTRAINT "EventRsvp_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "EventRsvp_companyId_idx" ON "EventRsvp"("companyId");

ALTER TABLE "Objective" ADD COLUMN "companyId" TEXT;
UPDATE "Objective" SET "companyId" = 'singleton' WHERE "companyId" IS NULL;
ALTER TABLE "Objective" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Objective" ADD CONSTRAINT "Objective_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Objective_companyId_idx" ON "Objective"("companyId");

ALTER TABLE "KeyResult" ADD COLUMN "companyId" TEXT;
UPDATE "KeyResult" SET "companyId" = 'singleton' WHERE "companyId" IS NULL;
ALTER TABLE "KeyResult" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "KeyResult" ADD CONSTRAINT "KeyResult_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "KeyResult_companyId_idx" ON "KeyResult"("companyId");

ALTER TABLE "CheckIn" ADD COLUMN "companyId" TEXT;
UPDATE "CheckIn" SET "companyId" = 'singleton' WHERE "companyId" IS NULL;
ALTER TABLE "CheckIn" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "CheckIn_companyId_idx" ON "CheckIn"("companyId");

ALTER TABLE "AppRole" ADD COLUMN "companyId" TEXT;
UPDATE "AppRole" SET "companyId" = 'singleton' WHERE "companyId" IS NULL;
ALTER TABLE "AppRole" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "AppRole" ADD CONSTRAINT "AppRole_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "AppRole_companyId_idx" ON "AppRole"("companyId");

ALTER TABLE "AppRolePermission" ADD COLUMN "companyId" TEXT;
UPDATE "AppRolePermission" SET "companyId" = 'singleton' WHERE "companyId" IS NULL;
ALTER TABLE "AppRolePermission" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "AppRolePermission" ADD CONSTRAINT "AppRolePermission_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "AppRolePermission_companyId_idx" ON "AppRolePermission"("companyId");

ALTER TABLE "AppUserRole" ADD COLUMN "companyId" TEXT;
UPDATE "AppUserRole" SET "companyId" = 'singleton' WHERE "companyId" IS NULL;
ALTER TABLE "AppUserRole" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "AppUserRole" ADD CONSTRAINT "AppUserRole_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "AppUserRole_companyId_idx" ON "AppUserRole"("companyId");

-- ── 4. FK verso Company per le tabelle nuove ──────────────────────────────
ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyIntegration" ADD CONSTRAINT "CompanyIntegration_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentCounter" ADD CONSTRAINT "DocumentCounter_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 5. Unique globali -> per azienda (nuovo PRIMA di droppare il vecchio) ──
CREATE UNIQUE INDEX "Client_companyId_email_key" ON "Client"("companyId", "email");
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Client_email_key') THEN
    EXECUTE 'ALTER TABLE "Client" DROP CONSTRAINT "Client_email_key"';
  ELSE
    EXECUTE 'DROP INDEX IF EXISTS "Client_email_key"';
  END IF;
END $$;
CREATE UNIQUE INDEX "Invoice_companyId_number_key" ON "Invoice"("companyId", "number");
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Invoice_number_key') THEN
    EXECUTE 'ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_number_key"';
  ELSE
    EXECUTE 'DROP INDEX IF EXISTS "Invoice_number_key"';
  END IF;
END $$;
CREATE UNIQUE INDEX "CreditNote_companyId_number_key" ON "CreditNote"("companyId", "number");
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CreditNote_number_key') THEN
    EXECUTE 'ALTER TABLE "CreditNote" DROP CONSTRAINT "CreditNote_number_key"';
  ELSE
    EXECUTE 'DROP INDEX IF EXISTS "CreditNote_number_key"';
  END IF;
END $$;
CREATE UNIQUE INDEX "Automation_companyId_type_key" ON "Automation"("companyId", "type");
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Automation_type_key') THEN
    EXECUTE 'ALTER TABLE "Automation" DROP CONSTRAINT "Automation_type_key"';
  ELSE
    EXECUTE 'DROP INDEX IF EXISTS "Automation_type_key"';
  END IF;
END $$;
CREATE UNIQUE INDEX "SopTag_companyId_name_key" ON "SopTag"("companyId", "name");
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SopTag_name_key') THEN
    EXECUTE 'ALTER TABLE "SopTag" DROP CONSTRAINT "SopTag_name_key"';
  ELSE
    EXECUTE 'DROP INDEX IF EXISTS "SopTag_name_key"';
  END IF;
END $$;
CREATE UNIQUE INDEX "Tag_companyId_name_key" ON "Tag"("companyId", "name");
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Tag_name_key') THEN
    EXECUTE 'ALTER TABLE "Tag" DROP CONSTRAINT "Tag_name_key"';
  ELSE
    EXECUTE 'DROP INDEX IF EXISTS "Tag_name_key"';
  END IF;
END $$;
CREATE UNIQUE INDEX "TeamMember_companyId_email_key" ON "TeamMember"("companyId", "email");
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeamMember_email_key') THEN
    EXECUTE 'ALTER TABLE "TeamMember" DROP CONSTRAINT "TeamMember_email_key"';
  ELSE
    EXECUTE 'DROP INDEX IF EXISTS "TeamMember_email_key"';
  END IF;
END $$;
CREATE UNIQUE INDEX "AppRole_companyId_name_key" ON "AppRole"("companyId", "name");
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AppRole_name_key') THEN
    EXECUTE 'ALTER TABLE "AppRole" DROP CONSTRAINT "AppRole_name_key"';
  ELSE
    EXECUTE 'DROP INDEX IF EXISTS "AppRole_name_key"';
  END IF;
END $$;
CREATE UNIQUE INDEX "AppUserRole_companyId_clerkUserId_roleId_key" ON "AppUserRole"("companyId", "clerkUserId", "roleId");
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AppUserRole_clerkUserId_roleId_key') THEN
    EXECUTE 'ALTER TABLE "AppUserRole" DROP CONSTRAINT "AppUserRole_clerkUserId_roleId_key"';
  ELSE
    EXECUTE 'DROP INDEX IF EXISTS "AppUserRole_clerkUserId_roleId_key"';
  END IF;
END $$;

-- ── 6. Indici sui filtri realmente usati dal codice ───────────────────────
-- Lo schema non ne aveva NESSUNO prima di adesso.
CREATE INDEX "Invoice_companyId_status_dueDate_idx" ON "Invoice"("companyId", "status", "dueDate");
CREATE INDEX "Invoice_companyId_issueDate_idx" ON "Invoice"("companyId", "issueDate");
CREATE INDEX "Invoice_companyId_contractId_idx" ON "Invoice"("companyId", "contractId");
CREATE INDEX "Invoice_clientId_idx" ON "Invoice"("clientId");
CREATE INDEX "Payment_companyId_paidAt_idx" ON "Payment"("companyId", "paidAt");
CREATE INDEX "Payment_companyId_method_paidAt_idx" ON "Payment"("companyId", "method", "paidAt");
CREATE INDEX "Expense_companyId_date_idx" ON "Expense"("companyId", "date");
CREATE INDEX "Expense_companyId_category_date_idx" ON "Expense"("companyId", "category", "date");
CREATE INDEX "Contract_companyId_active_type_idx" ON "Contract"("companyId", "active", "type");
CREATE INDEX "Contract_companyId_endDate_idx" ON "Contract"("companyId", "endDate");
CREATE INDEX "Contract_companyId_startDate_idx" ON "Contract"("companyId", "startDate");
CREATE INDEX "Contract_clientId_idx" ON "Contract"("clientId");
CREATE INDEX "Contract_productId_idx" ON "Contract"("productId");
CREATE INDEX "Client_companyId_createdAt_idx" ON "Client"("companyId", "createdAt");
CREATE INDEX "Product_companyId_active_idx" ON "Product"("companyId", "active");
CREATE INDEX "Deposit_companyId_status_idx" ON "Deposit"("companyId", "status");
CREATE INDEX "CreditNote_companyId_issueDate_idx" ON "CreditNote"("companyId", "issueDate");
CREATE INDEX "CreditNote_invoiceId_idx" ON "CreditNote"("invoiceId");
CREATE INDEX "CreditNote_clientId_idx" ON "CreditNote"("clientId");
CREATE INDEX "AppUserRole_companyId_clerkUserId_idx" ON "AppUserRole"("companyId", "clerkUserId");
CREATE INDEX "Sop_companyId_folderId_idx" ON "Sop"("companyId", "folderId");
CREATE INDEX "Course_categoryId_idx" ON "Course"("categoryId");
CREATE INDEX "Module_courseId_idx" ON "Module"("courseId");
CREATE INDEX "Lesson_moduleId_idx" ON "Lesson"("moduleId");
CREATE INDEX "Event_companyId_date_idx" ON "Event"("companyId", "date");
CREATE INDEX "Objective_companyId_year_period_idx" ON "Objective"("companyId", "year", "period");
CREATE INDEX "KeyResult_objectiveId_idx" ON "KeyResult"("objectiveId");
CREATE INDEX "CheckIn_objectiveId_idx" ON "CheckIn"("objectiveId");
