"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Link2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { deleteCalendar, disconnectGoogleCalendar, saveReminderRules, toggleCalendarActive } from "@/app/actions/calendars";

export function CopyLinkButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-[12px] font-medium text-info hover:underline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(`${window.location.origin}${path}`);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch { /* clipboard negato */ }
      }}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
      {copied ? "Copiato" : "Copia link"}
    </button>
  );
}

export function ActiveToggle({ slug, id, active }: { slug: string; id: string; active: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className="inline-flex items-center gap-1.5 text-[12px] text-fg-2 cursor-pointer">
      <input
        type="checkbox" checked={active} disabled={pending}
        onChange={e => start(async () => { await toggleCalendarActive(slug, id, e.target.checked); router.refresh(); })}
      />
      Attivo
    </label>
  );
}

export function GoogleDisconnectButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary" size="sm" loading={pending}
      onClick={() => {
        if (!confirm("Scollegare Google Calendar? Gli appuntamenti futuri non verranno più sincronizzati.")) return;
        start(async () => { await disconnectGoogleCalendar(slug); router.refresh(); });
      }}
    >
      Scollega
    </Button>
  );
}

export function CalendarDangerZone({ slug, id }: { slug: string; id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="max-w-3xl border border-danger/30 rounded-[var(--r-lg)] p-5 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
      <div>
        <p className="text-[13px] font-medium text-fg">Elimina calendario</p>
        <p className="text-[12px] text-fg-3">Se ha appuntamenti viene solo disattivato, per non perdere lo storico dei contatti.</p>
        {msg && <p className="text-[12px] text-fg-2 mt-1">{msg}</p>}
      </div>
      <Button
        variant="danger" size="sm" loading={pending}
        onClick={() => {
          if (!confirm("Eliminare questo calendario?")) return;
          start(async () => {
            const r = await deleteCalendar(slug, id);
            if (!r.ok) { setMsg(r.error); return; }
            if (r.data?.deactivated) { setMsg("Il calendario ha appuntamenti: è stato disattivato."); router.refresh(); return; }
            router.push(`/${slug}/calendars`);
            router.refresh();
          });
        }}
      >
        Elimina
      </Button>
    </div>
  );
}

type Rule = { offsetMinutes: number; channel: "EMAIL" | "WHATSAPP"; active: boolean };

const UNITS = [
  { key: "min", label: "minuti", mult: 1 },
  { key: "h", label: "ore", mult: 60 },
  { key: "d", label: "giorni", mult: 1440 },
] as const;

function split(minutes: number): { n: number; unit: (typeof UNITS)[number]["key"] } {
  if (minutes % 1440 === 0) return { n: minutes / 1440, unit: "d" };
  if (minutes % 60 === 0) return { n: minutes / 60, unit: "h" };
  return { n: minutes, unit: "min" };
}

export function ReminderRulesEditor({ slug, initial }: { slug: string; initial: Rule[] }) {
  const router = useRouter();
  const [rules, setRules] = useState<Rule[]>(initial);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  const update = (i: number, patch: Partial<Rule>) => setRules(rs => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const inputCls = "px-2 py-1.5 border border-border rounded-[var(--r-md)] text-[13px] text-fg bg-surface";

  return (
    <div className="space-y-3">
      {rules.length === 0 && <p className="text-[12px] text-fg-3">Nessun promemoria: viene inviata solo l&apos;email di conferma.</p>}
      {rules.map((r, i) => {
        const s = split(r.offsetMinutes);
        return (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <input
              type="number" min={1} className={`${inputCls} w-20`} value={s.n}
              onChange={e => update(i, { offsetMinutes: Math.max(1, Number(e.target.value)) * UNITS.find(u => u.key === s.unit)!.mult })}
            />
            <select
              className={inputCls} value={s.unit}
              onChange={e => update(i, { offsetMinutes: s.n * UNITS.find(u => u.key === e.target.value)!.mult })}
            >
              {UNITS.map(u => <option key={u.key} value={u.key}>{u.label}</option>)}
            </select>
            <span className="text-[13px] text-fg-2">prima, via</span>
            <select className={inputCls} value={r.channel} onChange={e => update(i, { channel: e.target.value as Rule["channel"] })}>
              <option value="EMAIL">Email</option>
              <option value="WHATSAPP">WhatsApp (in arrivo)</option>
            </select>
            <label className="flex items-center gap-1 text-[12px] text-fg-2">
              <input type="checkbox" checked={r.active} onChange={e => update(i, { active: e.target.checked })} /> attivo
            </label>
            <button type="button" className="p-1.5 text-fg-3 hover:text-danger" aria-label="Rimuovi" onClick={() => setRules(rs => rs.filter((_, j) => j !== i))}>
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
      {rules.some(r => r.channel === "WHATSAPP") && (
        <p className="text-[12px] text-warn">WhatsApp è in arrivo: per ora questi promemoria vengono registrati come &quot;non configurato&quot; e non partono.</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => setRules(rs => [...rs, { offsetMinutes: rs.length ? 60 : 1440, channel: "EMAIL", active: true }])}>
          Aggiungi promemoria
        </Button>
        <Button type="button" size="sm" loading={pending}
          onClick={() => start(async () => {
            const r = await saveReminderRules(slug, rules);
            setStatus(r.ok ? "Salvato" : r.error);
            if (r.ok) router.refresh();
          })}>
          Salva promemoria
        </Button>
        {status && <span className="text-[12px] text-fg-3">{status}</span>}
      </div>
    </div>
  );
}
