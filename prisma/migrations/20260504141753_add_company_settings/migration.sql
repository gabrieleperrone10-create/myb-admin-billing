-- CreateTable
CREATE TABLE "CompanySettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "name" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT,
    "website" TEXT,
    "address" TEXT,
    "city" TEXT,
    "zip" TEXT,
    "province" TEXT,
    "country" TEXT,
    "vatNumber" TEXT,
    "fiscalCode" TEXT,
    "bankName" TEXT,
    "iban" TEXT,
    "bic" TEXT,
    "invoiceFooter" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);
