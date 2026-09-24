export const dynamic = "force-dynamic";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCompany } from "@/lib/company";
import { loadCalendarFormData } from "@/lib/booking/admin";
import { CalendarForm } from "@/components/crm/booking/CalendarForm";

export default async function NewCalendarPage({ params }: { params: Promise<{ company: string }> }) {
  const { company: slug } = await params;
  const ctx = await requireCompany(slug);
  const data = await loadCalendarFormData(ctx);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href={`/${slug}/calendars`} className="text-fg-3 hover:text-fg" aria-label="Torna ai calendari"><ArrowLeft className="w-5 h-5" /></Link>
        <h1 className="text-[22px] font-semibold text-fg" style={{ letterSpacing: "-0.02em" }}>Nuovo calendario</h1>
      </div>
      <CalendarForm
        slug={slug}
        {...data}
        initial={{
          name: "",
          slug: "",
          description: "",
          hostUserId: ctx.userId,
          durationMinutes: 30,
          slotIntervalMinutes: 30,
          bufferMinutes: 0,
          minAdvanceHours: 2,
          maxAdvanceDays: 60,
          locationType: "VIDEO",
          locationValue: "",
          timezone: ctx.company.timezone || "Europe/Rome",
          color: /^#[0-9a-fA-F]{6}$/.test(ctx.company.brandColor) ? ctx.company.brandColor : "#4f7deb",
          active: true,
          availability: [1, 2, 3, 4, 5].map(d => ({ dayOfWeek: d, startTime: "09:00", endTime: "17:00" })),
          questions: [],
          pipelineId: null,
          stageId: null,
          tagIds: [],
        }}
      />
    </div>
  );
}
