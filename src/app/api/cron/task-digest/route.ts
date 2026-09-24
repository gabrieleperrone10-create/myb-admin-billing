import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { basePrisma, companyDb } from "@/lib/db";
import { isAuthorizedCron, companyMailIdentity } from "@/lib/cron";
import { companyPath } from "@/lib/paths";
import { contactDisplayName } from "@/lib/crm/contacts";
import { startOfDayInTz } from "@/lib/crm/tasks";
import { listCompanyMembers } from "@/lib/crm/members";

/**
 * Digest giornaliero dei task in ritardo/in scadenza oggi, per assegnatario.
 *
 * Come appointment-reminders (vedi quel file): non usa forEachCompany(),
 * perché richiederebbe una riga Automation di un tipo registrato per ogni
 * azienda (provisioning + pagina Automazioni), fuori dal mio perimetro. Qui
 * l'interruttore e' semplicemente "ci sono task in ritardo/in scadenza oggi
 * per qualche assegnatario": nessun task cosi' = nessuna email.
 *
 * Idempotenza: il piano Vercel e' Hobby (max 1 esecuzione/giorno per cron),
 * quindi non serve una tabella di log — la singola esecuzione giornaliera
 * e' la garanzia.
 */
const resend = new Resend(process.env.RESEND_API_KEY);

type DigestTask = {
  id: string;
  title: string;
  dueAt: Date | null;
  allDay: boolean;
  assigneeUserId: string | null;
  contact: { id: string; firstName: string | null; lastName: string | null; email: string | null; phone: string | null; companyName: string | null } | null;
};

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const baseUrl = new URL(req.url).origin;
  const companies = await basePrisma.company.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } });
  const runs: { slug: string; sent: number; skipped: number; error?: string }[] = [];

  for (const company of companies) {
    const db = companyDb(company.id);
    const run = { slug: company.slug, sent: 0, skipped: 0 } as (typeof runs)[number];
    try {
      const startTomorrow = startOfDayInTz(new Date(), company.timezone, 1);
      const startToday = startOfDayInTz(new Date(), company.timezone);

      const dueTasks: DigestTask[] = await db.task.findMany({
        where: { status: "OPEN", assigneeUserId: { not: null }, dueAt: { lt: startTomorrow } },
        select: {
          id: true, title: true, dueAt: true, allDay: true, assigneeUserId: true,
          contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, companyName: true } },
        },
        orderBy: { dueAt: "asc" },
      });

      if (dueTasks.length === 0) { runs.push(run); continue; }

      const byAssignee = new Map<string, DigestTask[]>();
      for (const t of dueTasks) {
        if (!t.assigneeUserId) continue;
        const list = byAssignee.get(t.assigneeUserId) ?? [];
        list.push(t);
        byAssignee.set(t.assigneeUserId, list);
      }
      if (byAssignee.size === 0) { runs.push(run); continue; }

      const members = await listCompanyMembers(company.id);
      const { fromName, fromEmail, replyTo } = companyMailIdentity(company);
      const tasksUrl = `${baseUrl}${companyPath(company.slug, "/tasks")}`;

      for (const [assigneeUserId, tasks] of byAssignee) {
        const member = members.find(m => m.userId === assigneeUserId);
        if (!member?.email) { run.skipped++; continue; }

        const rows = tasks.map(t => {
          const overdue = !!t.dueAt && t.dueAt.getTime() < startToday.getTime();
          const dueLabel = !t.dueAt
            ? "Senza scadenza"
            : overdue
              ? `In ritardo — ${new Intl.DateTimeFormat("it-IT").format(t.dueAt)}`
              : `Oggi${t.allDay ? "" : `, ${new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(t.dueAt)}`}`;
          const contactLink = t.contact ? `${baseUrl}${companyPath(company.slug, `/contacts/${t.contact.id}`)}` : null;
          return `
            <tr style="border-bottom:1px solid #f3f4f6;">
              <td style="padding:10px 12px;font-size:13px;font-weight:600;color:#111827;">${t.title}</td>
              <td style="padding:10px 12px;font-size:12px;color:${overdue ? "#dc2626" : "#6b7280"};font-weight:${overdue ? "600" : "400"};">${dueLabel}</td>
              <td style="padding:10px 12px;font-size:13px;color:#374151;">
                ${t.contact ? `<a href="${contactLink}" style="color:#2563eb;text-decoration:none;">${contactDisplayName(t.contact)}</a>` : "—"}
              </td>
            </tr>
          `;
        }).join("");

        const overdueCount = tasks.filter(t => t.dueAt && t.dueAt.getTime() < startToday.getTime()).length;
        const todayCount = tasks.length - overdueCount;

        const html = `
          <!DOCTYPE html><html lang="it"><head><meta charset="utf-8"></head>
          <body style="font-family:sans-serif;color:#111827;max-width:640px;margin:0 auto;padding:32px 16px;">
            <div style="border-bottom:3px solid #2563eb;padding-bottom:16px;margin-bottom:24px;">
              <span style="font-size:20px;font-weight:700;color:#2563eb;">${fromName}</span>
            </div>
            <p style="font-size:16px;margin-bottom:8px;">Ciao ${member.name},</p>
            <p style="color:#4b5563;line-height:1.6;">
              hai <strong>${tasks.length}</strong> task da seguire
              ${overdueCount > 0 ? `(<strong style="color:#dc2626;">${overdueCount} in ritardo</strong>${todayCount > 0 ? `, ${todayCount} in scadenza oggi` : ""})` : "in scadenza oggi"}.
            </p>
            <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;margin:20px 0;">
              <thead>
                <tr style="background:#f9fafb;border-bottom:1px solid #e5e7eb;">
                  <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">Task</th>
                  <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">Scadenza</th>
                  <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">Contatto</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
            <p><a href="${tasksUrl}" style="color:#2563eb;font-weight:600;">Apri le mie attività →</a></p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
            <p style="font-size:11px;color:#9ca3af;">Promemoria automatico giornaliero di ${fromName}</p>
          </body></html>
        `;

        const { error } = await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          replyTo,
          to: [member.email],
          subject: overdueCount > 0
            ? `⚠️ ${overdueCount} task in ritardo, ${todayCount} oggi — ${fromName}`
            : `${todayCount} task in scadenza oggi — ${fromName}`,
          html,
        });

        if (error) run.skipped++;
        else run.sent++;
      }
    } catch (e) {
      run.error = e instanceof Error ? e.message : String(e);
    }
    runs.push(run);
  }

  return NextResponse.json({ ok: true, runs });
}
