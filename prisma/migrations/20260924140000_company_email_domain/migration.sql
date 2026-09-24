-- Dominio email per azienda (invio + ricezione risposte CRM), gestito via API Resend.
-- Solo colonne nullable nuove: nessun dato esistente cambia.
ALTER TABLE "Company" ADD COLUMN     "emailDomain" TEXT,
ADD COLUMN     "emailDomainMeta" JSONB,
ADD COLUMN     "emailDomainStatus" TEXT,
ADD COLUMN     "inboundDomain" TEXT,
ADD COLUMN     "inboundDomainStatus" TEXT;

CREATE UNIQUE INDEX "Company_emailDomain_key" ON "Company"("emailDomain");
CREATE UNIQUE INDEX "Company_inboundDomain_key" ON "Company"("inboundDomain");
