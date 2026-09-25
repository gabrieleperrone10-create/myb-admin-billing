-- Dato una tantum, richiesto esplicitamente dall'amministratore: Roberto Perla
-- membro di Axis Mundi. Gli utenti creati da Impostazioni > Utenti prima della
-- correzione di createNewUser non ricevevano la CompanyMember (entravano ma
-- vedevano "nessuna azienda"). Nessun ruolo assegnato qui: si assegna dall'app.
-- Idempotente: se l'azienda non esiste o la membership c'e' gia', non fa nulla.
INSERT INTO "CompanyMember" ("id", "companyId", "clerkUserId", "isDefault", "createdAt")
SELECT 'cm' || replace(gen_random_uuid()::text, '-', ''), c."id", 'user_3JoJzms0DJzlHzgk456g0kwBfjK', false, CURRENT_TIMESTAMP
FROM "Company" c
WHERE c."slug" = 'axis-mundi-institute'
ON CONFLICT ("companyId", "clerkUserId") DO NOTHING;
