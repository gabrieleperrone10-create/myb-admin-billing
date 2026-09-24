-- CRM: vincoli che Prisma non sa modellare + backfill dei dati esistenti.
--
-- Come in 20260901200000_composite_fk_hardening, questi vincoli vivono solo in
-- SQL: dopo questa migration non si deve mai lanciare `prisma db push`.
--
-- FK composite (id, companyId): impediscono strutturalmente che un figlio
-- dell'azienda A punti a un padre dell'azienda B. Sui figli con colonna
-- NULLABLE si usa ON DELETE NO ACTION: la FK semplice generata da Prisma
-- (ON DELETE SET NULL) azzera la colonna, e la composita viene verificata a
-- fine statement, quando (NULL, companyId) e' gia' soddisfatta da MATCH SIMPLE.
-- Un SET NULL sulla composita azzererebbe anche companyId (NOT NULL).

-- ─── Unique composite sui padri ────────────────────────────────────────────
ALTER TABLE "Contact"       ADD CONSTRAINT "Contact_id_companyId_key"       UNIQUE ("id", "companyId");
ALTER TABLE "CrmTag"        ADD CONSTRAINT "CrmTag_id_companyId_key"        UNIQUE ("id", "companyId");
ALTER TABLE "Pipeline"      ADD CONSTRAINT "Pipeline_id_companyId_key"      UNIQUE ("id", "companyId");
ALTER TABLE "PipelineStage" ADD CONSTRAINT "PipelineStage_id_companyId_key" UNIQUE ("id", "companyId");
ALTER TABLE "Opportunity"   ADD CONSTRAINT "Opportunity_id_companyId_key"   UNIQUE ("id", "companyId");
ALTER TABLE "Form"          ADD CONSTRAINT "Form_id_companyId_key"          UNIQUE ("id", "companyId");
ALTER TABLE "Calendar"      ADD CONSTRAINT "Calendar_id_companyId_key"      UNIQUE ("id", "companyId");
ALTER TABLE "Appointment"   ADD CONSTRAINT "Appointment_id_companyId_key"   UNIQUE ("id", "companyId");

