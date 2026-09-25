"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, RefreshCw, Globe, Mail, Unplug } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/FormField";
import { connectEmailDomain, disconnectEmailDomain, setSenderLocalPart, verifyEmailDomain } from "@/app/actions/emailDomain";
import type { DomainRecord } from "@/lib/email/domains";

type Props = {
  slug: string;
  canEdit: boolean;
  domain: string | null;
  sendingStatus: string | null;
  inboundDomain: string | null;
  inboundStatus: string | null;
  records: DomainRecord[];
  lastCheckedAt: string | null;
  lastError: string | null;
  currentFrom: string | null;
  currentFromName: string;
  currentLocal: string;
  repliesTo: string | null;
  nextAutoCheckAt: string | null;
  ownersNotifiedAt: string | null;
};

const STATUS: Record<string, { label: string; color: string }> = {
  verified: { label: "Verificato", color: "#10b981" },
  pending: { label: "In verifica", color: "#f59e0b" },
  partially_verified: { label: "Parzialmente verificato", color: "#f59e0b" },
  not_started: { label: "Record da inserire", color: "#94a3b8" },
  temporary_failure: { label: "Errore temporaneo", color: "#f59e0b" },
  partially_failed: { label: "Errore su alcuni record", color: "#ef4444" },
  failed: { label: "Non verificato", color: "#ef4444" },
};

function StatusPill({ status }: { status: string | null }) {
  const s = STATUS[status ?? "not_started"] ?? { label: status ?? "—", color: "#94a3b8" };
  return (
    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap" style={{ backgroundColor: `${s.color}1a`, color: s.color }}>
      {s.label}
    </span>
  );
}

function CopyCell({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }); }}
      className="group flex items-start gap-1.5 text-left font-mono text-[11.5px] break-all"
      style={{ color: "var(--fg)" }}
      title="Copia"
    >
      <span>{value}</span>
      {done ? <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "#10b981" }} /> : <Copy className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-40 group-hover:opacity-100" />}
    </button>
  );
}

const card = { backgroundColor: "var(--surface)", border: "1px solid var(--border)" };

