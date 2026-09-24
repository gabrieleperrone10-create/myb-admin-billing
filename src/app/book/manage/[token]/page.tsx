import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolveByManageToken } from "@/lib/booking/public";
import { LOCATION_LABEL } from "@/lib/booking/shared";
import { companyDisplayName } from "@/lib/company";
import { ManageBooking } from "@/components/crm/booking/ManageBooking";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Gestisci prenotazione", robots: { index: false } };

/** /book/manage/<manageToken> — annulla o sposta dal link dell'email. */
export default async function ManageBookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ctx = await resolveByManageToken(token);
  if (!ctx) notFound();
  const { company, appointment: a } = ctx;
  const cal = a.calendar;
  const color = /^#[0-9a-fA-F]{6}$/.test(company.brandColor) ? company.brandColor : "#4f7deb";

  return (
    <ManageBooking
      info={{
        token: a.manageToken,
        companySlug: company.slug,
        calendarSlug: cal.slug,
        calendarActive: cal.active,
        calendarName: cal.name,
        brandName: companyDisplayName(company),
        logoUrl: company.logoUrl,
        color,
        timezone: cal.timezone,
        durationMinutes: Math.round((a.endTime.getTime() - a.startTime.getTime()) / 60_000),
        maxAdvanceDays: cal.maxAdvanceDays,
        startTime: a.startTime.toISOString(),
        status: a.status,
        videoLink: a.videoLink,
        locationLabel: cal.locationType === "VIDEO" ? LOCATION_LABEL.VIDEO : cal.locationValue || LOCATION_LABEL[cal.locationType],
        guestName: a.guestName,
        // eslint-disable-next-line react-hooks/purity -- pagina dinamica, l'ora corrente e' voluta
        isPast: a.endTime.getTime() < Date.now(),
      }}
    />
  );
}