-- ─── FK composite ──────────────────────────────────────────────────────────
ALTER TABLE "Client" ADD CONSTRAINT "Client_contact_company_fkey"
  FOREIGN KEY ("contactId", "companyId") REFERENCES "Contact"("id", "companyId") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "ContactTag" ADD CONSTRAINT "ContactTag_contact_company_fkey"
  FOREIGN KEY ("contactId", "companyId") REFERENCES "Contact"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactTag" ADD CONSTRAINT "ContactTag_tag_company_fkey"
  FOREIGN KEY ("tagId", "companyId") REFERENCES "CrmTag"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Note" ADD CONSTRAINT "Note_contact_company_fkey"
  FOREIGN KEY ("contactId", "companyId") REFERENCES "Contact"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Note" ADD CONSTRAINT "Note_opportunity_company_fkey"
  FOREIGN KEY ("opportunityId", "companyId") REFERENCES "Opportunity"("id", "companyId") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "Activity" ADD CONSTRAINT "Activity_contact_company_fkey"
  FOREIGN KEY ("contactId", "companyId") REFERENCES "Contact"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_opportunity_company_fkey"
  FOREIGN KEY ("opportunityId", "companyId") REFERENCES "Opportunity"("id", "companyId") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "Message" ADD CONSTRAINT "Message_contact_company_fkey"
  FOREIGN KEY ("contactId", "companyId") REFERENCES "Contact"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PipelineStage" ADD CONSTRAINT "PipelineStage_pipeline_company_fkey"
  FOREIGN KEY ("pipelineId", "companyId") REFERENCES "Pipeline"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_contact_company_fkey"
  FOREIGN KEY ("contactId", "companyId") REFERENCES "Contact"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_pipeline_company_fkey"
  FOREIGN KEY ("pipelineId", "companyId") REFERENCES "Pipeline"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_stage_company_fkey"
  FOREIGN KEY ("stageId", "companyId") REFERENCES "PipelineStage"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_product_company_fkey"
  FOREIGN KEY ("productId", "companyId") REFERENCES "Product"("id", "companyId") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_contract_company_fkey"
  FOREIGN KEY ("contractId", "companyId") REFERENCES "Contract"("id", "companyId") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "OpportunityStageChange" ADD CONSTRAINT "OpportunityStageChange_opportunity_company_fkey"
  FOREIGN KEY ("opportunityId", "companyId") REFERENCES "Opportunity"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OpportunityStageChange" ADD CONSTRAINT "OpportunityStageChange_to_company_fkey"
  FOREIGN KEY ("toStageId", "companyId") REFERENCES "PipelineStage"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OpportunityStageChange" ADD CONSTRAINT "OpportunityStageChange_from_company_fkey"
  FOREIGN KEY ("fromStageId", "companyId") REFERENCES "PipelineStage"("id", "companyId") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_form_company_fkey"
  FOREIGN KEY ("formId", "companyId") REFERENCES "Form"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_contact_company_fkey"
  FOREIGN KEY ("contactId", "companyId") REFERENCES "Contact"("id", "companyId") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "PageView" ADD CONSTRAINT "PageView_contact_company_fkey"
  FOREIGN KEY ("contactId", "companyId") REFERENCES "Contact"("id", "companyId") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "Availability" ADD CONSTRAINT "Availability_calendar_company_fkey"
  FOREIGN KEY ("calendarId", "companyId") REFERENCES "Calendar"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_calendar_company_fkey"
  FOREIGN KEY ("calendarId", "companyId") REFERENCES "Calendar"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_contact_company_fkey"
  FOREIGN KEY ("contactId", "companyId") REFERENCES "Contact"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_opportunity_company_fkey"
  FOREIGN KEY ("opportunityId", "companyId") REFERENCES "Opportunity"("id", "companyId") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_appointment_company_fkey"
  FOREIGN KEY ("appointmentId", "companyId") REFERENCES "Appointment"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Anti doppia prenotazione ──────────────────────────────────────────────
-- Garanzia vera contro le race condition: due richieste concorrenti per lo
-- stesso host e fascia non possono entrambe andare a buon fine. Il controllo
-- applicativo serve solo a restituire un messaggio pulito; qui l'errore e'
-- SQLSTATE 23P01 (exclusion_violation). Le colonne sono timestamp senza fuso
-- (UTC, come tutti i DateTime Prisma) quindi tsrange, non tstzrange.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_no_overlap"
  EXCLUDE USING gist (
    "companyId"  WITH =,
    "hostUserId" WITH =,
    tsrange("startTime", "endTime", '[)') WITH &&
  ) WHERE ("status" IN ('SCHEDULED', 'CONFIRMED'));

ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_time_order" CHECK ("endTime" > "startTime");

-- ─── Backfill: chiave di tracciamento per le aziende esistenti ─────────────
UPDATE "Company" SET "trackingKey" = replace(gen_random_uuid()::text, '-', '') WHERE "trackingKey" IS NULL;

