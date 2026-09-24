/**
 * Formattazione date della conversazione. Fuso fisso Europe/Rome: server e
 * browser producono la stessa stringa, niente mismatch di idratazione.
 */
const TZ = "Europe/Rome";

const timeFmt = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const dayFmt = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ });
const shortFmt = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", timeZone: TZ });
const fullFmt = new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short", timeZone: TZ });
const keyFmt = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: TZ });

export const formatTime = (iso: string) => timeFmt.format(new Date(iso));
export const formatDay = (iso: string) => dayFmt.format(new Date(iso));
export const formatFull = (iso: string) => fullFmt.format(new Date(iso));
export const dayKey = (iso: string) => keyFmt.format(new Date(iso));

/** Per la lista: ora se oggi, altrimenti gg/mm. `now` passato dal server per coerenza. */
export function formatListDate(iso: string, nowIso: string): string {
  return dayKey(iso) === dayKey(nowIso) ? formatTime(iso) : shortFmt.format(new Date(iso));
}
