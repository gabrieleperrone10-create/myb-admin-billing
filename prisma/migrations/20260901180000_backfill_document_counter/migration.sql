-- Backfill di DocumentCounter dai numeri gia' emessi, per azienda/anno.
--
-- Solo i numeri nel formato PREFIX-YYYY-NNNN (dove PREFIX e' il prefisso
-- configurato sull'azienda) contribuiscono al contatore: i formati storici
-- (es. "MYB-309", "MYB-IMPORT-2024-JOBI") non lo rispettano e restano come
-- sono, invariati — la numerazione futura riparte dal massimo dei numeri
-- gia' conformi, non tocca quelli storici.
--
-- Idempotente: ON CONFLICT con GREATEST non abbassa mai un contatore gia'
-- avanzato da scritture avvenute nel frattempo.

WITH matched_invoices AS (
  SELECT
    c.id AS company_id,
    (regexp_match(i.number, '^' || c."invoicePrefix" || '-([0-9]{4})-([0-9]+)$'))[1]::int AS yr,
    (regexp_match(i.number, '^' || c."invoicePrefix" || '-([0-9]{4})-([0-9]+)$'))[2]::int AS seq
  FROM "Invoice" i
  JOIN "Company" c ON c.id = i."companyId"
  WHERE i.number ~ ('^' || c."invoicePrefix" || '-[0-9]{4}-[0-9]+$')
)
INSERT INTO "DocumentCounter" ("companyId", "kind", "year", "lastValue")
SELECT company_id, 'INVOICE'::"DocumentKind", yr, MAX(seq)
FROM matched_invoices
GROUP BY company_id, yr
ON CONFLICT ("companyId", "kind", "year")
DO UPDATE SET "lastValue" = GREATEST("DocumentCounter"."lastValue", EXCLUDED."lastValue");

WITH matched_credit_notes AS (
  SELECT
    c.id AS company_id,
    (regexp_match(cn.number, '^' || c."creditNotePrefix" || '-([0-9]{4})-([0-9]+)$'))[1]::int AS yr,
    (regexp_match(cn.number, '^' || c."creditNotePrefix" || '-([0-9]{4})-([0-9]+)$'))[2]::int AS seq
  FROM "CreditNote" cn
  JOIN "Company" c ON c.id = cn."companyId"
  WHERE cn.number ~ ('^' || c."creditNotePrefix" || '-[0-9]{4}-[0-9]+$')
)
INSERT INTO "DocumentCounter" ("companyId", "kind", "year", "lastValue")
SELECT company_id, 'CREDIT_NOTE'::"DocumentKind", yr, MAX(seq)
FROM matched_credit_notes
GROUP BY company_id, yr
ON CONFLICT ("companyId", "kind", "year")
DO UPDATE SET "lastValue" = GREATEST("DocumentCounter"."lastValue", EXCLUDED."lastValue");
