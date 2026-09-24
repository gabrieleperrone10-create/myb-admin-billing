import { NextRequest, NextResponse } from "next/server";
import { basePrisma, companyDb } from "@/lib/db";
import { isAuthorizedCron } from "@/lib/cron";
import { notifyGuest } from "@/lib/booking/notify";
import { appBaseUrl } from "@/lib/booking/emails";
import { ACTIVE_STATUSES } from "@/lib/booking/shared";

/**
 * Promemoria appuntamenti — "tutto il dovuto fino ad ora", portato da
 * Nutrizionisti-app `api/cron/appointment-reminders`.
 *
 * Per ogni azienda attiva e ogni ReminderRule attiva (offset + canale): gli
 * appuntamenti attivi futuri il cui momento di promemoria (inizio − offset) e'
 * gia' maturato e che non hanno ancora una riga NotificationLog per quella
 * coppia. La finestra e' tollerante: se il cron gira una volta al giorno
 * (piano Hobby) un promemoria "1 ora prima" parte al primo giro utile, purche'
 * l'appuntamento non sia gia' iniziato. Rieseguirlo non duplica nulla: la
 * garanzia e' l'unique di NotificationLog (vedi lib/booking/notify.ts).
 *
 * Non usa forEachCompany(): quello richiede una riga Automation di un tipo
 * noto per ogni azienda, e un tipo nuovo andrebbe aggiunto al provisioning
 * (actions/companies.ts) e alla pagina Automazioni. Qui l'interruttore sono
 * le ReminderRule stesse: nessuna regola attiva = nessun promemoria.
 *
 * Un promemoria il cui momento e' precedente alla prenotazione (prenotato
 * 3 ore prima con una regola "24 ore prima") non parte: la conferma basta.
 */

const MAX_PER_COMPANY = 200;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const baseUrl = appBaseUrl(req.nextUrl.origin);
  const companies = await basePrisma.company.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } });
  const runs: { slug: string; sent: number; failed: number; skipped: number; error?: string }[] = [];

  for (const company of companies) {
    const db = companyDb(company.id);
    const run = { slug: company.slug, sent: 0, failed: 0, skipped: 0 } as (typeof runs)[number];
    try {
      const rules = await db.reminderRule.findMany({ where: { active: true }, orderBy: { offsetMinutes: "desc" } });
      if (!rules.length) continue;

      let budget = MAX_PER_COMPANY;
      for (const rule of rules) {
        if (budget <= 0) break;
        const due = await db.appointment.findMany({
          where: {
            status: { in: ACTIVE_STATUSES },
            startTime: { gt: now, lte: new Date(now.getTime() + rule.offsetMinutes * 60_000) },
            logs: { none: { kind: "REMINDER", channel: rule.channel, offsetMinutes: rule.offsetMinutes } },
          },
          include: { calendar: true },
          orderBy: { startTime: "asc" },
          take: budget,
        });
        for (const appt of due) {
          const dueAt = appt.startTime.getTime() - rule.offsetMinutes * 60_000;
          if (appt.createdAt.getTime() >= dueAt) {
            // Si registra lo "scarto" cosi' non torna fra i candidati a ogni giro.
            await db.notificationLog.create({
              data: {
                companyId: company.id, appointmentId: appt.id, kind: "REMINDER", channel: rule.channel,
                offsetMinutes: rule.offsetMinutes, ok: false, error: "Prenotato dopo il momento del promemoria",
              },
            }).catch(() => undefined);
            run.skipped++;
            continue;
          }
          budget--;
          const r = await notifyGuest(db, {
            company, appointment: appt, calendar: appt.calendar,
            kind: "REMINDER", channel: rule.channel, offsetMinutes: rule.offsetMinutes, baseUrl,
          });
          if ("skipped" in r) run.skipped++;
          else if (r.ok) run.sent++;
          else run.failed++;
        }
      }
    } catch (e) {
      run.error = e instanceof Error ? e.message : String(e);
    }
    runs.push(run);
  }

  return NextResponse.json({ ok: true, runs });
}