export default function EmailDomainClient(p: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [domainInput, setDomainInput] = useState("");
  const [withReceiving, setWithReceiving] = useState(true);
  const [local, setLocal] = useState(p.currentLocal);
  const [fromName, setFromName] = useState(p.currentFromName);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    start(async () => {
      try {
        const r = await fn();
        if (!r.ok) setError(r.error ?? "Operazione non riuscita");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Operazione non riuscita");
      }
      router.refresh();
    });
  };

  const sendingOk = p.sendingStatus === "verified";
  const receivingOk = p.inboundStatus === "verified";
  const pendingVerification = !!p.domain && (!sendingOk || (!!p.inboundDomain && !receivingOk));

  // Finche' il dominio e' in verifica la pagina si aggiorna da sola: il layout
  // esegue in background i controlli automatici scaduti (+5 min, +3 h, +24 h).
  useEffect(() => {
    if (!pendingVerification) return;
    const id = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, 60_000);
    return () => clearInterval(id);
  }, [pendingVerification, router]);

  return (
    <div className="space-y-5">
      {/* Stato attuale */}
      <section className="p-5 rounded-[var(--r-lg)] grid gap-3 sm:grid-cols-2" style={card}>
        <div>
          <p className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: "var(--fg-3)" }}>Le email partono da</p>
          <p className="text-[14px] mt-1 break-all" style={{ color: "var(--fg)" }}>{p.currentFrom ?? "— mittente non configurato —"}</p>
          {!sendingOk && (
            <p className="text-[12px] mt-1" style={{ color: "var(--fg-3)" }}>
              {p.domain ? "Finché il dominio non è verificato si usa il mittente attuale." : "Mittente attuale (predefinito della piattaforma o impostato a mano)."}
            </p>
          )}
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: "var(--fg-3)" }}>Le risposte dei clienti arrivano su</p>
          <p className="text-[14px] mt-1 break-all" style={{ color: "var(--fg)" }}>
            {p.repliesTo ? `c-…@${p.repliesTo}` : "— non attive —"}
          </p>
          <p className="text-[12px] mt-1" style={{ color: "var(--fg-3)" }}>
            {receivingOk
              ? "Sottodominio dell'azienda: le risposte tornano nella scheda contatto."
              : p.repliesTo
                ? "Dominio condiviso della piattaforma."
                : "Senza dominio di ricezione le risposte vanno all'indirizzo di risposta dell'azienda e non compaiono nel CRM."}
          </p>
        </div>
      </section>

      {error && (
        <p className="text-[13px] px-4 py-3 rounded-[var(--r-md)]" style={{ backgroundColor: "#ef44441a", color: "#b91c1c" }}>{error}</p>
      )}

      {!p.domain ? (
        <section className="p-5 rounded-[var(--r-lg)] space-y-4" style={card}>
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4" style={{ color: "var(--fg-2)" }} />
            <h2 className="text-[15px] font-semibold" style={{ color: "var(--fg)" }}>Collega il tuo dominio</h2>
          </div>
          <p className="text-[13px]" style={{ color: "var(--fg-2)" }}>
            Inserisci il dominio del sito (es. <span className="font-mono">tuodominio.it</span>). Ti mostreremo i record DNS da aggiungere:
            stanno su sottodomini dedicati, quindi <strong>la posta aziendale esistente non viene toccata</strong>.
          </p>
          <Input label="Dominio" placeholder="tuodominio.it" value={domainInput} onChange={e => setDomainInput(e.target.value)} disabled={!p.canEdit} />
          <label className="flex items-start gap-2 text-[13px]" style={{ color: "var(--fg-2)" }}>
            <input type="checkbox" className="mt-0.5" checked={withReceiving} onChange={e => setWithReceiving(e.target.checked)} disabled={!p.canEdit} />
            <span>
              Ricevi le risposte dei clienti nel CRM (usa il sottodominio <span className="font-mono">reply.{domainInput.trim() || "tuodominio.it"}</span>)
            </span>
          </label>
          <Button type="button" loading={pending} disabled={!p.canEdit || !domainInput.trim()} onClick={() => run(() => connectEmailDomain(p.slug, domainInput, withReceiving))}>
            Collega dominio
          </Button>
        </section>
      ) : (
        <>
          <section className="p-5 rounded-[var(--r-lg)] space-y-4" style={card}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <Globe className="w-4 h-4" style={{ color: "var(--fg-2)" }} />
                <h2 className="text-[15px] font-semibold font-mono" style={{ color: "var(--fg)" }}>{p.domain}</h2>
                <StatusPill status={p.sendingStatus} />
                {p.inboundDomain && (
                  <>
                    <span className="text-[12px] font-mono" style={{ color: "var(--fg-3)" }}>{p.inboundDomain}</span>
                    <StatusPill status={p.inboundStatus} />
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="secondary" loading={pending} disabled={!p.canEdit}
                  icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={() => run(() => verifyEmailDomain(p.slug))}>
                  Verifica
                </Button>
                <Button type="button" size="sm" variant="ghost" disabled={!p.canEdit || pending} icon={<Unplug className="w-3.5 h-3.5" />}
                  onClick={() => { if (confirm("Scollegare il dominio? Le email torneranno a partire dal mittente predefinito.")) run(() => disconnectEmailDomain(p.slug)); }}>
                  Scollega
                </Button>
              </div>
            </div>

            <p className="text-[13px]" style={{ color: "var(--fg-2)" }}>
              Aggiungi questi record nel pannello DNS del dominio (Cloudflare, Aruba, Register…), poi premi <strong>Verifica</strong>.
              La propagazione può richiedere da pochi minuti ad alcune ore. Su Cloudflare imposta i record come <strong>DNS only</strong> (nuvola grigia).
            </p>

            {p.records.length > 0 ? (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr style={{ color: "var(--fg-3)" }}>
                      <th className="text-left font-medium px-1 py-1.5">Tipo</th>
                      <th className="text-left font-medium px-1 py-1.5">Nome (host)</th>
                      <th className="text-left font-medium px-1 py-1.5">Valore</th>
                      <th className="text-left font-medium px-1 py-1.5">Priorità</th>
                      <th className="text-left font-medium px-1 py-1.5">Stato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.records.map((r, i) => (
                      <tr key={i} className="align-top" style={{ borderTop: "1px solid var(--border)" }}>
                        <td className="px-1 py-2 font-mono">
                          {r.type}
                          <div className="text-[10.5px] font-sans" style={{ color: "var(--fg-3)" }}>{r.scope === "receiving" ? "risposte" : r.record}</div>
                        </td>
                        <td className="px-1 py-2 min-w-[160px]"><CopyCell value={r.host} /></td>
                        <td className="px-1 py-2 min-w-[220px]"><CopyCell value={r.value} /></td>
                        <td className="px-1 py-2 font-mono">{r.priority ?? ""}</td>
                        <td className="px-1 py-2"><StatusPill status={r.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-[13px]" style={{ color: "var(--fg-3)" }}>Record non ancora disponibili: premi Verifica.</p>
            )}

            {pendingVerification && (p.nextAutoCheckAt || p.ownersNotifiedAt) && (
              <p className="text-[12px]" style={{ color: "var(--fg-3)" }}>
                {p.nextAutoCheckAt
                  ? `Controllo automatico: ${new Date(p.nextAutoCheckAt).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })} (poi a 3 ore e 24 ore dal collegamento; se non verificato gli Owner ricevono un'email).`
                  : `Controlli automatici terminati: gli Owner sono stati avvisati via email il ${new Date(p.ownersNotifiedAt!).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}. Puoi sempre premere Verifica.`}
              </p>
            )}
            {(p.lastCheckedAt || p.lastError) && (
              <p className="text-[12px]" style={{ color: p.lastError ? "#b91c1c" : "var(--fg-3)" }}>
                {p.lastError ? `Ultimo controllo con errore: ${p.lastError}` : `Ultimo controllo: ${new Date(p.lastCheckedAt!).toLocaleString("it-IT")}`}
              </p>
            )}
          </section>

          <section className="p-5 rounded-[var(--r-lg)] space-y-4" style={card}>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4" style={{ color: "var(--fg-2)" }} />
              <h2 className="text-[15px] font-semibold" style={{ color: "var(--fg)" }}>Mittente</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Nome mittente" value={fromName} onChange={e => setFromName(e.target.value)} disabled={!p.canEdit} />
              <div className="space-y-1">
                <label className="block text-[12px] font-medium text-fg-2">Indirizzo</label>
                <div className="flex items-center rounded-[var(--r-md)] overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                  <input
                    className="flex-1 min-w-0 px-3 py-2 text-[14px] bg-transparent outline-none"
                    style={{ color: "var(--fg)" }}
                    value={local}
                    onChange={e => setLocal(e.target.value)}
                    disabled={!p.canEdit}
                    aria-label="Parte locale dell'indirizzo"
                  />
                  <span className="px-3 py-2 text-[13px] font-mono" style={{ backgroundColor: "var(--subtle)", color: "var(--fg-3)" }}>@{p.domain}</span>
                </div>
              </div>
            </div>
            <Button type="button" size="sm" loading={pending} disabled={!p.canEdit} onClick={() => run(() => setSenderLocalPart(p.slug, local, fromName))}>
              Salva mittente
            </Button>
            {!sendingOk && (
              <p className="text-[12px]" style={{ color: "var(--fg-3)" }}>Il nuovo mittente entra in uso appena il dominio risulta verificato.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
