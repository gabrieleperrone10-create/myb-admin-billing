-- Nuovi valori enum in una migration a se': Postgres non permette di usare un
-- valore aggiunto con ADD VALUE nella stessa transazione in cui nasce, e la
-- migration crm_constraints_backfill usa le nuove sezioni per i permessi.
ALTER TYPE "IntegrationProvider" ADD VALUE 'WHATSAPP';
ALTER TYPE "AppSection" ADD VALUE 'CONTACTS';
ALTER TYPE "AppSection" ADD VALUE 'PIPELINES';
ALTER TYPE "AppSection" ADD VALUE 'CONVERSATIONS';
ALTER TYPE "AppSection" ADD VALUE 'FORMS';
ALTER TYPE "AppSection" ADD VALUE 'CALENDARS';
