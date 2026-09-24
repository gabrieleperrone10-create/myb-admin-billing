"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, CheckCheck, UserX, X } from "lucide-react";
import type { AppointmentStatus } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { bookForContact, cancelAppointmentAdmin, getAdminSlots, rescheduleAppointmentAdmin, updateAppointmentStatus } from "@/app/actions/appointments";
import { formatDateTimeLong } from "@/lib/booking/shared";
import { SlotPicker, type FetchSlots } from "./SlotPicker";

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-surface w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-[var(--r-lg)] sm:rounded-[var(--r-lg)] border border-border p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-semibold text-fg">{title}</h3>
          <button type="button" onClick={onClose} className="p-1 text-fg-3 hover:text-fg" aria-label="Chiudi"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function RescheduleDialog({ slug, appointmentId, calendarId, timezone, onClose }: {
  slug: string; appointmentId: string; calendarId: string; timezone: string; onClose: () => void;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [tz, setTz] = useState(timezone);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [pending, start] = useTransition();

  const fetchSlots = useCallback<FetchSlots>(async (from, to, zone) => {
    const r = await getAdminSlots(slug, calendarId, from, to, zone, appointmentId);
    return r.ok ? { days: r.data!.days } : { error: r.error };
  }, [slug, calendarId, appointmentId]);

  return (
    <Modal title="Sposta appuntamento" onClose={onClose}>
      <SlotPicker variant="admin" fetchSlots={fetchSlots} initialTimezone={timezone} selected={selected}
        onSelect={(iso, zone) => { setSelected(iso); setTz(zone); }} reloadKey={reloadKey} accentColor="#4f7deb" />
      {error && <p className="mt-3 text-[12px] text-danger">{error}</p>}
      <div className="mt-4 flex gap-2">
        <Button disabled={!selected} loading={pending} onClick={() => selected && start(async () => {
          const r = await rescheduleAppointmentAdmin(slug, appointmentId, selected);
          if (!r.ok) { setError(r.error); setSelected(null); setReloadKey(k => k + 1); return; }
          onClose();
          router.refresh();
        })}>
          {selected ? `Sposta a ${formatDateTimeLong(selected, tz)}` : "Scegli un orario"}
        </Button>
        <Button variant="secondary" onClick={onClose}>Annulla</Button>
      </div>
    </Modal>
  );
}

function CancelDialog({ slug, appointmentId, onClose }: { slug: string; appointmentId: string; onClose: () => void }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Modal title="Annulla appuntamento" onClose={onClose}>
      <label className="block text-[12px] font-medium text-fg-2 mb-1">Motivo</label>
      <textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} maxLength={500}
        className="w-full px-3 py-2 border border-border rounded-[var(--r-md)] text-[13px] text-fg bg-surface" />
      <label className="mt-3 flex items-center gap-2 text-[13px] text-fg-2">
        <input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} /> Avvisa il contatto via email
      </label>
      {error && <p className="mt-3 text-[12px] text-danger">{error}</p>}
      <div className="mt-4 flex gap-2">
        <Button variant="danger" loading={pending} onClick={() => start(async () => {
          const r = await cancelAppointmentAdmin(slug, appointmentId, reason, notify);
          if (!r.ok) { setError(r.error); return; }
          onClose();
          router.refresh();
        })}>Annulla appuntamento</Button>
        <Button variant="secondary" onClick={onClose}>Indietro</Button>
      </div>
    </Modal>
  );
}

