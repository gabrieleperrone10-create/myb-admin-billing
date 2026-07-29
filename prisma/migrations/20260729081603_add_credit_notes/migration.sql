-- CreateEnum
CREATE TYPE "CreditNoteStatus" AS ENUM ('ISSUED', 'SENT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ObjectivePeriod" AS ENUM ('Q1', 'Q2', 'Q3', 'Q4', 'ANNUAL', 'CUSTOM', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10', 'M11', 'M12');

-- CreateEnum
CREATE TYPE "KRType" AS ENUM ('METRIC', 'MILESTONE');

-- CreateEnum
CREATE TYPE "KRDataSource" AS ENUM ('INVOICES_AMOUNT', 'CLIENT_COUNT', 'EXPENSES_AMOUNT', 'CONTRACT_COUNT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AppSection" ADD VALUE 'CREDIT_NOTES';
ALTER TYPE "AppSection" ADD VALUE 'OBJECTIVES';

-- AlterEnum
ALTER TYPE "ContractType" ADD VALUE 'INSTALLMENT';

-- AlterTable
ALTER TABLE "CompanySettings" ADD COLUMN     "bankBalance" DOUBLE PRECISION,
ADD COLUMN     "bankBalanceAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CreditNote" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "CreditNoteStatus" NOT NULL DEFAULT 'ISSUED',
    "invoiceId" TEXT,
    "clientId" TEXT,
    "clientName" TEXT NOT NULL,
    "clientCompany" TEXT,
    "clientEmail" TEXT,
    "clientVatNumber" TEXT,
    "clientFiscalCode" TEXT,
    "clientAddress" TEXT,
    "clientCity" TEXT,
    "clientZip" TEXT,
    "clientProvince" TEXT,
    "clientCountry" TEXT,
    "originalInvoiceNumber" TEXT NOT NULL,
    "originalInvoiceDate" TIMESTAMP(3),
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "reason" TEXT NOT NULL,
    "lineItems" JSONB NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Objective" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "emoji" TEXT NOT NULL DEFAULT '🎯',
    "color" TEXT NOT NULL DEFAULT '#4f7deb',
    "period" "ObjectivePeriod" NOT NULL,
    "year" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Objective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeyResult" (
    "id" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "KRType" NOT NULL DEFAULT 'METRIC',
    "target" DOUBLE PRECISION,
    "current" DOUBLE PRECISION DEFAULT 0,
    "unit" TEXT,
    "dataSource" "KRDataSource",
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeyResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckIn" (
    "id" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditNote_number_key" ON "CreditNote"("number");

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyResult" ADD CONSTRAINT "KeyResult_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "Objective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "Objective"("id") ON DELETE CASCADE ON UPDATE CASCADE;
