export const dynamic = "force-dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireCompany } from "@/lib/company";
import { loadCalendarFormData } from "@/lib/booking/admin";
import { parseCalendarSettings } from "@/lib/booking/shared";
import { CalendarForm } from "@/components/crm/booking/CalendarForm";
import { CalendarDangerZone } from "@/components/crm/booking/CalendarActions";

export default async function EditCalendarPage({ params }: { params: Promise<{ company: string; id: string }> }) {
  const { company: slug, id } = await params;
  const ctx = await requireCompany(slug);
  const [cal, data] = await Promise.all([
    ctx.db.calendar.findUnique({ where: { id }, include: { availability: true } }),
    loadCalendarFormData(ctx),
  ]);
  if (!cal) notFound();
  const s = parseCalendarSettings(cal.settings);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href={`/${slug}/calendars`} className="text-fg-3 hover:text-fg" aria-label="Torna ai calendari"><ArrowLeft className="w-5 h-5" /></Link>
        <h1 className="text-[22px] font-semibold text-fg" style={{ letterSpacing: "-0.02em" }}>{cal.name}</h1>
      </div>
      <CalendarForm
        slug={slug}
        {...data}
        initial={{
          id: cal.id,
          name: cal.name,
          slug: cal.slug,
          description: cal.description ?? "",
          hostUserId: cal.hostUserId,
          durationMinutes: cal.durationMinutes,
          slotIntervalMinutes: cal.slotIntervalMinutes,
          bufferMinutes: cal.bufferMinutes,
          minAdvanceHours: cal.minAdvanceHours,
          maxAdvanceDays: cal.maxAdvanceDays,
          locationType: cal.locationType,
          locationValue: cal.locationValue ?? "",
          timezone: cal.timezone,
          color: cal.color,
          active: cal.active,
          availability: cal.availability.map(a => ({ dayOfWeek: a.dayOfWeek, startTime: a.startTime, endTime: a.endTime })),
          questions: s.questions ?? [],
          pipelineId: s.pipelineId ?? null,
          stageId: s.stageId ?? null,
          tagIds: s.tagIds ?? [],
        }}
      />
      <CalendarDangerZone slug={slug} id={cal.id} />
    </div>
  );
}
