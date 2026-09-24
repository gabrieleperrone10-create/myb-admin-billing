import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolvePublicCalendar } from "@/lib/booking/public";
import { parseCalendarSettings } from "@/lib/booking/shared";
import { companyDisplayName } from "@/lib/company";
import { BookingWidget } from "@/components/crm/booking/BookingWidget";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ companySlug: string; calendarSlug: string }> };

function safeColor(c: string | null | undefined): string {
  return c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : "#4f7deb";
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { companySlug, calendarSlug } = await params;
  const ctx = await resolvePublicCalendar(companySlug, calendarSlug);
  if (!ctx) return { title: "Prenotazione" };
  return {
    title: `${ctx.calendar.name} — ${companyDisplayName(ctx.company)}`,
    description: ctx.calendar.description ?? `Prenota ${ctx.calendar.name}`,
    robots: { index: false },
  };
}

/** Pagina pubblica di prenotazione: /book/<azienda>/<calendario>. */
export default async function PublicBookingPage({ params }: Params) {
  const { companySlug, calendarSlug } = await params;
  const ctx = await resolvePublicCalendar(companySlug, calendarSlug);
  if (!ctx) notFound();
  const { company, calendar } = ctx;
  const settings = parseCalendarSettings(calendar.settings);

  return (
    <BookingWidget
      brand={{ name: companyDisplayName(company), logoUrl: company.logoUrl, color: safeColor(company.brandColor) }}
      calendar={{
        companySlug: company.slug,
        calendarSlug: calendar.slug,
        name: calendar.name,
        description: calendar.description,
        durationMinutes: calendar.durationMinutes,
        maxAdvanceDays: calendar.maxAdvanceDays,
        timezone: calendar.timezone,
        locationType: calendar.locationType,
        locationValue: calendar.locationType === "VIDEO" ? null : calendar.locationValue,
        questions: settings.questions ?? [],
      }}
    />
  );
}
