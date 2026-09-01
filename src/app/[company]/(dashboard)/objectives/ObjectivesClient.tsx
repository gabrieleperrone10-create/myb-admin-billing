"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, LayoutGrid, CalendarRange, Calendar, CalendarDays,
  Target, CheckCircle2, Circle, Zap, Trash2, MessageSquarePlus,
  ChevronDown, ChevronUp, X,
} from "lucide-react";
import { createObjective, updateKeyResult, addCheckIn, deleteObjective } from "@/app/actions/objectives";
import { krProgress, objectiveProgress } from "@/lib/objectives";
import type { ObjectivePeriod, KRType, KRDataSource } from "@prisma/client";

type KR = {
  id: string; title: string; type: KRType; target: number | null; current: number | null;
  unit: string | null; dataSource: KRDataSource | null; completed: boolean; dueDate: Date | null;
};
type CheckIn = { id: string; note: string; createdAt: Date };
type Obj = {
  id: string; title: string; description: string | null; emoji: string; color: string;
  period: ObjectivePeriod; year: number; startDate: Date | null; endDate: Date | null;
  keyResults: KR[]; checkIns: CheckIn[]; progress: number;
};

const MONTH_NAMES = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
const MONTH_SHORT = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

const PERIOD_LABELS: Record<string, string> = {
  Q1: "Q1", Q2: "Q2", Q3: "Q3", Q4: "Q4", ANNUAL: "Anno", CUSTOM: "Custom",
  M1: "Gen", M2: "Feb", M3: "Mar", M4: "Apr", M5: "Mag", M6: "Giu",
  M7: "Lug", M8: "Ago", M9: "Set", M10: "Ott", M11: "Nov", M12: "Dic",
};
const PERIOD_MONTHS: Record<string, [number, number]> = {
  Q1: [0, 2], Q2: [3, 5], Q3: [6, 8], Q4: [9, 11], ANNUAL: [0, 11], CUSTOM: [0, 11],
  M1:[0,0],M2:[1,1],M3:[2,2],M4:[3,3],M5:[4,4],M6:[5,5],
  M7:[6,6],M8:[7,7],M9:[8,8],M10:[9,9],M11:[10,10],M12:[11,11],
};
const EMOJIS = ["🎯", "🚀", "💰", "📈", "🌱", "💡", "🏆", "⚡", "🔥", "🎨", "🤝", "📣"];
const COLORS = ["#4f7deb", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4", "#f97316", "#84cc16", "#6366f1"];

function ProgressRing({ pct, size = 80, stroke = 6, color }: { pct: number; size?: number; stroke?: number; color: string }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={circ - (pct / 100) * circ} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.8s ease" }} />
    </svg>
  );
}

function progressColor(pct: number) {
  if (pct >= 80) return "#10b981";
  if (pct >= 50) return "#f59e0b";
  return "#ef4444";
}

function fmt(val: number, unit: string | null): string {
  if (!unit) return String(Math.round(val));
  if (unit === "€" || unit.toLowerCase().includes("eur"))
    return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(val);
  return `${Math.round(val)} ${unit}`;
}

