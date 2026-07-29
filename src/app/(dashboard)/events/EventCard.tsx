"use client";
import { useState } from "react";
import { deleteEvent } from "@/app/actions/events";
import { EditEventModal } from "./EditEventModal";
import {
  CalendarDays, MapPin, Video, Radio, BookOpen, Film,
  Users2, Trash2, CalendarPlus, RefreshCw,
} from "lucide-react";
import type { Event, EventRsvp, EventType, RecurrenceType } from "@prisma/client";

type EventWithRsvps = Event & { rsvps: EventRsvp[] };

const TYPE_LABELS: Record<EventType, string> = {
  LIVE: "Live", WORKSHOP: "Workshop", RECORDING: "Registrazione", WEBINAR: "Webinar",
};
const TYPE_ICONS: Record<EventType, React.ElementType> = {
  LIVE: Radio, WORKSHOP: BookOpen, RECORDING: Film, WEBINAR: Video,
};
const TYPE_COLORS: Record<EventType, string> = {
  LIVE: "#dc2626", WORKSHOP: "#8b5cf6", RECORDING: "#6b7280", WEBINAR: "#4f7deb",
};
const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  ONE_TIME: "", DAILY: "Giornaliero", WEEKLY: "Settimanale", MONTHLY: "Mensile", CUSTOM: "Personalizzato",
};

function toGoogleDate(d: Date) {
  return new Date(d).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function buildGoogleCalendarUrl(event: EventWithRsvps) {
  const start = toGoogleDate(event.date);
  const end = event.endDate
    ? toGoogleDate(event.endDate)
    : toGoogleDate(new Date(new Date(event.date).getTime() + 3600000));
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${start}/${end}`,
    ...(event.description ? { details: event.description } : {}),
    ...(event.location ? { location: event.location } : {}),
    ...(event.meetUrl ? { details: (event.description ? event.description + "\n\n" : "") + "Link: " + event.meetUrl } : {}),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("it-IT", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(d));
}

export function EventCard({ event, past = false }: { event: EventWithRsvps; past?: boolean }) {
  const [deleting, setDeleting] = useState(false);
  const Icon = TYPE_ICONS[event.type];
  const color = TYPE_COLORS[event.type];
  const recLabel = RECURRENCE_LABELS[event.recurrence];
  const gcalUrl = buildGoogleCalendarUrl(event);

  async function handleDelete() {
    if (!confirm(`Eliminare "${event.title}"?`)) return;
    setDeleting(true);
    await deleteEvent(event.id);
  }

  return (
    <div
      className="rounded-[var(--r-lg)] p-4"
      style={{
        backgroundColor: "var(--surface)",
        border: `1px solid ${past ? "var(--border)" : color + "30"}`,
        opacity: deleting ? 0.5 : 1,
        transition: "opacity 0.2s",
      }}
    >
      {/* Top row: icon + title + type badge + edit/delete */}
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0"
          style={{ backgroundColor: color + "15" }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                <p className="text-[15px] font-semibold" style={{ color: "var(--fg)" }}>{event.title}</p>
                <span
                  className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider badge"
                  style={{ backgroundColor: color + "18", color }}
                >
                  {TYPE_LABELS[event.type]}
                </span>
                {recLabel && (
                  <span className="flex items-center gap-0.5 text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-full uppercase badge" style={{ backgroundColor: "#4f7deb18", color: "#4f7deb" }}>
                    <RefreshCw className="w-2.5 h-2.5" />
                    {recLabel}{event.recurrence === "CUSTOM" && event.recurrenceInterval ? ` ogni ${event.recurrenceInterval}gg` : ""}
                  </span>
                )}
                {!event.published && (
                  <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-full uppercase badge" style={{ backgroundColor: "#f9741618", color: "#c2590a" }}>bozza</span>
                )}
              </div>

              {event.description && (
                <p className="text-[13px] mt-0.5" style={{ color: "var(--fg-3)" }}>{event.description}</p>
              )}
            </div>

            {/* Edit + Delete — always visible, compact */}
            <div className="flex items-center gap-1 shrink-0">
              <EditEventModal event={event} />
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center justify-center rounded-[var(--r-md)]"
                style={{
                  border: "1px solid var(--border)",
                  color: "#dc2626",
                  width: 34,
                  height: 34,
                  minHeight: "unset",
                  minWidth: "unset",
                }}
                title="Elimina evento"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Meta info */}
          <div className="flex items-center gap-3 flex-wrap mt-2 text-[12px]" style={{ color: "var(--fg-3)" }}>
            <span className="flex items-center gap-1">
              <CalendarDays className="w-3.5 h-3.5 shrink-0" />
              {fmtDate(event.date)}
              {event.endDate && <> — {fmtDate(event.endDate)}</>}
            </span>
            {event.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 shrink-0" /> {event.location}
              </span>
            )}
            {event.meetUrl && (
              <a
                href={event.meetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 underline"
                style={{ color: "#4f7deb", minHeight: "unset" }}
              >
                <Video className="w-3.5 h-3.5 shrink-0" /> Link meeting
              </a>
            )}
            <span className="flex items-center gap-1">
              <Users2 className="w-3.5 h-3.5 shrink-0" /> {event.rsvps.length} RSVP
            </span>
          </div>

          {/* Calendar button — full row on mobile, stays inline on desktop */}
          {!past && (
            <div className="mt-3">
              <a
                href={gcalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[var(--r-md)] text-[12px] font-semibold transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: "#4285f4",
                  color: "#fff",
                  minHeight: "unset",
                }}
              >
                <CalendarPlus className="w-3.5 h-3.5 shrink-0" />
                Aggiungi al calendario Google
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
