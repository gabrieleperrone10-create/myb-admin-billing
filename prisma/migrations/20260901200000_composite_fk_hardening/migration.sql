-- Foreign key composite sul nucleo finanziario.
--
-- La denormalizzazione di companyId toglie una garanzia implicita: niente
-- impedirebbe a un Payment dell'azienda A di puntare a una Invoice
-- dell'azienda B (la FK semplice su invoiceId controlla solo che la riga
-- esista, non che appartenga alla stessa azienda del Payment). L'estensione
-- Prisma e requireCompany() lo impediscono lato applicativo; qui lo si rende
-- strutturalmente impossibile anche scrivendo a mano sul database.
--
-- Prisma non sa modellare due relazioni che condividono lo scalare companyId
-- sullo stesso modello (es. Payment ha sia invoiceId+companyId sia
-- depositId+companyId): questi vincoli vivono solo in SQL, non nello schema
-- Prisma — dopo questa migration non si deve mai lanciare `prisma db push`
-- contro il database, userebbe schema.prisma come verita' assoluta e li
-- droppeguerebbe.
--
-- Il MATCH SIMPLE di default di Postgres considera soddisfatta una FK
-- composita quando una qualsiasi colonna e' NULL: i padri opzionali (es.
-- Payment.depositId, Invoice.contractId) continuano a funzionare invariati.

-- Chiave unica composita sui "genitori", prerequisito per referenziarli in blocco.
ALTER TABLE "Client"   ADD CONSTRAINT "Client_id_companyId_key"   UNIQUE ("id", "companyId");
ALTER TABLE "Product"  ADD CONSTRAINT "Product_id_companyId_key"  UNIQUE ("id", "companyId");
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_id_companyId_key" UNIQUE ("id", "companyId");
ALTER TABLE "Invoice"  ADD CONSTRAINT "Invoice_id_companyId_key"  UNIQUE ("id", "companyId");
ALTER TABLE "Deposit"  ADD CONSTRAINT "Deposit_id_companyId_key"  UNIQUE ("id", "companyId");

-- Contract -> Client / Product
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_client_company_fkey"
  FOREIGN KEY ("clientId", "companyId") REFERENCES "Client"("id", "companyId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_product_company_fkey"
  FOREIGN KEY ("productId", "companyId") REFERENCES "Product"("id", "companyId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Deposit -> Contract
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_contract_company_fkey"
  FOREIGN KEY ("contractId", "companyId") REFERENCES "Contract"("id", "companyId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Invoice -> Client / Contract (contractId nullable)
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_client_company_fkey"
  FOREIGN KEY ("clientId", "companyId") REFERENCES "Client"("id", "companyId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_contract_company_fkey"
  FOREIGN KEY ("contractId", "companyId") REFERENCES "Contract"("id", "companyId")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Payment -> Invoice / Deposit (entrambi nullable: un Payment ne ha uno solo)
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoice_company_fkey"
  FOREIGN KEY ("invoiceId", "companyId") REFERENCES "Invoice"("id", "companyId")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_deposit_company_fkey"
  FOREIGN KEY ("depositId", "companyId") REFERENCES "Deposit"("id", "companyId")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreditNote -> Invoice / Client (entrambi nullable: una nota manuale puo' non averne nessuno)
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_invoice_company_fkey"
  FOREIGN KEY ("invoiceId", "companyId") REFERENCES "Invoice"("id", "companyId")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_client_company_fkey"
  FOREIGN KEY ("clientId", "companyId") REFERENCES "Client"("id", "companyId")
  ON DELETE SET NULL ON UPDATE CASCADE;
