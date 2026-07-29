export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { CalendarDays } from "lucide-react";
import { CreateEventModal } from "./CreateEventModal";
import { EventCard } from "./EventCard";

export default async function EventsPage() {
  const events = await prisma.event.findMany({
    include: { rsvps: true },
    orderBy: { date: "asc" },
  });

  const now = new Date();
  const upcoming = events.filter(e => new Date(e.date) >= now);
  const past = events.filter(e => new Date(e.date) < now);

  return (
    <div className="space-y-6" style={{ maxWidth: 860 }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-semibold" style={{ fontSize: 24, letterSpacing: "-0.02em", color: "var(--fg)" }}>
            Eventi
          </h1>
          <p className="text-[13px]" style={{ color: "var(--fg-3)" }}>
            Live, workshop, webinar e sessioni registrate per il team.
          </p>
        </div>
        <CreateEventModal />
      </div>

      {events.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 rounded-[8px]"
          style={{ border: "1px dashed var(--border)" }}
        >
          <CalendarDays className="w-10 h-10 mb-3" style={{ color: "var(--fg-3)" }} />
          <p className="text-[14px] font-medium" style={{ color: "var(--fg-2)" }}>Nessun evento</p>
          <p className="text-[12px] mt-1" style={{ color: "var(--fg-3)" }}>Crea il primo evento per il team.</p>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div>
              <p className="text-[11px] font-mono font-semibold uppercase tracking-wider mb-3" style={{ color: "#3b9e6a" }}>
                Prossimi · {upcoming.length}
              </p>
              <div className="space-y-3">
                {upcoming.map(event => <EventCard key={event.id} event={event} />)}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <p className="text-[11px] font-mono font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--fg-3)" }}>
                Passati · {past.length}
              </p>
              <div className="space-y-2 opacity-60">
                {past.map(event => <EventCard key={event.id} event={event} past />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
