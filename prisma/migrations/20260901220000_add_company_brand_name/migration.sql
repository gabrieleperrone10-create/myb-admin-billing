-- Nome brand separato dalla ragione sociale: nullable, nessun backfill
-- necessario. Il codice applicativo usa "brandName ?? name" ovunque va
-- mostrata l'identità nell'app, quindi le aziende esistenti continuano a
-- mostrare il loro nome attuale finché qualcuno non imposta un brand.
ALTER TABLE "Company" ADD COLUMN "brandName" TEXT;
