export const dynamic = "force-dynamic";
import { CalendarX } from "lucide-react";
import type { AppointmentStatus, Prisma } from "@prisma/client";
import { requireCompany } from "@/lib/company";
import { listCompanyMembers, memberName } from "@/lib/crm/members";
import { contactDisplayName } from "@/lib/crm/contacts";
import { APPOINTMENT_STATUS_LABEL } from "@/lib/booking/shared";
import { EmptyState } from "@/components/ui/EmptyState";
import { CalendarsNav } from "@/components/crm/booking/CalendarsNav";
import { AppointmentRow } from "@/components/crm/booking/AppointmentRow";

const STATUSES = Object.keys(APPOINTMENT_STATUS_LABEL) as AppointmentStatus[];
const PAGE = 200;

export default async function AgendaPage({
  params,
  searchParams,
}: {
  params: Promise<{ company: string }>;
  searchParams: Promise<{ calendar?: string; host?: string; status?: string; when?: string }>;
}) {
  const [{ company: slug }, sp] = await Promise.all([params, searchParams]);
  const ctx = await requireCompany(slug);
  const when = sp.when === "past" ? "past" : sp.when === "all" ? "all" : "upcoming";
  const status = STATUSES.includes(sp.status as AppointmentStatus) ? (sp.status as AppointmentStatus) : undefined;
  const now = new Date();

  const where: Prisma.AppointmentWhereInput = {
    ...(sp.calendar ? { calendarId: sp.calendar } : {}),
    ...(sp.host ? { hostUserId: sp.host } : {}),
    ...(status ? { status } : when === "upcoming" ? { status: { in: ["SCHEDULED", "CONFIRMED"] } } : {}),
    ...(when === "upcoming" ? { endTime: { gte: now } } : when === "past" ? { endTime: { lt: now } } : {}),
  };

  const [appointments, calendars, members] = await Promise.all([
    ctx.db.appointment.findMany({
      where,
      include: {
        calendar: { select: { id: true, name: true, color: true, timezone: true } },
        contact: { select: { firstName: true, lastName: true, email: true, phone: true, companyName: true } },
      },
      orderBy: { startTime: when === "past" ? "desc" : "asc" },
      take: PAGE,
    }),
    ctx.db.calendar.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    listCompanyMembers(ctx.companyId).catch(() => []),
  ]);

  const selectCls = "px-2.5 py-1.5 border border-border rounded-[var(--r-md)] text-[12px] text-fg bg-surface";
  const nowMs = now.getTime();

  return (
    <div className="space-y-6 max-w-[1100px]">
      <div>
        <h1 className="text-[24px] font-semibold text-fg" style={{ letterSpacing: "-0.02em" }}>Agenda</h1>
        <p className="text-[13px] text-fg-3 mt-0.5">{appointments.length}{appointments.length === PAGE ? "+" : ""} appuntamenti</p>
      </div>
      <CalendarsNav slug={slug} active="agenda" />

      <form method="get" className="flex flex-wrap items-center gap-2">
        <select name="when" defaultValue={when} className={selectCls}>
          <option value="upcoming">Prossimi</option>
          <option value="past">Passati</option>
          <option value="all">Tutti</option>
        </select>
        <select name="calendar" defaultValue={sp.calendar ?? ""} className={selectCls}>
          <option value="">Tutti i calendari</option>
          {calendars.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select name="host" defaultValue={sp.host ?? ""} className={selectCls}>
          <option value="">Tutti gli host</option>
          {members.map(m => <option key={m.userId} value={m.userId}>{m.name}</option>)}
        </select>
        <select name="status" defaultValue={status ?? ""} className={selectCls}>
          <option value="">{when === "upcoming" ? "Attivi" : "Tutti gli stati"}</option>
          {STATUSES.map(s => <option key={s} value={s}>{APPOINTMENT_STATUS_LABEL[s]}</option>)}
        </select>
        <button type="submit" className="px-3 py-1.5 bg-fg text-white text-[12px] font-medium rounded-[var(--r-md)]">Filtra</button>
      </form>

      <div className="bg-surface border border-border rounded-[var(--r-lg)] divide-y divide-border">
        {appointments.length === 0 ? (
          <EmptyState icon={CalendarX} title="Nessun appuntamento" subtitle="Cambia i filtri o condividi il link di un calendario" />
        ) : appointments.map(a => (
          <AppointmentRow
            key={a.id}
            slug={slug}
            now={nowMs}
            a={{
              id: a.id,
              title: a.title,
              startTime: a.startTime,
              endTime: a.endTime,
              status: a.status,
              videoLink: a.videoLink,
              cancelReason: a.cancelReason,
              contactId: a.contactId,
              contactName: contactDisplayName(a.contact),
              calendarId: a.calendar.id,
              calendarName: a.calendar.name,
              calendarColor: a.calendar.color,
              timezone: a.calendar.timezone,
              hostName: memberName(members, a.hostUserId),
            }}
          />
        ))}
      </div>
    </div>
  );
}
