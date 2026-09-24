"use client";

import { Fragment, useEffect, useRef } from "react";
import { MessagesSquare } from "lucide-react";
import { markConversationRead } from "@/app/actions/conversations";
import type { ConversationData } from "./data";
import AutoRefresh from "./AutoRefresh";
import Composer from "./Composer";
import MessageBubble from "./MessageBubble";
import { dayKey, formatDay } from "./format";

/**
 * Thread + composer. Usato sia dalla tab della scheda contatto sia dalla
 * casella /conversations. Aggiornamento: router.refresh() ogni 15s mentre la
 * pagina e' visibile (niente websocket), piu' revalidatePath dopo ogni invio.
 */
export default function ConversationPanel({
  slug,
  data,
  variant = "tab",
}: {
  slug: string;
  data: ConversationData;
  variant?: "tab" | "inbox";
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const lastId = data.messages.at(-1)?.id;

  // Aprire la conversazione azzera i non letti (anche quelli arrivati durante un refresh)
  useEffect(() => {
    if (data.canView && data.unreadCount > 0) {
      markConversationRead(slug, data.contactId).catch(() => {});
    }
  }, [slug, data.contactId, data.unreadCount, data.canView]);

  // Scorre in fondo all'apertura e ai nuovi messaggi, se l'utente era gia' in fondo
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [lastId, data.contactId]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const heightCls = variant === "inbox" ? "flex-1 min-h-0" : "h-[55vh] min-h-[320px]";

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-[var(--r-lg)] ${variant === "inbox" ? "h-full" : ""}`}
      style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg)" }}
    >
      <AutoRefresh />
      <div ref={scrollRef} onScroll={onScroll} className={`${heightCls} overflow-y-auto px-3 py-4 space-y-3`}>
        {!data.canView ? (
          <p className="text-[13px] text-center py-10" style={{ color: "var(--fg-3)" }}>
            Non hai i permessi per vedere le conversazioni.
          </p>
        ) : data.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center h-full py-10 gap-2" style={{ color: "var(--fg-3)" }}>
            <MessagesSquare className="w-8 h-8" />
            <p className="text-[13px]">Nessun messaggio con {data.name}.</p>
            <p className="text-[12px]">Scrivi il primo qui sotto.</p>
          </div>
        ) : (
          data.messages.map((m, i) => {
            const prev = data.messages[i - 1];
            const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
            return (
              <Fragment key={m.id}>
                {newDay && (
                  <div className="flex justify-center">
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full capitalize"
                      style={{ backgroundColor: "var(--subtle)", color: "var(--fg-3)" }}
                    >
                      {formatDay(m.createdAt)}
                    </span>
                  </div>
                )}
                <MessageBubble m={m} />
              </Fragment>
            );
          })
        )}
      </div>
      {data.canView && <Composer key={data.contactId} slug={slug} data={data} />}
    </div>
  );
}
