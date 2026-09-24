import { requireCompany } from "@/lib/company";
import { listCompanyMembers, memberName } from "@/lib/crm/members";
import { contactDisplayName } from "@/lib/crm/contacts";
import { AppointmentRow, type AppointmentRowData } from "@/components/crm/booking/AppointmentRow";
import { BookForContact } from "@/components/crm/booking/AppointmentActions";
import type { ContactTabProps } from "./types";

/** Tab "Appuntamenti" della scheda contatto: prossimi, passati, prenotazione diretta. */
export default async function AppointmentsTab({ slug, contactId }: ContactTabProps) {
  const ctx = await requireCompany(slug);
  const [contact, appointments, calendars, members] = await Promise.all([
    ctx.db.contact.findUnique({ where: { id: contactId }, select: { firstName: true, lastName: true, email: true, phone: true, companyName: true } }),
    ctx.db.appointment.findMany({
      where: { contactId },
      include: { calendar: { select: { id: true, name: true, color: true, timezone: true } } },
      orderBy: { startTime: "desc" },
      take: 100,
    }),
    ctx.db.calendar.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }], select: { id: true, name: true, timezone: true, active: true } }),
    listCompanyMembers(ctx.companyId).catch(() => []),
  ]);
  if (!contact) return null;

  const now = Date.now();
  const rows: AppointmentRowData[] = appointments.map(a => ({
    id: a.id,
    title: a.title,
    startTime: a.startTime,
    endTime: a.endTime,
    status: a.status,
    videoLink: a.videoLink,
    cancelReason: a.cancelReason,
    contactId: a.contactId,
    contactName: contactDisplayName(contact),
    calendarId: a.calendar.id,
    calendarName: a.calendar.name,
    calendarColor: a.calendar.color,
    timezone: a.calendar.timezone,
    hostName: memberName(members, a.hostUserId),
  }));
  const upcoming = rows
    .filter(r => r.endTime.getTime() >= now && (r.status === "SCHEDULED" || r.status === "CONFIRMED"))
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  const past = rows.filter(r => !upcoming.includes(r));

  const section = (title: string, list: AppointmentRowData[], empty: string) => (
    <section className="space-y-2">
      <h3 className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--fg-3)" }}>{title}</h3>
      <div className="bg-surface border border-border rounded-[var(--r-lg)] divide-y divide-border">
        {list.length === 0
          ? <p className="text-[13px] px-4 py-6 text-center" style={{ color: "var(--fg-3)" }}>{empty}</p>
          : list.map(a => <AppointmentRow key={a.id} slug={slug} a={a} showContact={false} now={now} />)}
      </div>
    </section>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <BookForContact slug={slug} contactId={contactId} calendars={calendars} hasEmail={!!contact.email} />
      </div>
      {section("Prossimi", upcoming, "Nessun appuntamento in programma")}
      {section("Passati e annullati", past, "Nessuno storico")}
    </div>
  );
}
