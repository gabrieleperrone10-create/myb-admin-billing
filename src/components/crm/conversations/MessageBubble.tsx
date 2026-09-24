"use client";

import { useState } from "react";
import {
  AlertCircle, Check, CheckCheck, Clock, Eye, FileText, Mail, MessageCircle, MousePointerClick, Paperclip,
} from "lucide-react";
import type { ThreadMessage } from "./data";
import { formatFull, formatTime } from "./format";

export function ChannelBadge({ channel }: { channel: ThreadMessage["channel"] }) {
  const isEmail = channel === "EMAIL";
  const Icon = isEmail ? Mail : MessageCircle;
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
      style={{
        backgroundColor: isEmail ? "var(--info-soft)" : "var(--ok-soft)",
        color: isEmail ? "var(--info)" : "var(--ok)",
      }}
    >
      <Icon className="w-3 h-3" />
      {isEmail ? "Email" : "WhatsApp"}
    </span>
  );
}

function OutboundStatus({ m }: { m: ThreadMessage }) {
  const items: React.ReactNode[] = [];
  const S = "inline-flex items-center gap-0.5";
  switch (m.status) {
    case "QUEUED":
      items.push(<span key="s" className={S}><Clock className="w-3 h-3" /> In invio</span>);
      break;
    case "SENT":
      items.push(<span key="s" className={S} title="Inviato"><Check className="w-3.5 h-3.5" /> Inviato</span>);
      break;
    case "DELIVERED":
      items.push(<span key="s" className={S} title={m.deliveredAt ? `Consegnato ${formatFull(m.deliveredAt)}` : "Consegnato"}><CheckCheck className="w-3.5 h-3.5" /> Consegnato</span>);
      break;
    case "READ":
      items.push(
        <span key="s" className={S} style={{ color: "var(--info)" }} title={m.readAt ? `Letto ${formatFull(m.readAt)}` : "Letto"}>
          <CheckCheck className="w-3.5 h-3.5" /> Letto
        </span>,
      );
      break;
    case "FAILED":
      items.push(<span key="s" className={S} style={{ color: "var(--danger)" }}><AlertCircle className="w-3 h-3" /> Non inviato</span>);
      break;
  }
  if (m.channel === "EMAIL" && m.openedAt) {
    items.push(<span key="o" className={S} style={{ color: "var(--info)" }} title={`Aperta ${formatFull(m.openedAt)}`}><Eye className="w-3 h-3" /> Aperta</span>);
  }
  if (m.channel === "EMAIL" && m.clickedAt) {
    items.push(<span key="c" className={S} style={{ color: "var(--info)" }} title={`Cliccata ${formatFull(m.clickedAt)}`}><MousePointerClick className="w-3 h-3" /> Cliccata</span>);
  }
  return <>{items}</>;
}

export default function MessageBubble({ m }: { m: ThreadMessage }) {
  const out = m.direction === "OUTBOUND";
  const [showHtml, setShowHtml] = useState(false);

  return (
    <div className={`flex ${out ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[88%] sm:max-w-[75%] min-w-0">
        <div
          className="rounded-[var(--r-lg)] px-3 py-2"
          style={{
            backgroundColor: out ? "var(--info-soft)" : "var(--surface)",
            border: `1px solid ${m.status === "FAILED" ? "var(--danger)" : "var(--border)"}`,
            borderBottomRightRadius: out ? 4 : undefined,
            borderBottomLeftRadius: out ? undefined : 4,
          }}
        >
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <ChannelBadge channel={m.channel} />
            {m.template && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "var(--subtle)", color: "var(--fg-2)" }}>
                <FileText className="w-3 h-3" /> Template
              </span>
            )}
            {out && m.sentBy && <span className="text-[11px]" style={{ color: "var(--fg-3)" }}>{m.sentBy}</span>}
          </div>
          {m.subject && (
            <p className="text-[13px] font-semibold mb-1 break-words" style={{ color: "var(--fg)" }}>{m.subject}</p>
          )}
          <p className="text-[13px] whitespace-pre-wrap break-words" style={{ color: "var(--fg)", lineHeight: 1.5 }}>
            {m.text || <span style={{ color: "var(--fg-3)" }}>(nessun testo)</span>}
          </p>
          {m.attachments.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {m.attachments.map((a, i) => (
                <li key={i} className="flex items-center gap-1 text-[11px]" style={{ color: "var(--fg-2)" }}>
                  <Paperclip className="w-3 h-3" /> {a}
                </li>
              ))}
            </ul>
          )}
          {m.html && (
            <div className="mt-1.5">
              <button type="button" onClick={() => setShowHtml(v => !v)} className="text-[11px] underline" style={{ color: "var(--fg-3)" }}>
                {showHtml ? "Nascondi originale" : "Mostra originale"}
              </button>
              {showHtml && (
                // sandbox vuoto: niente script, form, popup ne' accesso all'origine dell'app.
                // L'HTML delle email in entrata e' contenuto di terzi non fidato.
                <iframe
                  title="Email originale"
                  sandbox=""
                  srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">${m.html}`}
                  className="mt-1.5 w-full h-[360px] rounded-[var(--r-md)] bg-white"
                  style={{ border: "1px solid var(--border)" }}
                />
              )}
            </div>
          )}
          {m.status === "FAILED" && m.error && (
            <p className="mt-1.5 text-[11px]" style={{ color: "var(--danger)" }}>{m.error}</p>
          )}
        </div>
        <div
          className={`flex items-center gap-2 mt-0.5 text-[11px] flex-wrap ${out ? "justify-end" : "justify-start"}`}
          style={{ color: "var(--fg-3)" }}
        >
          <span title={formatFull(m.createdAt)}>{formatTime(m.createdAt)}</span>
          {out && <OutboundStatus m={m} />}
        </div>
      </div>
    </div>
  );
}
