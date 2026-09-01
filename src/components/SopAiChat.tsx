"use client";
import { useState, useRef, useEffect } from "react";
import { Bot, Send, X, Sparkles, User } from "lucide-react";
import { useCompanySlug } from "@/lib/useCompany";

type Message = { role: "user" | "assistant"; content: string };

export function SopAiChat() {
  const slug = useCompanySlug();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend() {
    const question = input.trim();
    if (!question || loading) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: question }]);
    setLoading(true);

    try {
      const res = await fetch(`/api/sop/ai?company=${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (!res.body) throw new Error("No stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";

      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: answer };
          return updated;
        });
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Errore nella risposta. Riprova." }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function renderContent(text: string) {
    const parts = text.split(/(\[([^\]]+)\]\(([^)]+)\)|\/sop\/[a-z0-9]+)/gi);
    return parts.map((part, i) => {
      const mdLink = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (mdLink) return <a key={i} href={mdLink[2]} className="underline" style={{ color: "#4f7deb" }}>{mdLink[1]}</a>;
      const sopLink = part.match(/\/sop\/([a-z0-9]+)/i);
      if (sopLink) return <a key={i} href={part} className="underline font-medium" style={{ color: "#4f7deb" }}>{part}</a>;
      return <span key={i}>{part}</span>;
    });
  }

  return (
    <>
      {/* ── Floating trigger button ───────────────────────────────────
          Mobile: sits above the 56px bottom nav + safe area
          Desktop: bottom-6 right-6 as before
      ─────────────────────────────────────────────────────────────── */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed right-4 z-40 flex items-center gap-2 px-4 rounded-full shadow-lg font-semibold text-[13px] transition-transform active:scale-95"
          style={{
            backgroundColor: "var(--fg)",
            color: "var(--surface)",
            height: 44,
            minHeight: "unset",
            /* Mobile: above bottom nav (56px) + safe-area + 12px gap */
            bottom: "calc(56px + env(safe-area-inset-bottom) + 12px)",
          }}
        >
          <Sparkles className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">AI Assistente SOP</span>
          <span className="sm:hidden">AI SOP</span>
        </button>
      )}

      {/* ── Chat panel ────────────────────────────────────────────────
          Mobile: full-screen overlay (bottom sheet style)
          Desktop: fixed 400×560 bottom-right panel
      ─────────────────────────────────────────────────────────────── */}
      {open && (
        <>
          {/* Mobile backdrop */}
          <div
            className="md:hidden fixed inset-0 z-50 animate-fade-in"
            style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
            onClick={() => setOpen(false)}
          />

          <div
            className="sop-ai-panel fixed z-50 flex flex-col overflow-hidden shadow-2xl"
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              /* Mobile: full-width bottom sheet, leaving top 60px for close tap */
              bottom: 0,
              left: 0,
              right: 0,
              borderRadius: "20px 20px 0 0",
              /* Use dvh so keyboard doesn't clip the panel */
              height: "88dvh",
            }}
          >
            {/* Override to desktop panel size on md+ */}
            <style>{`
              @media (min-width: 768px) {
                .sop-ai-panel {
                  left: auto !important;
                  right: 24px !important;
                  bottom: 24px !important;
                  width: 400px !important;
                  height: 560px !important;
                  border-radius: 12px !important;
                }
              }
            `}</style>

            {/* Header */}
            <div
              className="flex items-center justify-between px-4 shrink-0"
              style={{
                borderBottom: "1px solid var(--border)",
                backgroundColor: "var(--fg)",
                height: 52,
              }}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" style={{ color: "var(--surface)" }} />
                <span className="text-[14px] font-semibold" style={{ color: "var(--surface)" }}>AI Assistente SOP</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="flex items-center justify-center rounded-full"
                style={{ width: 32, height: 32, minHeight: "unset", minWidth: "unset", color: "var(--surface)", opacity: 0.7 }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center pt-8">
                  <Bot className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--fg-3)" }} />
                  <p className="text-[14px] font-semibold" style={{ color: "var(--fg-2)" }}>Ciao! Sono il tuo assistente SOP.</p>
                  <p className="text-[13px] mt-1" style={{ color: "var(--fg-3)" }}>Chiedimi qualsiasi cosa sulle procedure operative.</p>
                  <div className="mt-5 space-y-2">
                    {[
                      "Come funziona l'onboarding clienti?",
                      "Quali sono i passaggi per creare una fattura?",
                      "Mostrami le SOP di Marketing",
                    ].map(q => (
                      <button
                        key={q}
                        onClick={() => { setInput(q); inputRef.current?.focus(); }}
                        className="block w-full text-left px-3 py-2.5 rounded-[var(--r-lg)] text-[13px] transition-colors"
                        style={{
                          backgroundColor: "var(--subtle)",
                          color: "var(--fg-2)",
                          border: "1px solid var(--border)",
                          minHeight: "unset",
                        }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: msg.role === "user" ? "var(--fg)" : "#4f7deb18" }}
                  >
                    {msg.role === "user"
                      ? <User className="w-3.5 h-3.5" style={{ color: "var(--surface)" }} />
                      : <Bot className="w-3.5 h-3.5" style={{ color: "#4f7deb" }} />
                    }
                  </div>
                  <div
                    className="flex-1 px-3 py-2.5 rounded-[10px] text-[13px] leading-relaxed whitespace-pre-wrap"
                    style={{
                      backgroundColor: msg.role === "user" ? "var(--fg)" : "var(--subtle)",
                      color: msg.role === "user" ? "var(--surface)" : "var(--fg)",
                      maxWidth: "85%",
                    }}
                  >
                    {msg.role === "assistant" ? renderContent(msg.content) : msg.content}
                    {msg.role === "assistant" && msg.content === "" && (
                      <span className="inline-block w-1.5 h-3.5 rounded-sm animate-pulse" style={{ backgroundColor: "#4f7deb" }} />
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div
              className="px-3 py-3 shrink-0"
              style={{
                borderTop: "1px solid var(--border)",
                paddingBottom: "max(12px, env(safe-area-inset-bottom))",
              }}
            >
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Fai una domanda sulle SOP..."
                  rows={1}
                  className="flex-1 px-3 py-2.5 rounded-[var(--r-lg)] outline-none resize-none"
                  style={{
                    border: "1px solid var(--border)",
                    color: "var(--fg)",
                    backgroundColor: "var(--subtle)",
                    maxHeight: 120,
                    fontSize: 14,
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || loading}
                  className="flex items-center justify-center rounded-[var(--r-lg)] shrink-0 transition-colors"
                  style={{
                    backgroundColor: input.trim() && !loading ? "var(--fg)" : "var(--subtle)",
                    color: input.trim() && !loading ? "var(--surface)" : "var(--fg-3)",
                    width: 44,
                    height: 44,
                    minHeight: "unset",
                    minWidth: "unset",
                  }}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] mt-1.5 hidden sm:block" style={{ color: "var(--fg-3)" }}>
                Enter per inviare · Shift+Enter per nuova riga
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}
