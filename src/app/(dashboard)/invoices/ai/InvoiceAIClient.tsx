"use client";
import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, RotateCcw, Bot, User } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Crea una fattura per [cliente] per consulenza di maggio, €2.000 + IVA 22%",
  "Fattura a [cliente] per 3 sessioni di coaching a €500 l'una",
  "Genera una fattura mensile per [cliente], servizio gestione social €800 + IVA",
];

function renderMarkdown(text: string) {
  // Simple markdown: bold, italic, tables, line breaks
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br />");
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end gap-2 items-end">
        <div
          className="max-w-[75%] px-4 py-3 rounded-[16px] rounded-br-[4px] text-[14px] leading-relaxed"
          style={{ backgroundColor: "var(--fg)", color: "var(--surface)" }}
        >
          {msg.content}
        </div>
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: "var(--subtle)", border: "1px solid var(--border)" }}
        >
          <User className="w-3.5 h-3.5" style={{ color: "var(--fg-2)" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 items-end">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
        style={{ background: "linear-gradient(135deg, #4f7deb, #8b5cf6)" }}
      >
        <Bot className="w-3.5 h-3.5 text-white" />
      </div>
      <div
        className="max-w-[85%] px-4 py-3 rounded-[16px] rounded-bl-[4px] text-[14px] leading-relaxed"
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
          color: "var(--fg)",
        }}
      >
        <div
          dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
          className="prose-sm"
          style={{ lineHeight: "1.65" }}
        />
      </div>
    </div>
  );
}

export default function InvoiceAIClient() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Ciao! Sono il tuo assistente per la creazione delle fatture. 🧾\n\nDescrivimi la fattura che vuoi creare: dimmi il cliente, i servizi, gli importi e le date. Penserò a tutto il resto.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    const userMsg: Message = { role: "user", content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/invoices/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.content }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Errore di connessione. Riprova." }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  function reset() {
    setMessages([{
      role: "assistant",
      content: "Ciao! Sono il tuo assistente per la creazione delle fatture. 🧾\n\nDescrivimi la fattura che vuoi creare: dimmi il cliente, i servizi, gli importi e le date. Penserò a tutto il resto.",
    }]);
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="flex flex-col h-full max-w-[720px] mx-auto" style={{ height: "calc(100vh - var(--topbar-h) - 56px)" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-[10px] flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #4f7deb, #8b5cf6)" }}
          >
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-[14px] font-semibold" style={{ color: "var(--fg)" }}>Assistente Fatture AI</p>
            <p className="text-[11px]" style={{ color: "var(--fg-3)" }}>Descrivi · Rivedi · Conferma · Invia</p>
          </div>
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--r-md)] text-[12px] transition-colors"
          style={{ border: "1px solid var(--border)", color: "var(--fg-2)", minHeight: "unset" }}
          title="Nuova conversazione"
        >
          <RotateCcw className="w-3 h-3" />
          Nuova
        </button>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto rounded-[var(--r-lg)] p-4 space-y-4"
        style={{ backgroundColor: "var(--subtle)", border: "1px solid var(--border)" }}
      >
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}

        {loading && (
          <div className="flex gap-2 items-end">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, #4f7deb, #8b5cf6)" }}
            >
              <Bot className="w-3.5 h-3.5 text-white" />
            </div>
            <div
              className="px-4 py-3 rounded-[16px] rounded-bl-[4px]"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="flex gap-1 items-center h-4">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full animate-bounce"
                    style={{
                      backgroundColor: "var(--fg-3)",
                      animationDelay: `${i * 150}ms`,
                      animationDuration: "900ms",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggestions — show only at start */}
      {messages.length === 1 && (
        <div className="flex flex-col gap-2 mt-3 shrink-0">
          <p className="text-[11px] font-mono uppercase" style={{ color: "var(--fg-3)", letterSpacing: "0.1em" }}>Esempi</p>
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => send(s)}
              className="text-left px-3 py-2.5 rounded-[var(--r-md)] text-[12px] transition-colors"
              style={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--fg-2)",
                minHeight: "unset",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div
        className="flex gap-2 items-end mt-3 shrink-0 p-3 rounded-[var(--r-lg)]"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Descrivi la fattura… (Invio per inviare, Shift+Invio per andare a capo)"
          rows={2}
          className="flex-1 resize-none outline-none text-[14px] bg-transparent leading-relaxed"
          style={{ color: "var(--fg)", maxHeight: 120 }}
          disabled={loading}
          autoFocus
        />
        <button
          onClick={() => send()}
          disabled={!input.trim() || loading}
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all"
          style={{
            background: input.trim() && !loading ? "linear-gradient(135deg, #4f7deb, #8b5cf6)" : "var(--subtle)",
            border: "1px solid var(--border)",
            minHeight: "unset",
            minWidth: "unset",
          }}
        >
          <Send className="w-3.5 h-3.5" style={{ color: input.trim() && !loading ? "white" : "var(--fg-3)" }} />
        </button>
      </div>
    </div>
  );
}
