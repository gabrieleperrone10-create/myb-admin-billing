import "server-only";

/**
 * Punto d'ingresso dei report vendite per il resto dell'app (es. dashboard).
 * I moduli di calcolo puri (period, sources, spend, funnel, revenue,
 * attribution, metrics) si importano direttamente dai rispettivi file.
 */
export { getSalesSummary, type PeriodKpis } from "./queries";
