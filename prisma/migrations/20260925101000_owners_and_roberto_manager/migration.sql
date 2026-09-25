-- Dati una tantum, richiesti esplicitamente dall'amministratore:
--  - gabrieleperrone10 (user_3EqcyZVmA0cDwqkxGHPJelzkXKs) e gabriele
--    marketyourbusiness (user_3EPi60QnqmNJOLCnpYbxdhTLpxQ): membri e Owner di
--    Market Your Business e Axis Mundi;
--  - Roberto Perla (user_3JoJzms0DJzlHzgk456g0kwBfjK): Manager di Axis Mundi.
-- Se i ruoli Owner/Manager non esistono ancora in un'azienda (seed mai
-- eseguito) li crea con gli stessi permessi di src/lib/roleSeed.ts.
-- Tutto idempotente (ON CONFLICT DO NOTHING).

-- Ruoli mancanti
INSERT INTO "AppRole" ("id", "name", "description", "color", "isSystem", "createdAt", "updatedAt", "companyId")
SELECT 'ro' || replace(gen_random_uuid()::text, '-', ''), r.name, r.description, r.color, r.is_system, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, c."id"
FROM "Company" c
CROSS JOIN (VALUES
  ('Owner', 'Accesso completo a tutto il sistema', '#dc2626', true),
  ('Manager', 'Accesso operativo completo, visualizzazione impostazioni', '#8b5cf6', false)
) AS r(name, description, color, is_system)
WHERE c."slug" IN ('market-your-business', 'axis-mundi-institute')
ON CONFLICT ("companyId", "name") DO NOTHING;

-- Permessi dei ruoli appena creati (quelli esistenti non vengono toccati)
INSERT INTO "AppRolePermission" ("id", "roleId", "section", "level", "scope", "companyId")
SELECT 'rp' || replace(gen_random_uuid()::text, '-', ''), ro."id", s.section,
  CASE
    WHEN ro."name" = 'Owner' THEN 'FULL'::"PermissionLevel"
    WHEN s.section IN ('SETTINGS', 'USERS') THEN 'VIEW'::"PermissionLevel"
    ELSE 'EDIT'::"PermissionLevel"
  END,
  'ALL'::"DataScope", ro."companyId"
FROM "AppRole" ro
JOIN "Company" c ON c."id" = ro."companyId"
CROSS JOIN unnest(enum_range(NULL::"AppSection")) AS s(section)
WHERE c."slug" IN ('market-your-business', 'axis-mundi-institute')
  AND ro."name" IN ('Owner', 'Manager')
  AND NOT EXISTS (SELECT 1 FROM "AppRolePermission" p WHERE p."roleId" = ro."id")
ON CONFLICT ("roleId", "section") DO NOTHING;

-- Membership
INSERT INTO "CompanyMember" ("id", "companyId", "clerkUserId", "isDefault", "createdAt")
SELECT 'cm' || replace(gen_random_uuid()::text, '-', ''), c."id", u.uid, false, CURRENT_TIMESTAMP
FROM "Company" c
CROSS JOIN (VALUES ('user_3EqcyZVmA0cDwqkxGHPJelzkXKs'), ('user_3EPi60QnqmNJOLCnpYbxdhTLpxQ')) AS u(uid)
WHERE c."slug" IN ('market-your-business', 'axis-mundi-institute')
ON CONFLICT ("companyId", "clerkUserId") DO NOTHING;

INSERT INTO "CompanyMember" ("id", "companyId", "clerkUserId", "isDefault", "createdAt")
SELECT 'cm' || replace(gen_random_uuid()::text, '-', ''), c."id", 'user_3JoJzms0DJzlHzgk456g0kwBfjK', false, CURRENT_TIMESTAMP
FROM "Company" c WHERE c."slug" = 'axis-mundi-institute'
ON CONFLICT ("companyId", "clerkUserId") DO NOTHING;

-- Ruoli assegnati
INSERT INTO "AppUserRole" ("id", "clerkUserId", "roleId", "assignedAt", "companyId")
SELECT 'ur' || replace(gen_random_uuid()::text, '-', ''), u.uid, ro."id", CURRENT_TIMESTAMP, ro."companyId"
FROM "AppRole" ro
JOIN "Company" c ON c."id" = ro."companyId"
CROSS JOIN (VALUES ('user_3EqcyZVmA0cDwqkxGHPJelzkXKs'), ('user_3EPi60QnqmNJOLCnpYbxdhTLpxQ')) AS u(uid)
WHERE c."slug" IN ('market-your-business', 'axis-mundi-institute') AND ro."name" = 'Owner'
ON CONFLICT ("companyId", "clerkUserId", "roleId") DO NOTHING;

INSERT INTO "AppUserRole" ("id", "clerkUserId", "roleId", "assignedAt", "companyId")
SELECT 'ur' || replace(gen_random_uuid()::text, '-', ''), 'user_3JoJzms0DJzlHzgk456g0kwBfjK', ro."id", CURRENT_TIMESTAMP, ro."companyId"
FROM "AppRole" ro
JOIN "Company" c ON c."id" = ro."companyId"
WHERE c."slug" = 'axis-mundi-institute' AND ro."name" = 'Manager'
ON CONFLICT ("companyId", "clerkUserId", "roleId") DO NOTHING;