export default function ObjectivesClient({ objectives, year }: { objectives: Obj[]; year: number }) {
  const [view, setView] = useState<"card" | "annual" | "monthly" | "weekly">("card");
  const [filterPeriod, setFilterPeriod] = useState("ALL");
  const [showModal, setShowModal] = useState(false);
  const [activeMonth, setActiveMonth] = useState(new Date().getMonth());
  const [weekOffset, setWeekOffset] = useState(0);
  const router = useRouter();

  const filtered = filterPeriod === "ALL" ? objectives : objectives.filter(o => o.period === filterPeriod);
  const overallPct = objectives.length ? Math.round(objectives.reduce((s, o) => s + o.progress, 0) / objectives.length) : 0;

  const VIEWS = [
    { key: "card",    Icon: LayoutGrid,   label: "Card" },
    { key: "annual",  Icon: CalendarRange, label: "Anno" },
    { key: "monthly", Icon: Calendar,      label: "Mese" },
    { key: "weekly",  Icon: CalendarDays,  label: "Settimana" },
  ] as const;

  return (
    <div className="flex flex-col gap-0 min-h-full">
      {/* ── HERO ──────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-[var(--r-xl)] mb-6 shrink-0"
        style={{ background: "linear-gradient(135deg, #05050f 0%, #0e0826 45%, #080e20 100%)", minHeight: 190 }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(79,125,235,0.07) 1px, transparent 1px)", backgroundSize: "28px 28px", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: -60, right: -60, width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.12), transparent 65%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -40, left: 80, width: 180, height: 180, borderRadius: "50%", background: "radial-gradient(circle, rgba(79,125,235,0.08), transparent 70%)", pointerEvents: "none" }} />

        {/* Mobile hero layout */}
        <div className="md:hidden relative flex flex-col px-4 pt-5 pb-4 gap-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.3)", letterSpacing: "0.18em" }}>
                Obiettivi · {year}
              </p>
              <h1 className="text-[26px] font-bold leading-tight" style={{ color: "white", letterSpacing: "-0.025em" }}>
                Il tuo {year}
              </h1>
            </div>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-[var(--r-md)] text-[13px] font-semibold shrink-0"
              style={{ background: "linear-gradient(135deg, #4f7deb, #8b5cf6)", color: "white", minHeight: "unset", boxShadow: "0 4px 20px rgba(79,125,235,0.35)", marginTop: 2 }}>
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              Nuovo
            </button>
          </div>

          {objectives.length === 0 ? (
            <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.35)" }}>
              Nessun obiettivo ancora — inizia definendo la tua visione.
            </p>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[18px] font-bold leading-none" style={{ color: progressColor(overallPct) }}>{overallPct}%</span>
              <span className="text-[11px] font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>·</span>
              <span className="text-[12px] font-mono px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}>
                {objectives.length} obiettiv{objectives.length === 1 ? "o" : "i"}
              </span>
              <span className="text-[12px] font-mono px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}>
                {objectives.reduce((s, o) => s + o.keyResults.length, 0)} KR
              </span>
            </div>
          )}
        </div>

        {/* Desktop hero layout */}
        <div className="hidden md:flex relative items-center justify-between px-8 py-7 gap-6">
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[10px] uppercase mb-2" style={{ color: "rgba(255,255,255,0.3)", letterSpacing: "0.18em" }}>
              Obiettivi · {year}
            </p>
            <h1 className="text-[30px] font-bold leading-tight mb-3" style={{ color: "white", letterSpacing: "-0.025em" }}>
              Il tuo {year}
            </h1>
            {objectives.length === 0 ? (
              <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                Nessun obiettivo ancora — inizia definendo la tua visione.
              </p>
            ) : (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[12px] font-mono px-2.5 py-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  {objectives.length} obiettiv{objectives.length === 1 ? "o" : "i"}
                </span>
                <span className="text-[12px] font-mono px-2.5 py-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  {objectives.reduce((s, o) => s + o.keyResults.length, 0)} key result
                </span>
                <span className="text-[12px] font-mono px-2.5 py-1 rounded-full" style={{ backgroundColor: `${progressColor(overallPct)}22`, color: progressColor(overallPct), border: `1px solid ${progressColor(overallPct)}44` }}>
                  {overallPct}% completato
                </span>
              </div>
            )}
          </div>
          {objectives.length > 0 && (
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div className="relative" style={{ width: 88, height: 88 }}>
                <ProgressRing pct={overallPct} size={88} stroke={7} color={progressColor(overallPct)} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[20px] font-bold leading-none" style={{ color: "white" }}>{overallPct}%</span>
                </div>
              </div>
              <p className="text-[9px] font-mono" style={{ color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em" }}>PROGRESSO</p>
            </div>
          )}
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-[var(--r-md)] text-[13px] font-semibold shrink-0"
            style={{ background: "linear-gradient(135deg, #4f7deb, #8b5cf6)", color: "white", minHeight: "unset", boxShadow: "0 4px 20px rgba(79,125,235,0.35)" }}>
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            Nuovo
          </button>
        </div>

        {/* Filters + view toggle */}
        <div className="relative flex items-center justify-between px-4 md:px-8 pb-4 md:pb-5 gap-2 md:gap-3">

          {/* Mobile: select dropdown */}
          <div className="md:hidden flex-1">
            <select
              value={filterPeriod}
              onChange={e => setFilterPeriod(e.target.value)}
              className="w-full px-3 py-2 rounded-[var(--r-md)] text-[13px] font-medium outline-none appearance-none"
              style={{
                backgroundColor: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "white",
              }}
            >
              <option value="ALL" style={{ backgroundColor: "#111" }}>Tutti i periodi</option>
              <optgroup label="Trimestri / Anno" style={{ backgroundColor: "#111" }}>
                {["Q1","Q2","Q3","Q4","ANNUAL"].map(p => (
                  <option key={p} value={p} style={{ backgroundColor: "#111" }}>{PERIOD_LABELS[p]}</option>
                ))}
              </optgroup>
              <optgroup label="Mesi" style={{ backgroundColor: "#111" }}>
                {["M1","M2","M3","M4","M5","M6","M7","M8","M9","M10","M11","M12"].map(p => (
                  <option key={p} value={p} style={{ backgroundColor: "#111" }}>{PERIOD_LABELS[p]}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Desktop: pill buttons */}
          <div className="hidden md:flex gap-1 flex-wrap">
            {["ALL","Q1","Q2","Q3","Q4","ANNUAL","M1","M2","M3","M4","M5","M6","M7","M8","M9","M10","M11","M12"].map(p => (
              <button key={p} onClick={() => setFilterPeriod(p)}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-all"
                style={{
                  backgroundColor: filterPeriod === p ? "rgba(255,255,255,0.15)" : "transparent",
                  color: filterPeriod === p ? "white" : "rgba(255,255,255,0.35)",
                  border: filterPeriod === p ? "1px solid rgba(255,255,255,0.2)" : "1px solid transparent",
                  minHeight: "unset",
                }}>
                {p === "ALL" ? "Tutti" : PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          {/* View toggle — icone sole su mobile, icone+label su desktop */}
          <div className="flex gap-0.5 p-1 rounded-[var(--r-md)] shrink-0"
            style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
            {VIEWS.map(({ key, Icon, label }) => (
              <button key={key} onClick={() => setView(key)}
                className="flex items-center gap-1.5 px-2 md:px-2.5 py-1 rounded-[6px] text-[11px] font-medium transition-all"
                style={{
                  backgroundColor: view === key ? "rgba(255,255,255,0.12)" : "transparent",
                  color: view === key ? "white" : "rgba(255,255,255,0.35)",
                  minHeight: "unset",
                }}>
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── VIEWS ─────────────────────────────────────────────────── */}
      {view === "card"    && <CardView objectives={filtered} onRefresh={() => router.refresh()} />}
      {view === "annual"  && <AnnualPlanner objectives={filtered} year={year} />}
      {view === "monthly" && <MonthlyPlanner objectives={objectives} year={year} month={activeMonth} onMonthChange={setActiveMonth} />}
      {view === "weekly"  && <WeeklyPlanner objectives={objectives} year={year} weekOffset={weekOffset} onOffsetChange={setWeekOffset} />}

      {showModal && (
        <NewObjectiveModal year={year}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); router.refresh(); }} />
      )}
    </div>
  );
}

/* ── CARD VIEW ──────────────────────────────────────────────────────── */
function CardView({ objectives, onRefresh }: { objectives: Obj[]; onRefresh: () => void }) {
  if (objectives.length === 0)
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Target className="w-14 h-14" style={{ color: "var(--fg-3)" }} strokeWidth={1} />
        <p className="text-[15px] font-medium" style={{ color: "var(--fg-2)" }}>Nessun obiettivo per questo periodo</p>
        <p className="text-[13px]" style={{ color: "var(--fg-3)" }}>Crea il tuo primo obiettivo cliccando "Nuovo"</p>
      </div>
    );
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {objectives.map(obj => <ObjectiveCard key={obj.id} obj={obj} onRefresh={onRefresh} />)}
    </div>
  );
}

function ObjectiveCard({ obj, onRefresh }: { obj: Obj; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(true);
  const [checkInText, setCheckInText] = useState("");
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [pending, startTransition] = useTransition();
  const pct = obj.progress;
  const pColor = progressColor(pct);

  function handleKRToggle(kr: KR) {
    if (kr.type !== "MILESTONE") return;
    startTransition(async () => { await updateKeyResult(kr.id, { completed: !kr.completed }); onRefresh(); });
  }
  function handleCheckIn() {
    if (!checkInText.trim()) return;
    startTransition(async () => {
      await addCheckIn(obj.id, checkInText.trim());
      setCheckInText(""); setShowCheckIn(false); onRefresh();
    });
  }
  function handleDelete() {
    if (!confirm(`Eliminare "${obj.title}"?`)) return;
    startTransition(async () => { await deleteObjective(obj.id); onRefresh(); });
  }

  return (
    <div className="rounded-[var(--r-xl)] overflow-hidden transition-shadow"
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderLeft: `3px solid ${obj.color}` }}>
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <span className="text-[24px] shrink-0">{obj.emoji}</span>
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold truncate" style={{ color: "var(--fg)" }}>{obj.title}</h3>
              <p className="text-[11px] font-mono mt-0.5" style={{ color: "var(--fg-3)" }}>
                {PERIOD_LABELS[obj.period]} {obj.year}{obj.description ? ` · ${obj.description}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[24px] font-bold tabular-nums" style={{ color: pColor }}>{pct}%</span>
            <button onClick={() => setExpanded(v => !v)} style={{ color: "var(--fg-3)", minHeight: "unset" }}>
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--subtle)" }}>
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: pColor }} />
        </div>
      </div>

      {expanded && (
        <>
          {obj.keyResults.length > 0 && (
            <div className="px-5 py-3 space-y-3" style={{ borderTop: "1px solid var(--border)" }}>
              {obj.keyResults.map(kr => {
                const kpct = krProgress(kr);
                return (
                  <div key={kr.id}>
                    <div className="flex items-center gap-2.5">
                      {kr.type === "MILESTONE" ? (
                        <button onClick={() => handleKRToggle(kr)} style={{ color: kr.completed ? "#10b981" : "var(--fg-3)", minHeight: "unset" }}>
                          {kr.completed ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                        </button>
                      ) : (
                        <div className="w-4 h-4 shrink-0 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: obj.color }} />
                        </div>
                      )}
                      <span className={`flex-1 text-[13px] min-w-0 truncate ${kr.type === "MILESTONE" && kr.completed ? "line-through" : ""}`}
                        style={{ color: kr.completed && kr.type === "MILESTONE" ? "var(--fg-3)" : "var(--fg)" }}>
                        {kr.title}
                      </span>
                      {kr.type === "METRIC" && kr.target !== null && (
                        <span className="text-[11px] font-mono shrink-0 flex items-center gap-1" style={{ color: "var(--fg-3)" }}>
                          {kr.dataSource && <Zap className="w-3 h-3" style={{ color: "#f59e0b" }} />}
                          {fmt(kr.current ?? 0, kr.unit)} / {fmt(kr.target, kr.unit)}
                        </span>
                      )}
                      {kr.type === "MILESTONE" && (
                        <span className="text-[10px] font-mono shrink-0" style={{ color: kr.completed ? "#10b981" : "var(--fg-3)" }}>
                          {kr.completed ? "✓ Done" : "In corso"}
                        </span>
                      )}
                    </div>
                    {kr.type === "METRIC" && kr.target !== null && (
                      <div className="mt-1.5 ml-6 h-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--subtle)" }}>
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${kpct}%`, backgroundColor: obj.color, opacity: 0.75 }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {obj.checkIns[0] && (
            <div className="mx-5 mb-3 px-3 py-2 rounded-[var(--r-md)] text-[12px]"
              style={{ backgroundColor: "var(--subtle)", color: "var(--fg-2)", borderLeft: `2px solid ${obj.color}` }}>
              <span style={{ color: "var(--fg-3)", fontSize: 10 }}>
                {new Date(obj.checkIns[0].createdAt).toLocaleDateString("it-IT", { day: "numeric", month: "short" })} —{" "}
              </span>
              {obj.checkIns[0].note}
            </div>
          )}

          <div className="flex items-center gap-2 px-5 pb-4" style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
            <button onClick={() => setShowCheckIn(v => !v)}
              className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-[var(--r-md)] transition-colors"
              style={{ color: "var(--fg-2)", border: "1px solid var(--border)", minHeight: "unset" }}>
              <MessageSquarePlus className="w-3 h-3" /> Check-in
            </button>
            <button onClick={handleDelete}
              className="ml-auto p-1 rounded-[var(--r-md)] transition-colors"
              style={{ color: "var(--fg-3)", minHeight: "unset" }}>
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {showCheckIn && (
            <div className="px-5 pb-4 flex gap-2">
              <input value={checkInText} onChange={e => setCheckInText(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleCheckIn()}
                placeholder="Come sta andando?"
                className="flex-1 px-3 py-1.5 rounded-[var(--r-md)] text-[12px] outline-none"
                style={{ backgroundColor: "var(--subtle)", border: "1px solid var(--border)", color: "var(--fg)" }}
                autoFocus />
              <button onClick={handleCheckIn} disabled={pending || !checkInText.trim()}
                className="px-3 py-1.5 rounded-[var(--r-md)] text-[12px] font-medium transition-colors"
                style={{ backgroundColor: obj.color, color: "white", minHeight: "unset", opacity: !checkInText.trim() ? 0.5 : 1 }}>
                Salva
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── ANNUAL PLANNER ─────────────────────────────────────────────────── */
function AnnualPlanner({ objectives, year }: { objectives: Obj[]; year: number }) {
  const todayMonth = new Date().getMonth();
  const todayDay = new Date().getDate();
  const todayFrac = (todayMonth + todayDay / 31) / 12;

  if (objectives.length === 0)
    return <EmptyState />;

  return (
    <div className="rounded-[var(--r-xl)] overflow-hidden" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="overflow-x-auto">
        <div style={{ minWidth: 720 }}>
          {/* Month header */}
          <div className="grid px-4 py-3" style={{ gridTemplateColumns: "190px repeat(12, 1fr)", borderBottom: "1px solid var(--border)" }}>
            <p className="text-[10px] font-mono uppercase" style={{ color: "var(--fg-3)", letterSpacing: "0.12em" }}>Obiettivo</p>
            {MONTH_SHORT.map((m, i) => (
              <div key={i} className="text-center text-[10px] font-mono font-semibold"
                style={{ color: i === todayMonth ? "var(--info)" : "var(--fg-3)", letterSpacing: "0.05em" }}>{m}</div>
            ))}
          </div>

          {objectives.map(obj => {
            const [sM, eM] = obj.period === "CUSTOM" && obj.startDate && obj.endDate
              ? [new Date(obj.startDate).getMonth(), new Date(obj.endDate).getMonth()]
              : PERIOD_MONTHS[obj.period];
            return (
              <div key={obj.id} className="grid items-center px-4 py-3"
                style={{ gridTemplateColumns: "190px repeat(12, 1fr)", borderBottom: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2 pr-3 min-w-0">
                  <span className="text-[18px] shrink-0">{obj.emoji}</span>
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium truncate" style={{ color: "var(--fg)" }}>{obj.title}</p>
                    <p className="text-[10px] font-mono" style={{ color: progressColor(obj.progress) }}>{obj.progress}%</p>
                  </div>
                </div>
                {Array.from({ length: 12 }, (_, i) => {
                  const inRange = i >= sM && i <= eM;
                  const isStart = i === sM, isEnd = i === eM;
                  return (
                    <div key={i} className="relative h-8 flex items-center">
                      {inRange && (
                        <div className="absolute inset-y-2 left-0 right-0 flex items-center"
                          style={{
                            backgroundColor: obj.color + "28",
                            borderTop: `1.5px solid ${obj.color}50`,
                            borderBottom: `1.5px solid ${obj.color}50`,
                            borderLeft: isStart ? `1.5px solid ${obj.color}` : "none",
                            borderRight: isEnd ? `1.5px solid ${obj.color}` : "none",
                            borderRadius: isStart && isEnd ? 8 : isStart ? "8px 0 0 8px" : isEnd ? "0 8px 8px 0" : 0,
                          }}>
                          {isStart && (
                            <div className="absolute inset-0 rounded-l-[6px] overflow-hidden">
                              <div className="h-full rounded-l-[6px]"
                                style={{ width: `${obj.progress}%`, backgroundColor: obj.color + "55" }} />
                            </div>
                          )}
                        </div>
                      )}
                      {i === todayMonth && (
                        <div className="absolute top-0 bottom-0 w-px z-10"
                          style={{ left: `${(todayDay / 31) * 100}%`, backgroundColor: "var(--info)", opacity: 0.6 }} />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="w-px h-3 rounded-full" style={{ backgroundColor: "var(--info)" }} />
            <span className="text-[10px] font-mono" style={{ color: "var(--fg-3)" }}>oggi — {new Date().toLocaleDateString("it-IT", { day: "numeric", month: "long" })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── MONTHLY PLANNER ────────────────────────────────────────────────── */
function MonthlyPlanner({ objectives, year, month, onMonthChange }: { objectives: Obj[]; year: number; month: number; onMonthChange: (m: number) => void }) {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDow + 6) % 7;
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  const today = new Date();

  const eventsByDay: Record<number, { label: string; color: string; type: "checkin" | "due" }[]> = {};
  for (const obj of objectives) {
    for (const ci of obj.checkIns) {
      const d = new Date(ci.createdAt);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        (eventsByDay[day] ??= []).push({ label: ci.note, color: obj.color, type: "checkin" });
      }
    }
    for (const kr of obj.keyResults) {
      if (kr.dueDate) {
        const d = new Date(kr.dueDate);
        if (d.getFullYear() === year && d.getMonth() === month) {
          (eventsByDay[d.getDate()] ??= []).push({ label: kr.title, color: obj.color, type: "due" });
        }
      }
    }
  }

  return (
    <div className="rounded-[var(--r-xl)] overflow-hidden" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: "1px solid var(--border)" }}>
        <button onClick={() => onMonthChange(Math.max(0, month - 1))}
          className="w-8 h-8 flex items-center justify-center rounded-[var(--r-md)] text-[14px] transition-colors"
          style={{ border: "1px solid var(--border)", color: "var(--fg-2)", minHeight: "unset" }}>‹</button>
        <h3 className="text-[15px] font-semibold capitalize" style={{ color: "var(--fg)" }}>
          {MONTH_NAMES[month]} {year}
        </h3>
        <button onClick={() => onMonthChange(Math.min(11, month + 1))}
          className="w-8 h-8 flex items-center justify-center rounded-[var(--r-md)] text-[14px] transition-colors"
          style={{ border: "1px solid var(--border)", color: "var(--fg-2)", minHeight: "unset" }}>›</button>
      </div>

      <div className="grid grid-cols-7 px-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
        {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map(d => (
          <div key={d} className="text-center text-[10px] font-mono font-semibold" style={{ color: "var(--fg-3)", letterSpacing: "0.06em" }}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 p-3 gap-1">
        {Array.from({ length: totalCells }, (_, i) => {
          const day = i - startOffset + 1;
          const valid = day >= 1 && day <= daysInMonth;
          const isToday = valid && today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
          const events = valid ? (eventsByDay[day] ?? []) : [];
          return (
            <div key={i} className="rounded-[var(--r-md)] p-1.5 min-h-[72px]"
              style={{ backgroundColor: isToday ? "var(--subtle)" : "transparent", border: isToday ? "1px solid var(--info)33" : "1px solid transparent" }}>
              {valid && (
                <>
                  <p className="text-[11px] font-medium mb-1" style={{ color: isToday ? "var(--info)" : "var(--fg-2)", fontWeight: isToday ? 700 : 400 }}>{day}</p>
                  {events.slice(0, 2).map((ev, ei) => (
                    <div key={ei} className="text-[9px] px-1.5 py-0.5 rounded-[4px] mb-0.5 truncate"
                      style={{ backgroundColor: ev.color + "20", color: ev.color, border: `1px solid ${ev.color}40` }}>
                      {ev.type === "due" ? "⏰ " : "💬 "}{ev.label}
                    </div>
                  ))}
                  {events.length > 2 && <p className="text-[9px]" style={{ color: "var(--fg-3)" }}>+{events.length - 2}</p>}
                </>
              )}
            </div>
          );
        })}
      </div>

      {objectives.length > 0 && (
        <div className="px-5 py-3 flex flex-wrap gap-3" style={{ borderTop: "1px solid var(--border)" }}>
          {objectives.map(obj => (
            <div key={obj.id} className="flex items-center gap-1.5">
              <span className="text-[14px]">{obj.emoji}</span>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: obj.color }} />
              <span className="text-[10px]" style={{ color: "var(--fg-3)" }}>{obj.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── WEEKLY PLANNER ─────────────────────────────────────────────────── */
function WeeklyPlanner({ objectives, year, weekOffset, onOffsetChange }: { objectives: Obj[]; year: number; weekOffset: number; onOffsetChange: (n: number) => void }) {
  const today = new Date();
  const startOfWeek = new Date(today);
  const dow = (today.getDay() + 6) % 7; // Mon=0
  startOfWeek.setDate(today.getDate() - dow + weekOffset * 7);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d;
  });

  const DAY_NAMES = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

  const eventsByDate: Record<string, { label: string; color: string; emoji: string; type: "checkin" | "due" }[]> = {};
  const key = (d: Date) => d.toISOString().split("T")[0];

  for (const obj of objectives) {
    for (const ci of obj.checkIns) {
      const k = key(new Date(ci.createdAt));
      (eventsByDate[k] ??= []).push({ label: ci.note, color: obj.color, emoji: obj.emoji, type: "checkin" });
    }
    for (const kr of obj.keyResults) {
      if (kr.dueDate) {
        const k = key(new Date(kr.dueDate));
        (eventsByDate[k] ??= []).push({ label: kr.title, color: obj.color, emoji: obj.emoji, type: "due" });
      }
    }
  }

  const weekLabel = `${days[0].toLocaleDateString("it-IT", { day: "numeric", month: "short" })} – ${days[6].toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <div className="rounded-[var(--r-xl)] overflow-hidden" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: "1px solid var(--border)" }}>
        <button onClick={() => onOffsetChange(weekOffset - 1)}
          className="w-8 h-8 flex items-center justify-center rounded-[var(--r-md)] transition-colors"
          style={{ border: "1px solid var(--border)", color: "var(--fg-2)", minHeight: "unset" }}>‹</button>
        <div className="flex items-center gap-3">
          <span className="text-[14px] font-semibold" style={{ color: "var(--fg)" }}>{weekLabel}</span>
          {weekOffset !== 0 && (
            <button onClick={() => onOffsetChange(0)}
              className="text-[11px] px-2.5 py-1 rounded-full transition-colors"
              style={{ border: "1px solid var(--border)", color: "var(--fg-3)", minHeight: "unset" }}>
              Oggi
            </button>
          )}
        </div>
        <button onClick={() => onOffsetChange(weekOffset + 1)}
          className="w-8 h-8 flex items-center justify-center rounded-[var(--r-md)] transition-colors"
          style={{ border: "1px solid var(--border)", color: "var(--fg-2)", minHeight: "unset" }}>›</button>
      </div>

      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const isToday = key(day) === key(today);
          const events = eventsByDate[key(day)] ?? [];
          return (
            <div key={i} className="p-3 min-h-[160px]"
              style={{ borderRight: i < 6 ? "1px solid var(--border)" : "none", backgroundColor: isToday ? "var(--subtle)" : "transparent" }}>
              <div className="mb-3">
                <p className="text-[10px] font-mono uppercase" style={{ color: isToday ? "var(--info)" : "var(--fg-3)", letterSpacing: "0.1em" }}>{DAY_NAMES[i]}</p>
                <p className="text-[20px] font-bold leading-none mt-0.5" style={{ color: isToday ? "var(--info)" : "var(--fg)", fontWeight: isToday ? 800 : 500 }}>
                  {day.getDate()}
                </p>
                {isToday && <div className="w-4 h-0.5 mt-1 rounded-full" style={{ backgroundColor: "var(--info)" }} />}
              </div>
              <div className="space-y-1.5">
                {events.map((ev, ei) => (
                  <div key={ei} className="rounded-[6px] px-2 py-1.5"
                    style={{ backgroundColor: ev.color + "18", border: `1px solid ${ev.color}35` }}>
                    <p className="text-[10px] font-medium truncate" style={{ color: ev.color }}>
                      {ev.type === "due" ? "⏰" : "💬"} {ev.emoji}
                    </p>
                    <p className="text-[10px] truncate mt-0.5" style={{ color: "var(--fg-2)" }}>{ev.label}</p>
                  </div>
                ))}
                {events.length === 0 && (
                  <p className="text-[10px]" style={{ color: "var(--fg-3)", opacity: 0.5 }}>—</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Week summary bar */}
      <div className="px-5 py-3 flex items-center gap-4 flex-wrap" style={{ borderTop: "1px solid var(--border)" }}>
        {objectives.map(obj => {
          const hasActivity = days.some(d => (eventsByDate[key(d)] ?? []).some(e => e.color === obj.color));
          return (
            <div key={obj.id} className="flex items-center gap-1.5">
              <span className="text-[13px]">{obj.emoji}</span>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: obj.color, opacity: hasActivity ? 1 : 0.3 }} />
              <span className="text-[10px]" style={{ color: hasActivity ? "var(--fg-2)" : "var(--fg-3)" }}>
                {obj.title} · {obj.progress}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── NEW OBJECTIVE MODAL ────────────────────────────────────────────── */
function NewObjectiveModal({ year, onClose, onCreated }: { year: number; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("🎯");
  const [color, setColor] = useState(COLORS[0]);
  const [period, setPeriod] = useState<ObjectivePeriod>("Q2");
  const [periodTab, setPeriodTab] = useState<"quarter" | "month">("quarter");
  const [krs, setKrs] = useState<{ title: string; type: KRType; target: string; unit: string; dataSource: string }[]>([]);
  const [pending, startTransition] = useTransition();

  function addKR() { setKrs(p => [...p, { title: "", type: "METRIC", target: "", unit: "", dataSource: "" }]); }
  function updateKR(i: number, f: string, v: string) { setKrs(p => p.map((kr, idx) => idx === i ? { ...kr, [f]: v } : kr)); }
  function removeKR(i: number) { setKrs(p => p.filter((_, idx) => idx !== i)); }

  function handleSubmit() {
    if (!title.trim()) return;
    startTransition(async () => {
      await createObjective({
        title: title.trim(), description: description.trim() || undefined,
        emoji, color, period, year,
        keyResults: krs.filter(kr => kr.title.trim()).map(kr => ({
          title: kr.title, type: kr.type as KRType,
          target: kr.target ? parseFloat(kr.target) : undefined,
          unit: kr.unit || undefined,
          dataSource: kr.dataSource ? kr.dataSource as KRDataSource : undefined,
        })),
      });
      onCreated();
    });
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-[560px] rounded-[var(--r-xl)] overflow-hidden shadow-2xl"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", maxHeight: "88vh", overflowY: "auto" }}>
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <span className="text-[22px]">{emoji}</span>
            <h2 className="text-[15px] font-semibold" style={{ color: "var(--fg)" }}>Nuovo obiettivo</h2>
          </div>
          <button onClick={onClose} style={{ color: "var(--fg-3)", minHeight: "unset" }}><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Emoji picker */}
          <div>
            <label className="block text-[10px] font-mono uppercase mb-2" style={{ color: "var(--fg-3)", letterSpacing: "0.12em" }}>Icona</label>
            <div className="flex gap-1.5 flex-wrap">
              {EMOJIS.map(e => (
                <button key={e} onClick={() => setEmoji(e)}
                  className="w-9 h-9 rounded-[8px] flex items-center justify-center text-[20px] transition-all"
                  style={{ backgroundColor: emoji === e ? color + "22" : "var(--subtle)", border: emoji === e ? `1.5px solid ${color}` : "1px solid var(--border)", minHeight: "unset" }}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Color picker */}
          <div>
            <label className="block text-[10px] font-mono uppercase mb-2" style={{ color: "var(--fg-3)", letterSpacing: "0.12em" }}>Colore</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full transition-all"
                  style={{ backgroundColor: c, minHeight: "unset", outline: color === c ? `2px solid ${c}` : "none", outlineOffset: 2 }} />
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-[10px] font-mono uppercase mb-1.5" style={{ color: "var(--fg-3)", letterSpacing: "0.12em" }}>Titolo *</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="es. Crescere il fatturato Q2"
              className="w-full px-3 py-2.5 rounded-[var(--r-md)] text-[14px] outline-none"
              style={{ backgroundColor: "var(--subtle)", border: "1px solid var(--border)", color: "var(--fg)" }}
              autoFocus />
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase mb-1.5" style={{ color: "var(--fg-3)", letterSpacing: "0.12em" }}>Descrizione</label>
            <input value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Contesto o motivazione…"
              className="w-full px-3 py-2 rounded-[var(--r-md)] text-[13px] outline-none"
              style={{ backgroundColor: "var(--subtle)", border: "1px solid var(--border)", color: "var(--fg)" }} />
          </div>

          {/* Period */}
          <div>
            <label className="block text-[10px] font-mono uppercase mb-2" style={{ color: "var(--fg-3)", letterSpacing: "0.12em" }}>Periodo</label>
            {/* Tab switcher */}
            <div className="flex gap-1 p-1 rounded-[var(--r-md)] mb-3 w-fit" style={{ backgroundColor: "var(--subtle)", border: "1px solid var(--border)" }}>
              {(["quarter", "month"] as const).map(t => (
                <button key={t} onClick={() => { setPeriodTab(t); setPeriod(t === "quarter" ? "Q1" : "M1"); }}
                  className="px-3 py-1 rounded-[6px] text-[11px] font-medium transition-all"
                  style={{
                    backgroundColor: periodTab === t ? "var(--surface)" : "transparent",
                    color: periodTab === t ? "var(--fg)" : "var(--fg-3)",
                    minHeight: "unset",
                    boxShadow: periodTab === t ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                  }}>
                  {t === "quarter" ? "Trimestrale / Annuale" : "Mensile"}
                </button>
              ))}
            </div>

            {periodTab === "quarter" && (
              <div className="flex gap-1.5">
                {(["Q1", "Q2", "Q3", "Q4", "ANNUAL"] as ObjectivePeriod[]).map(p => (
                  <button key={p} onClick={() => setPeriod(p)}
                    className="flex-1 py-2 rounded-[var(--r-md)] text-[12px] font-medium transition-all"
                    style={{
                      backgroundColor: period === p ? color : "var(--subtle)",
                      color: period === p ? "white" : "var(--fg-2)",
                      border: `1px solid ${period === p ? color : "var(--border)"}`,
                      minHeight: "unset",
                    }}>
                    {PERIOD_LABELS[p]}
                  </button>
                ))}
              </div>
            )}

            {periodTab === "month" && (
              <div className="grid grid-cols-6 gap-1.5">
                {(["M1","M2","M3","M4","M5","M6","M7","M8","M9","M10","M11","M12"] as ObjectivePeriod[]).map(p => (
                  <button key={p} onClick={() => setPeriod(p)}
                    className="py-2 rounded-[var(--r-md)] text-[12px] font-medium transition-all"
                    style={{
                      backgroundColor: period === p ? color : "var(--subtle)",
                      color: period === p ? "white" : "var(--fg-2)",
                      border: `1px solid ${period === p ? color : "var(--border)"}`,
                      minHeight: "unset",
                    }}>
                    {PERIOD_LABELS[p]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Key Results */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-mono uppercase" style={{ color: "var(--fg-3)", letterSpacing: "0.12em" }}>Key Results</label>
              <button onClick={addKR}
                className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-[var(--r-md)] transition-colors"
                style={{ border: "1px solid var(--border)", color: "var(--fg-2)", minHeight: "unset" }}>
                <Plus className="w-3 h-3" /> Aggiungi
              </button>
            </div>
            <div className="space-y-2">
              {krs.map((kr, i) => (
                <div key={i} className="p-3 rounded-[var(--r-md)] space-y-2"
                  style={{ backgroundColor: "var(--subtle)", border: "1px solid var(--border)" }}>
                  <div className="flex gap-2">
                    <input value={kr.title} onChange={e => updateKR(i, "title", e.target.value)}
                      placeholder="Titolo key result…"
                      className="flex-1 px-2.5 py-1.5 rounded-[var(--r-md)] text-[12px] outline-none"
                      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--fg)" }} />
                    <button onClick={() => removeKR(i)} style={{ color: "var(--fg-3)", minHeight: "unset" }}><X className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <select value={kr.type} onChange={e => updateKR(i, "type", e.target.value)}
                      className="px-2 py-1.5 rounded-[var(--r-md)] text-[11px] outline-none"
                      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--fg)", minHeight: "unset" }}>
                      <option value="METRIC">📊 Metrica</option>
                      <option value="MILESTONE">✅ Milestone</option>
                    </select>
                    {kr.type === "METRIC" && (
                      <>
                        <input value={kr.target} onChange={e => updateKR(i, "target", e.target.value)}
                          placeholder="Target" type="number"
                          className="w-24 px-2 py-1.5 rounded-[var(--r-md)] text-[11px] outline-none"
                          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--fg)" }} />
                        <input value={kr.unit} onChange={e => updateKR(i, "unit", e.target.value)}
                          placeholder="Unità (€, #…)"
                          className="w-24 px-2 py-1.5 rounded-[var(--r-md)] text-[11px] outline-none"
                          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--fg)" }} />
                        <select value={kr.dataSource} onChange={e => updateKR(i, "dataSource", e.target.value)}
                          className="flex-1 min-w-[140px] px-2 py-1.5 rounded-[var(--r-md)] text-[11px] outline-none"
                          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--fg)", minHeight: "unset" }}>
                          <option value="">Inserimento manuale</option>
                          <option value="INVOICES_AMOUNT">⚡ Fatturato pagato (auto)</option>
                          <option value="CLIENT_COUNT">⚡ Nuovi clienti (auto)</option>
                          <option value="EXPENSES_AMOUNT">⚡ Spese totali (auto)</option>
                          <option value="CONTRACT_COUNT">⚡ Nuovi contratti (auto)</option>
                        </select>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {krs.length === 0 && (
                <p className="text-[12px] py-2" style={{ color: "var(--fg-3)" }}>
                  Nessun key result — puoi aggiungerli dopo.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={handleSubmit} disabled={pending || !title.trim()}
            className="flex-1 py-2.5 rounded-[var(--r-md)] text-[14px] font-semibold transition-all"
            style={{ background: `linear-gradient(135deg, ${color}, ${color}99)`, color: "white", minHeight: "unset", opacity: pending || !title.trim() ? 0.5 : 1 }}>
            {pending ? "Creando…" : "Crea obiettivo"}
          </button>
          <button onClick={onClose}
            className="px-5 py-2.5 rounded-[var(--r-md)] text-[13px] transition-colors"
            style={{ border: "1px solid var(--border)", color: "var(--fg-2)", minHeight: "unset" }}>
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <Target className="w-14 h-14" style={{ color: "var(--fg-3)" }} strokeWidth={1} />
      <p className="text-[14px]" style={{ color: "var(--fg-3)" }}>Nessun obiettivo da visualizzare per questo periodo.</p>
    </div>
  );
}