/** Azioni di stato su un appuntamento (agenda e scheda contatto). */
export function AppointmentActions({ slug, id, status, calendarId, timezone, isPast }: {
  slug: string; id: string; status: AppointmentStatus; calendarId: string; timezone: string; isPast: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [dialog, setDialog] = useState<"cancel" | "reschedule" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setStatus = (s: "SCHEDULED" | "CONFIRMED" | "COMPLETED" | "NO_SHOW") => start(async () => {
    setError(null);
    const r = await updateAppointmentStatus(slug, id, s);
    if (!r.ok) setError(r.error);
    else router.refresh();
  });

  const active = status === "SCHEDULED" || status === "CONFIRMED";
  const btn = "inline-flex items-center gap-1 px-2 py-1 rounded-[var(--r-md)] text-[11px] font-medium border border-border text-fg-2 hover:bg-subtle hover:text-fg disabled:opacity-40";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {status === "SCHEDULED" && !isPast && (
        <button type="button" className={btn} disabled={pending} onClick={() => setStatus("CONFIRMED")}><Check className="w-3 h-3" /> Conferma</button>
      )}
      {active && (
        <>
          <button type="button" className={btn} disabled={pending} onClick={() => setStatus("COMPLETED")}><CheckCheck className="w-3 h-3" /> Svolto</button>
          <button type="button" className={btn} disabled={pending} onClick={() => setStatus("NO_SHOW")}><UserX className="w-3 h-3" /> Non presentato</button>
          {!isPast && <button type="button" className={btn} disabled={pending} onClick={() => setDialog("reschedule")}><CalendarClock className="w-3 h-3" /> Sposta</button>}
          <button type="button" className={`${btn} hover:text-danger`} disabled={pending} onClick={() => setDialog("cancel")}><X className="w-3 h-3" /> Annulla</button>
        </>
      )}
      {(status === "COMPLETED" || status === "NO_SHOW") && (
        <button type="button" className={btn} disabled={pending} onClick={() => setStatus("SCHEDULED")}>Ripristina</button>
      )}
      {error && <span className="text-[11px] text-danger">{error}</span>}
      {dialog === "cancel" && <CancelDialog slug={slug} appointmentId={id} onClose={() => setDialog(null)} />}
      {dialog === "reschedule" && (
        <RescheduleDialog slug={slug} appointmentId={id} calendarId={calendarId} timezone={timezone} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

/** "Prenota per questo contatto": calendario → slot → crea (stessa logica della pagina pubblica). */
export function BookForContact({ slug, contactId, calendars, hasEmail }: {
  slug: string; contactId: string; calendars: { id: string; name: string; timezone: string; active: boolean }[]; hasEmail: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [calendarId, setCalendarId] = useState(calendars.find(c => c.active)?.id ?? calendars[0]?.id ?? "");
  const [selected, setSelected] = useState<string | null>(null);
  const [tz, setTz] = useState(calendars[0]?.timezone ?? "Europe/Rome");
  const [notes, setNotes] = useState("");
  const [notify, setNotify] = useState(hasEmail);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [pending, start] = useTransition();
  const cal = calendars.find(c => c.id === calendarId);

  const fetchSlots = useCallback<FetchSlots>(async (from, to, zone) => {
    if (!calendarId) return { days: {} };
    const r = await getAdminSlots(slug, calendarId, from, to, zone, null);
    return r.ok ? { days: r.data!.days } : { error: r.error };
  }, [slug, calendarId]);

  if (!calendars.length) {
    return <a href={`/${slug}/calendars/new`} className="text-[12px] text-info hover:underline">Crea un calendario per prenotare</a>;
  }

  return (
    <>
      <Button size="sm" icon={<CalendarClock className="w-3.5 h-3.5" />} onClick={() => setOpen(true)}>Prenota per questo contatto</Button>
      {open && (
        <Modal title="Nuovo appuntamento" onClose={() => setOpen(false)}>
          <label className="block text-[12px] font-medium text-fg-2 mb-1">Calendario</label>
          <select value={calendarId} onChange={e => { setCalendarId(e.target.value); setSelected(null); }}
            className="w-full mb-4 px-3 py-2 border border-border rounded-[var(--r-md)] text-[13px] text-fg bg-surface">
            {calendars.map(c => <option key={c.id} value={c.id}>{c.name}{c.active ? "" : " (disattivato)"}</option>)}
          </select>
          {cal && (
            <SlotPicker key={cal.id} variant="admin" fetchSlots={fetchSlots} initialTimezone={cal.timezone} selected={selected}
              onSelect={(iso, zone) => { setSelected(iso); setTz(zone); }} reloadKey={reloadKey} accentColor="#4f7deb" />
          )}
          <label className="block text-[12px] font-medium text-fg-2 mt-4 mb-1">Note interne</label>
          <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-[var(--r-md)] text-[13px] text-fg bg-surface" />
          <label className="mt-3 flex items-center gap-2 text-[13px] text-fg-2">
            <input type="checkbox" checked={notify} disabled={!hasEmail} onChange={e => setNotify(e.target.checked)} />
            Invia conferma via email{!hasEmail ? " (il contatto non ha email)" : ""}
          </label>
          {error && <p className="mt-3 text-[12px] text-danger">{error}</p>}
          <div className="mt-4 flex gap-2">
            <Button disabled={!selected} loading={pending} onClick={() => selected && start(async () => {
              setError(null);
              const r = await bookForContact(slug, { calendarId, contactId, startTime: selected, notes, notifyContact: notify });
              if (!r.ok) { setError(r.error); setSelected(null); setReloadKey(k => k + 1); return; }
              setOpen(false);
              setSelected(null);
              router.refresh();
            })}>
              {selected ? `Prenota ${formatDateTimeLong(selected, tz)}` : "Scegli un orario"}
            </Button>
            <Button variant="secondary" onClick={() => setOpen(false)}>Annulla</Button>
          </div>
        </Modal>
      )}
    </>
  );
}

