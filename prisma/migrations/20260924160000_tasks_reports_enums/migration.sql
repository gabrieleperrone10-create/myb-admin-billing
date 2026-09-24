-- Nuovi valori enum in una migration a se' (usati dalla successiva).
ALTER TYPE "AppSection" ADD VALUE 'TASKS';
ALTER TYPE "AppSection" ADD VALUE 'REPORTS';
ALTER TYPE "ActivityType" ADD VALUE 'TASK_CREATED';
ALTER TYPE "ActivityType" ADD VALUE 'TASK_COMPLETED';
