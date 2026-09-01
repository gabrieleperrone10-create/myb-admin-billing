"use client";
import { useState } from "react";
import { createEvent } from "@/app/actions/events";
import { Plus, X } from "lucide-react";
import { EventFormFields } from "./EventFormFields";
import type { EventType, RecurrenceType } from "@prisma/client";

function parseForm(fd: FormData) {
  return {
    title: fd.get("title") as string,
    type: fd.get("type") as EventType,
    date: new Date(fd.get("date") as string),
    endDate: fd.get("endDate") ? new Date(fd.get("endDate") as string) : undefined,
    description: (fd.get("description") as string) || undefined,
    location: (fd.get("location") as string) || undefined,
    meetUrl: (fd.get("meetUrl") as string) || undefined,
    recurrence: (fd.get("recurrence") as RecurrenceType) ?? "ONE_TIME",
    recurrenceInterval: fd.get("recurrenceInterval") ? parseInt(fd.get("recurrenceInterval") as string) : undefined,
    recurrenceEndDate: fd.get("recurrenceEndDate") ? new Date(fd.get("recurrenceEndDate") as string) : undefined,
    published: true,
  };
}

export function CreateEventModal() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    await createEvent(parseForm(new FormData(e.currentTarget)));
    setLoading(false);
    setOpen(false);
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[13px] font-medium" style={{ backgroundColor: "var(--fg)", color: "#fff" }}>
        <Plus className="w-3.5 h-3.5" /> Nuovo evento
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
          <div className="w-full max-w-lg rounded-[10px] p-6" style={{ backgroundColor: "#fff", border: "1px solid var(--border)", maxHeight: "90vh", overflowY: "auto" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-semibold" style={{ color: "var(--fg)" }}>Nuovo evento</h2>
              <button onClick={() => setOpen(false)}><X className="w-4 h-4" style={{ color: "var(--fg-3)" }} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <EventFormFields />
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2 rounded-[6px] text-[13px]" style={{ border: "1px solid var(--border)", color: "var(--fg-2)" }}>
                  Annulla
                </button>
                <button type="submit" disabled={loading} className="flex-1 py-2 rounded-[6px] text-[13px] font-medium" style={{ backgroundColor: "var(--fg)", color: "#fff" }}>
                  {loading ? "..." : "Crea evento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
