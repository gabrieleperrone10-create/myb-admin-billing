import type { KRType } from "@prisma/client";

export type ObjectivePeriodKey = "Q1"|"Q2"|"Q3"|"Q4"|"ANNUAL"|"CUSTOM"|"M1"|"M2"|"M3"|"M4"|"M5"|"M6"|"M7"|"M8"|"M9"|"M10"|"M11"|"M12";

export function getPeriodDates(period: ObjectivePeriodKey, year: number): { start: Date; end: Date } {
  // Monthly
  const mMatch = period.match(/^M(\d+)$/);
  if (mMatch) {
    const m = parseInt(mMatch[1]) - 1; // 0-indexed
    const lastDay = new Date(year, m + 1, 0).getDate();
    return { start: new Date(year, m, 1), end: new Date(year, m, lastDay, 23, 59, 59) };
  }
  switch (period) {
    case "Q1":     return { start: new Date(year, 0, 1),  end: new Date(year, 2,  31, 23, 59, 59) };
    case "Q2":     return { start: new Date(year, 3, 1),  end: new Date(year, 5,  30, 23, 59, 59) };
    case "Q3":     return { start: new Date(year, 6, 1),  end: new Date(year, 8,  30, 23, 59, 59) };
    case "Q4":     return { start: new Date(year, 9, 1),  end: new Date(year, 11, 31, 23, 59, 59) };
    case "ANNUAL": return { start: new Date(year, 0, 1),  end: new Date(year, 11, 31, 23, 59, 59) };
    default:       return { start: new Date(year, 0, 1),  end: new Date(year, 11, 31, 23, 59, 59) };
  }
}

export function krProgress(kr: { type: KRType; target: number | null; current: number | null; completed: boolean }): number {
  if (kr.type === "MILESTONE") return kr.completed ? 100 : 0;
  if (!kr.target || kr.target === 0) return 0;
  return Math.min(100, Math.round(((kr.current ?? 0) / kr.target) * 100));
}

export function objectiveProgress(krs: Parameters<typeof krProgress>[0][]): number {
  if (krs.length === 0) return 0;
  return Math.round(krs.reduce((s, kr) => s + krProgress(kr), 0) / krs.length);
}