-- ─── Backfill: un Contact (CUSTOMER) per ogni Client esistente ─────────────
-- Solo inserimenti e il collegamento Client.contactId: nessun dato esistente
-- viene modificato o cancellato.
-- Email normalizzata in minuscolo. Se due Client della stessa azienda hanno la
-- stessa email a meno delle maiuscole, nasce un solo Contact, collegato al
-- Client piu' vecchio (Client.contactId e' univoco).
-- Il telefono viene portato solo se, ripulito, e' gia' in formato E.164 o e' un
-- cellulare italiano a 10 cifre (3xx…), ed e' unico nell'azienda: gli altri
-- restano solo sul Client, senza bloccare la migration sull'unique.
WITH src AS (
  SELECT DISTINCT ON (c."companyId", lower(trim(c."email")))
    c."id" AS client_id,
    c."companyId",
    lower(trim(c."email")) AS email,
    c."name",
    c."company",
    c."createdAt",
    CASE
      WHEN regexp_replace(coalesce(c."phone", ''), '[^0-9+]', '', 'g') ~ '^\+[1-9][0-9]{7,14}$'
        THEN regexp_replace(c."phone", '[^0-9+]', '', 'g')
      WHEN regexp_replace(coalesce(c."phone", ''), '[^0-9]', '', 'g') ~ '^3[0-9]{9}$'
        THEN '+39' || regexp_replace(c."phone", '[^0-9]', '', 'g')
      ELSE NULL
    END AS phone
  FROM "Client" c
  WHERE coalesce(trim(c."email"), '') <> ''
  ORDER BY c."companyId", lower(trim(c."email")), c."createdAt", c."id"
),
dedup AS (
  SELECT src.*,
    row_number() OVER (PARTITION BY src."companyId", src.phone ORDER BY src."createdAt", src.client_id) AS phone_rank
  FROM src
)
INSERT INTO "Contact" (
  "id", "firstName", "lastName", "email", "phone", "companyName",
  "lifecycle", "source", "customFields", "replyToken",
  "lastActivityAt", "createdAt", "updatedAt", "companyId"
)
SELECT
  'ct' || replace(gen_random_uuid()::text, '-', ''),
  nullif(split_part(trim(d."name"), ' ', 1), ''),
  nullif(trim(substr(trim(d."name"), length(split_part(trim(d."name"), ' ', 1)) + 1)), ''),
  d.email,
  CASE WHEN d.phone IS NOT NULL AND d.phone_rank = 1 THEN d.phone ELSE NULL END,
  d."company",
  'CUSTOMER',
  'billing',
  '{}'::jsonb,
  replace(gen_random_uuid()::text, '-', ''),
  d."createdAt",
  d."createdAt",
  CURRENT_TIMESTAMP,
  d."companyId"
FROM dedup d;

UPDATE "Client" c
SET "contactId" = ct."id"
FROM "Contact" ct
WHERE ct."companyId" = c."companyId"
  AND ct."email" = lower(trim(c."email"))
  AND c."id" = (
    SELECT c2."id" FROM "Client" c2
    WHERE c2."companyId" = c."companyId" AND lower(trim(c2."email")) = lower(trim(c."email"))
    ORDER BY c2."createdAt", c2."id"
    LIMIT 1
  );

INSERT INTO "Activity" ("id", "contactId", "type", "data", "occurredAt", "companyId")
SELECT 'ac' || replace(gen_random_uuid()::text, '-', ''), c."contactId", 'CLIENT_LINKED',
       jsonb_build_object('clientId', c."id", 'backfill', true), c."createdAt", c."companyId"
FROM "Client" c
WHERE c."contactId" IS NOT NULL;

-- ─── Backfill: permessi delle nuove sezioni sui ruoli esistenti ────────────
-- Ogni ruolo eredita sulle sezioni CRM il livello che ha gia' su CLIENTS:
-- chi gestisce i clienti gestisce anche lead e vendite. Senza questo, nelle
-- aziende con RBAC gia' configurato il CRM risulterebbe invisibile a tutti.
INSERT INTO "AppRolePermission" ("id", "roleId", "section", "level", "companyId")
SELECT 'rp' || replace(gen_random_uuid()::text, '-', ''), p."roleId", s.section::"AppSection", p."level", p."companyId"
FROM "AppRolePermission" p
CROSS JOIN (VALUES ('CONTACTS'), ('PIPELINES'), ('CONVERSATIONS'), ('FORMS'), ('CALENDARS')) AS s(section)
WHERE p."section" = 'CLIENTS'
ON CONFLICT ("roleId", "section") DO NOTHING;
