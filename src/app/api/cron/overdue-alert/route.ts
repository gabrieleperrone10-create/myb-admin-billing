import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const automation = await prisma.automation.findUnique({ where: { type: "OVERDUE_ALERT" } });
  if (!automation?.active) {
    return NextResponse.json({ skipped: true, reason: "automation disabled" });
  }

  const config     = (automation.config ?? {}) as Record<string, unknown>;
  const alertEmail = (config.email as string) || process.env.EMAIL_REPLY_TO || "amministrazione@marketyourbusiness.it";

  const [invoices, company] = await Promise.all([
    prisma.invoice.findMany({
      where:   { status: "OVERDUE" },
      include: { client: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.companySettings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } }),
  ]);

  const fromName  = company.name || "Market Your Business";
  const fromEmail = process.env.EMAIL_FROM || "noreply@fatturazione.marketyourbusiness.it";
  const totalOverdue = invoices.reduce((s, inv) => s + inv.amount, 0);
  const fmt = (n: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);
  const fmtDate = (d: Date | string) => new Intl.DateTimeFormat("it-IT").format(new Date(d));

  const rows = invoices.map(inv => {
    const daysLate = Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / 864e5);
    const waPhone  = inv.client.whatsapp?.replace(/\D/g, "");
    const waText   = encodeURIComponent(
      `Ciao ${inv.client.name},\n\nti ricordiamo che la fattura *${inv.number}* di *${fmt(inv.amount)}* risulta scaduta il *${fmtDate(inv.dueDate)}*.\n\nTi chiediamo di provvedere al pagamento il prima possibile.\n\nGrazie,\n${fromName}`
    );
    const waLink = waPhone ? `https://wa.me/${waPhone}?text=${waText}` : null;

    return `
      <tr style="border-bottom:1px solid #f3f4f6;">
        <td style="padding:10px 12px;font-size:13px;font-weight:600;">${inv.client.name}</td>
        <td style="padding:10px 12px;font-size:13px;color:#6b7280;">${inv.number}</td>
        <td style="padding:10px 12px;font-size:13px;color:#6b7280;">${fmtDate(inv.dueDate)}</td>
        <td style="padding:10px 12px;font-size:13px;font-weight:600;color:#dc2626;">${fmt(inv.amount)}</td>
        <td style="padding:10px 12px;font-size:12px;color:#dc2626;">${daysLate}gg</td>
        <td style="padding:10px 12px;">
          ${waLink
            ? `<a href="${waLink}" style="background:#25d366;color:white;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;text-decoration:none;">📱 WhatsApp</a>`
            : `<span style="font-size:11px;color:#9ca3af;">—</span>`
          }
        </td>
      </tr>
    `;
  }).join("");

  const html = `
    <!DOCTYPE html><html lang="it"><head><meta charset="utf-8"></head>
    <body style="font-family:sans-serif;color:#111827;max-width:700px;margin:0 auto;padding:32px 16px;">
      <div style="border-bottom:3px solid #dc2626;padding-bottom:16px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:20px;font-weight:700;color:#dc2626;">${fromName}</span>
        <span style="font-size:12px;color:#6b7280;">Report settimanale insoluti</span>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
        <div style="background:#fef2f2;border-radius:8px;padding:16px;">
          <p style="font-size:11px;color:#dc2626;text-transform:uppercase;font-weight:600;margin:0 0 4px;">Totale insoluto</p>
          <p style="font-size:24px;font-weight:700;color:#dc2626;margin:0;">${fmt(totalOverdue)}</p>
        </div>
        <div style="background:#fff7ed;border-radius:8px;padding:16px;">
          <p style="font-size:11px;color:#ea580c;text-transform:uppercase;font-weight:600;margin:0 0 4px;">Fatture scadute</p>
          <p style="font-size:24px;font-weight:700;color:#ea580c;margin:0;">${invoices.length}</p>
        </div>
      </div>

      ${invoices.length === 0
        ? `<div style="background:#f0fdf4;border-radius:8px;padding:24px;text-align:center;color:#16a34a;font-weight:600;">✅ Nessuna fattura scaduta questa settimana!</div>`
        : `
        <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
          <thead>
            <tr style="background:#f9fafb;border-bottom:1px solid #e5e7eb;">
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">Cliente</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">Fattura</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">Scadenza</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">Importo</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">Ritardo</th>
              <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">WhatsApp</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="font-size:12px;color:#9ca3af;margin-top:12px;">
          I pulsanti WhatsApp aprono un messaggio pre-compilato pronto da inviare.
        </p>`
      }

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
      <p style="font-size:11px;color:#9ca3af;">Report automatico di ${fromName} — ogni lunedì</p>
    </body></html>
  `;

  const { error } = await resend.emails.send({
    from:    `${fromName} <${fromEmail}>`,
    to:      [alertEmail],
    subject: invoices.length === 0
      ? `✅ Nessun insoluto questa settimana — ${fromName}`
      : `⚠️ ${invoices.length} fatture scadute — ${fmt(totalOverdue)} insoluti`,
    html,
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  await prisma.automation.update({ where: { type: "OVERDUE_ALERT" }, data: { lastRunAt: new Date() } });

  return NextResponse.json({ ok: true, sentTo: alertEmail, invoices: invoices.length, total: totalOverdue });
}
