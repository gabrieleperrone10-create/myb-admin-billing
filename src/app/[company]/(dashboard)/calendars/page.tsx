export const dynamic = "force-dynamic";
import Link from "next/link";
import { CalendarDays, Clock, Plus, ExternalLink, AlertTriangle, CheckCircle2 } from "lucide-react";
import { requireCompany } from "@/lib/company";
import { listCompanyMembers, memberName } from "@/lib/crm/members";
import { connectionState, isGoogleConfigured } from "@/lib/booking/google";
import { LOCATION_LABEL, publicBookingPath } from "@/lib/booking/shared";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { CalendarsNav } from "@/components/crm/booking/CalendarsNav";
import { ActiveToggle, CopyLinkButton, GoogleDisconnectButton, ReminderRulesEditor } from "@/components/crm/booking/CalendarActions";

export default async function CalendarsPage({
  params,
  searchParams,
}: {
  params: Promise<{ company: string }>;
  searchParams: Promise<{ google?: string; message?: string }>;
}) {
  const [{ company: slug }, sp] = await Promise.all([params, searchParams]);
  const ctx = await requireCompany(slug);
  const { db } = ctx;

  const [calendars, members, conn, rules, upcoming] = await Promise.all([
    db.calendar.findMany({ orderBy: [{ active: "desc" }, { createdAt: "asc" }], include: { _count: { select: { availability: true } } } }),
    listCompanyMembers(ctx.companyId).catch(() => []),
    db.userCalendarConnection.findFirst({ where: { clerkUserId: ctx.userId, provider: "GOOGLE" } }),
    db.reminderRule.findMany({ orderBy: { offsetMinutes: "desc" } }),
    db.appointment.groupBy({
      by: ["calendarId"],
      where: { status: { in: ["SCHEDULED", "CONFIRMED"] }, startTime: { gte: new Date() } },
      _count: { _all: true },
    }),
  ]);
  const upcomingBy = new Map(upcoming.map(u => [u.calendarId, u._count._all]));
  const googleReady = isGoogleConfigured();
  const state = connectionState(conn);

  return (
    <div className="space-y-6 max-w-[1100px]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold text-fg" style={{ letterSpacing: "-0.02em" }}>Calendari</h1>
          <p className="text-[13px] text-fg-3 mt-0.5">Pagine di prenotazione, disponibilità e promemoria</p>
        </div>
        <Link
          href={`/${slug}/calendars/new`}
          className="inline-flex items-center gap-1.5 px-3 py-[7px] bg-fg text-white text-[13px] font-medium rounded-[var(--r-md)] hover:bg-fg/90 transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2} /> Nuovo calendario
        </Link>
      </div>

      <CalendarsNav slug={slug} active="calendars" />

      {sp.google === "connected" && (
        <p className="text-[13px] rounded-[var(--r-md)] px-3 py-2 bg-ok-soft text-ok">Google Calendar collegato.</p>
      )}
      {sp.google === "error" && (
        <p className="text-[13px] rounded-[var(--r-md)] px-3 py-2 bg-danger-soft text-danger">{sp.message || "Collegamento a Google non riuscito."}</p>
      )}

      {/* Google Calendar dell'utente corrente */}
      <section className="bg-surface border border-border rounded-[var(--r-lg)] p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="min-w-0">
          <p className="text-[14px] font-medium text-fg">Il tuo Google Calendar</p>
          {!googleReady ? (
            <p className="text-[12px] text-fg-3 mt-0.5">
              Integrazione non configurata (servono GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e TOKEN_ENCRYPTION_KEY). Le prenotazioni funzionano lo stesso, senza sincronizzazione né Meet.
            </p>
          ) : state === "none" ? (
            <p className="text-[12px] text-fg-3 mt-0.5">Collegalo per sincronizzare gli appuntamenti di cui sei host, bloccare gli orari già occupati e generare link Google Meet.</p>
          ) : state === "revoked" ? (
            <p className="text-[12px] text-danger mt-0.5 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Accesso revocato o scaduto: ricollega Google Calendar.</p>
          ) : (
            <p className="text-[12px] text-fg-3 mt-0.5 flex items-center gap-1 flex-wrap">
              <CheckCircle2 className="w-3.5 h-3.5 text-ok" /> Collegato{conn?.email ? ` come ${conn.email}` : ""}
              {state === "error" && conn?.lastError && <span className="text-warn">· ultimo errore: {conn.lastError.slice(0, 140)}</span>}
            </p>
          )}
        </div>
        {googleReady && (
          <div className="flex gap-2 shrink-0">
            {(state === "none" || state === "revoked" || state === "error") && (
              <a
                href={`/api/google/connect?company=${encodeURIComponent(slug)}`}
                className="inline-flex items-center gap-1.5 px-3 py-[7px] bg-fg text-white text-[13px] font-medium rounded-[var(--r-md)] hover:bg-fg/90"
              >
                {state === "none" ? "Collega Google Calendar" : "Ricollega"}
              </a>
            )}
            {state !== "none" && <GoogleDisconnectButton slug={slug} />}
          </div>
        )}
      </section>

      {/* Calendari */}
      {calendars.length === 0 ? (
        <div className="bg-surface border border-border rounded-[var(--r-lg)]">
          <EmptyState
            icon={CalendarDays}
            title="Nessun calendario"
            subtitle="Crea un calendario per ricevere prenotazioni da un link pubblico"
            action={
              <Link href={`/${slug}/calendars/new`} className="inline-flex items-center gap-1.5 px-3 py-[7px] bg-fg text-white text-[13px] font-medium rounded-[var(--r-md)]">
                <Plus className="w-3.5 h-3.5" /> Nuovo calendario
              </Link>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {calendars.map(c => {
            const path = publicBookingPath(slug, c.slug);
            return (
              <div key={c.id} className="bg-surface border border-border rounded-[var(--r-lg)] p-5 flex flex-col" style={{ borderTop: `3px solid ${c.color}` }}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[14px] font-medium text-fg">{c.name}</h3>
                  {c.active ? <Badge variant="ok">Attivo</Badge> : <Badge>Disattivato</Badge>}
                </div>
                <p className="text-[12px] text-fg-3 mt-1">Host: {memberName(members, c.hostUserId) ?? "—"}</p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-fg-2">
                  <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {c.durationMinutes} min</span>
                  <span>{LOCATION_LABEL[c.locationType]}</span>
                  <span>{upcomingBy.get(c.id) ?? 0} in programma</span>
                </div>
                {c._count.availability === 0 && (
                  <p className="mt-2 text-[12px] text-warn flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Nessuna disponibilità impostata</p>
                )}
                <p className="mt-3 text-[11px] font-mono text-fg-3 break-all">{path}</p>
                <div className="flex items-center justify-between gap-2 mt-auto pt-3 border-t border-subtle">
                  <div className="flex items-center gap-3">
                    <CopyLinkButton path={path} />
                    <a href={path} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] text-fg-2 hover:text-fg">
                      <ExternalLink className="w-3.5 h-3.5" /> Apri
                    </a>
                  </div>
                  <div className="flex items-center gap-3">
                    <ActiveToggle slug={slug} id={c.id} active={c.active} />
                    <Link href={`/${slug}/calendars/${c.id}`} className="text-[12px] font-medium text-info hover:underline">Modifica</Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Promemoria */}
      <section className="bg-surface border border-border rounded-[var(--r-lg)] p-5 space-y-3">
        <div>
          <h2 className="text-[14px] font-semibold text-fg">Promemoria</h2>
          <p className="text-[12px] text-fg-3 mt-0.5">Valgono per tutti i calendari dell&apos;azienda. Ogni promemoria parte una sola volta per appuntamento.</p>
        </div>
        <ReminderRulesEditor
          slug={slug}
          initial={rules.map(r => ({ offsetMinutes: r.offsetMinutes, channel: r.channel, active: r.active }))}
        />
      </section>
    </div>
  );
}
