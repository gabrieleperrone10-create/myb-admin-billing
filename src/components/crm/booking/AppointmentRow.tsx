import Link from "next/link";
import { Video } from "lucide-react";
import type { AppointmentStatus } from "@prisma/client";
import { Badge } from "@/components/ui/Badge";
import { APPOINTMENT_STATUS_LABEL, APPOINTMENT_STATUS_VARIANT, formatDateTimeShort, formatTime } from "@/lib/booking/shared";
import { AppointmentActions } from "./AppointmentActions";

export type AppointmentRowData = {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  status: AppointmentStatus;
  videoLink: string | null;
  cancelReason: string | null;
  contactId: string;
  contactName: string;
  calendarId: string;
  calendarName: string;
  calendarColor: string;
  timezone: string;
  hostName: string | null;
};

/** Riga appuntamento condivisa da agenda e scheda contatto. */
export function AppointmentRow({ slug, a, showContact = true, now }: { slug: string; a: AppointmentRowData; showContact?: boolean; now: number }) {
  const isPast = a.endTime.getTime() < now;
  return (
    <div className="px-4 py-3 flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
      <div className="md:w-44 shrink-0">
        <p className="text-[13px] font-medium text-fg capitalize">{formatDateTimeShort(a.startTime, a.timezone)}</p>
        <p className="text-[11px] text-fg-3">fino alle {formatTime(a.endTime, a.timezone)} · {a.timezone}</p>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: a.calendarColor }} />
          <span className="text-[13px] text-fg">{a.calendarName}</span>
          <Badge variant={APPOINTMENT_STATUS_VARIANT[a.status]}>{APPOINTMENT_STATUS_LABEL[a.status]}</Badge>
          {a.videoLink && (a.status === "SCHEDULED" || a.status === "CONFIRMED") && (
            <a href={a.videoLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] text-info hover:underline">
              <Video className="w-3.5 h-3.5" /> Video
            </a>
          )}
        </div>
        <p className="text-[12px] text-fg-3 mt-0.5 truncate">
          {showContact && (
            <><Link href={`/${slug}/contacts/${a.contactId}?tab=appointments`} className="text-fg-2 hover:underline">{a.contactName}</Link> · </>
          )}
          Host: {a.hostName ?? "—"}
          {a.status === "CANCELLED" && a.cancelReason ? ` · Motivo: ${a.cancelReason}` : ""}
        </p>
      </div>
      <AppointmentActions slug={slug} id={a.id} status={a.status} calendarId={a.calendarId} timezone={a.timezone} isPast={isPast} />
    </div>
  );
}
