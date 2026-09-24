"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, AlertTriangle, Mail, MessageCircle, Send } from "lucide-react";
import {
  getConversationTemplates,
  sendConversationEmail,
  sendConversationWhatsApp,
  sendConversationWhatsAppTemplate,
} from "@/app/actions/conversations";
import type { WhatsAppTemplate } from "@/lib/crm/messaging/whatsapp";
import type { ConversationData } from "./data";
import { formatFull } from "./format";

type Channel = "EMAIL" | "WHATSAPP";

const fieldCls =
  "w-full px-3 py-2 border border-border rounded-[var(--r-md)] text-[13px] text-fg bg-surface focus:outline-none focus:border-info focus:ring-3 focus:ring-info-soft placeholder:text-fg-3";

function renderTemplate(body: string, params: string[]) {
  return body.replace(/\{\{\s*(\d+)\s*\}\}/g, (m, n) => params[Number(n) - 1] || m);
}

export default function Composer({ slug, data }: { slug: string; data: ConversationData }) {
  const router = useRouter();
  const { channels } = data;

  const defaultChannel = useMemo<Channel>(() => {
    const lastIn = [...data.messages].reverse().find(m => m.direction === "INBOUND");
    if (lastIn && channels[lastIn.channel].enabled) return lastIn.channel;
    if (channels.EMAIL.enabled) return "EMAIL";
    if (channels.WHATSAPP.enabled) return "WHATSAPP";
    return "EMAIL";
    // solo al primo render: il canale scelto dall'utente non va sovrascritto dai refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const lastSubject = useMemo(
    () => [...data.messages].reverse().find(m => m.channel === "EMAIL" && m.subject)?.subject ?? "",
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [channel, setChannel] = useState<Channel>(defaultChannel);
  const [subject, setSubject] = useState(lastSubject ? (/^re:/i.test(lastSubject) ? lastSubject : `Re: ${lastSubject}`) : "");
  const [body, setBody] = useState("");
  const [html, setHtml] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  // Template WhatsApp (solo fuori finestra 24h), caricati una volta su richiesta
  const [templates, setTemplates] = useState<WhatsAppTemplate[] | null>(null);
  const [tplError, setTplError] = useState<string | null>(null);
  const [tplKey, setTplKey] = useState("");
  const [params, setParams] = useState<string[]>([]);

  const wa = channels.WHATSAPP;
  const needsTemplate = channel === "WHATSAPP" && wa.enabled && !wa.insideWindow;

  useEffect(() => {
    if (!needsTemplate || templates !== null || !data.canSend) return;
    let cancelled = false;
    getConversationTemplates(slug).then(res => {
      if (cancelled) return;
      if (res.ok) setTemplates(res.templates);
      else { setTemplates([]); setTplError(res.error); }
    }).catch(() => { if (!cancelled) { setTemplates([]); setTplError("Impossibile leggere i template"); } });
    return () => { cancelled = true; };
  }, [needsTemplate, templates, slug, data.canSend]);

  const tpl = templates?.find(t => `${t.name}|${t.language}` === tplKey) ?? null;

  if (!data.canSend) {
    return (
      <p className="text-[12px] px-3 py-3" style={{ color: "var(--fg-3)" }}>
        Non hai i permessi per inviare messaggi (sezione Conversazioni).
      </p>
    );
  }

  const current = channels[channel];
  const reset = () => {
    setBody("");
    setParams(tpl ? Array(tpl.paramCount).fill("") : []);
    setSent(true);
    setTimeout(() => setSent(false), 2500);
    router.refresh();
  };

  const submit = () => {
    setError(null);
    startTransition(async () => {
      try {
        let res: { ok: boolean; error?: string };
        if (channel === "EMAIL") {
          res = await sendConversationEmail(slug, { contactId: data.contactId, subject, body, format: html ? "html" : "text" });
        } else if (needsTemplate) {
          if (!tpl) { setError("Scegli un template"); return; }
          res = await sendConversationWhatsAppTemplate(slug, {
            contactId: data.contactId, templateName: tpl.name, language: tpl.language, bodyParams: params,
          });
        } else {
          res = await sendConversationWhatsApp(slug, { contactId: data.contactId, text: body });
        }
        if (res.ok) reset();
        else setError(res.error ?? "Invio non riuscito");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Invio non riuscito");
      }
    });
  };

  const canSubmit =
    current.enabled && !pending &&
    (channel === "EMAIL"
      ? subject.trim() && body.trim()
      : needsTemplate
        ? tpl && params.length === tpl.paramCount && params.every(p => p.trim())
        : body.trim());

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canSubmit) {
      e.preventDefault();
      submit();
    }
  };

  const tabs: { key: Channel; label: string; Icon: typeof Mail }[] = [
    { key: "EMAIL", label: "Email", Icon: Mail },
    { key: "WHATSAPP", label: "WhatsApp", Icon: MessageCircle },
  ];

  return (
    <div className="p-3 space-y-2" style={{ borderTop: "1px solid var(--border)", backgroundColor: "var(--surface)" }}>
      <div className="flex items-center gap-1" role="tablist" aria-label="Canale">
        {tabs.map(({ key, label, Icon }) => {
          const on = channel === key;
          const st = channels[key];
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => { setChannel(key); setError(null); }}
              title={st.enabled ? undefined : st.reason}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--r-md)] text-[12px] font-medium transition-colors"
              style={{
                backgroundColor: on ? "var(--subtle)" : "transparent",
                color: on ? "var(--fg)" : "var(--fg-3)",
                opacity: st.enabled ? 1 : 0.55,
                border: `1px solid ${on ? "var(--border)" : "transparent"}`,
              }}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          );
        })}
      </div>

      {!current.enabled ? (
        <p className="flex items-start gap-1.5 text-[12px] py-2" style={{ color: "var(--fg-3)" }}>
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {current.reason ?? "Canale non disponibile"}
        </p>
      ) : channel === "EMAIL" ? (
        <div className="space-y-2">
          <input
            className={fieldCls}
            placeholder="Oggetto"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            maxLength={300}
            aria-label="Oggetto"
          />
          <textarea
            className={`${fieldCls} resize-y min-h-[88px]`}
            placeholder={html ? "<p>Contenuto HTML…</p>" : `Scrivi a ${data.email ?? "contatto"}…`}
            value={body}
            onChange={e => setBody(e.target.value)}
            onKeyDown={onKeyDown}
            rows={4}
            aria-label="Messaggio"
          />
          <label className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: "var(--fg-2)" }}>
            <input type="checkbox" checked={html} onChange={e => setHtml(e.target.checked)} /> Scrivi in HTML
          </label>
        </div>
      ) : needsTemplate ? (
        <div className="space-y-2">
          <p
            className="flex items-start gap-1.5 text-[12px] px-2.5 py-2 rounded-[var(--r-md)]"
            style={{ backgroundColor: "var(--warn-soft)", color: "var(--fg-2)" }}
          >
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--warn)" }} />
            <span>
              Sono passate più di 24 ore dall&apos;ultimo messaggio del contatto
              {wa.windowEndsAt ? ` (finestra chiusa il ${formatFull(wa.windowEndsAt)})` : " (non ha mai scritto)"}: WhatsApp consente solo template approvati.
            </span>
          </p>
          {templates === null ? (
            <p className="text-[12px]" style={{ color: "var(--fg-3)" }}>Caricamento template…</p>
          ) : templates.length === 0 ? (
            <p className="text-[12px]" style={{ color: "var(--fg-3)" }}>
              {tplError ?? "Nessun template approvato nel tuo account WhatsApp Business."}
            </p>
          ) : (
            <>
              <select
                className={fieldCls}
                value={tplKey}
                onChange={e => {
                  setTplKey(e.target.value);
                  const t = templates.find(x => `${x.name}|${x.language}` === e.target.value);
                  setParams(t ? Array(t.paramCount).fill("") : []);
                }}
                aria-label="Template"
              >
                <option value="">Scegli un template…</option>
                {templates.map(t => (
                  <option key={`${t.name}|${t.language}`} value={`${t.name}|${t.language}`}>
                    {t.name} ({t.language})
                  </option>
                ))}
              </select>
              {tpl && (
                <>
                  {params.map((p, i) => (
                    <input
                      key={i}
                      className={fieldCls}
                      placeholder={`Parametro {{${i + 1}}}`}
                      value={p}
                      onChange={e => setParams(prev => prev.map((x, j) => (j === i ? e.target.value : x)))}
                      aria-label={`Parametro ${i + 1}`}
                    />
                  ))}
                  <p
                    className="text-[12px] whitespace-pre-wrap px-2.5 py-2 rounded-[var(--r-md)]"
                    style={{ backgroundColor: "var(--subtle)", color: "var(--fg-2)" }}
                  >
                    {renderTemplate(tpl.bodyText, params) || `[Template ${tpl.name}]`}
                  </p>
                </>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          <textarea
            className={`${fieldCls} resize-y min-h-[72px]`}
            placeholder="Scrivi un messaggio WhatsApp…"
            value={body}
            onChange={e => setBody(e.target.value)}
            onKeyDown={onKeyDown}
            rows={3}
            maxLength={4096}
            aria-label="Messaggio WhatsApp"
          />
          {wa.windowEndsAt && (
            <p className="text-[11px]" style={{ color: "var(--fg-3)" }}>
              Finestra di risposta libera aperta fino al {formatFull(wa.windowEndsAt)}
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 text-[12px]">
          {error && (
            <span className="flex items-start gap-1" style={{ color: "var(--danger)" }}>
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {error}
            </span>
          )}
          {sent && !error && <span style={{ color: "var(--ok)" }}>Inviato</span>}
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="inline-flex items-center gap-1.5 px-3 py-[7px] rounded-[var(--r-md)] text-[13px] font-medium bg-fg text-white hover:bg-fg/90 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          title="Invia (Ctrl/⌘ + Invio)"
        >
          <Send className="w-3.5 h-3.5" /> {pending ? "Invio…" : "Invia"}
        </button>
      </div>
    </div>
  );
}
