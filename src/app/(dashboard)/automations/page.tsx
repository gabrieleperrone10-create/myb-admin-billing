export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { AutomationToggle } from "./AutomationToggle";
import { Bell, CalendarCheck, FileBarChart2, RefreshCw, ShieldAlert, Zap } from "lucide-react";
import { AutomationConfigInput } from "./AutomationConfigInput";

type AutomationDef = {
  type: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  schedule: string;
  category: "fatture" | "report" | "contratti";
  implemented: boolean;
  configFields?: { field: string; label: string; placeholder?: string }[];
};

const AUTOMATIONS: AutomationDef[] = [
  {
    type: "OVERDUE_REMINDER",
    icon: <Bell className="w-4 h-4" />,
    title: "Sollecito fatture insolute",
    desc: "Invia automaticamente un'email di sollecito al cliente quando una fattura supera la scadenza. Include link WhatsApp pre-compilato nel report admin.",
    schedule: "Ogni giorno alle 09:00 UTC",
    category: "fatture",
    implemented: true,
  },
  {
    type: "OVERDUE_ALERT",
    icon: <ShieldAlert className="w-4 h-4" />,
    title: "Report settimanale insoluti",
    desc: "Ogni lunedì invia un riepilogo di tutte le fatture scadute con importi, giorni di ritardo e link WhatsApp one-click per ogni cliente.",
    schedule: "Ogni lunedì alle 08:00 UTC",
    category: "fatture",
    implemented: true,
    configFields: [
      { field: "email", label: "Invia a:", placeholder: "tua@email.com" },
    ],
  },
  {
    type: "RECURRING_INVOICES",
    icon: <RefreshCw className="w-4 h-4" />,
    title: "Creazione fatture ricorrenti",
    desc: "Genera automaticamente le fatture mensili per tutti i contratti ricorrenti attivi il giorno di fatturazione configurato.",
    schedule: "Ogni giorno alle 07:00 UTC",
    category: "contratti",
    implemented: true,
  },
  {
    type: "MONTHLY_PL_REPORT",
    icon: <FileBarChart2 className="w-4 h-4" />,
    title: "Report mensile P&L",
    desc: "Invia a fine mese un report completo con entrate, spese, utile netto e confronto con il mese precedente.",
    schedule: "Ultimo giorno del mese alle 18:00",
    category: "report",
    implemented: false,
  },
  {
    type: "CASHFLOW_FORECAST",
    icon: <CalendarCheck className="w-4 h-4" />,
    title: "Previsione cashflow settimanale",
    desc: "Ogni lunedì invia una previsione del cashflow per i prossimi 30 giorni basata sui contratti attivi e le fatture aperte.",
    schedule: "Ogni lunedì alle 09:00",
    category: "report",
    implemented: false,
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  fatture: "Fatture",
  report: "Report",
  contratti: "Contratti",
};

const CATEGORY_COLORS: Record<string, string> = {
  fatture: "#f97316",
  report: "#4f7deb",
  contratti: "#3b9e6a",
};

export default async function AutomationsPage() {
  const stored = await prisma.automation.findMany();
  const stateMap = Object.fromEntries(stored.map(a => [a.type, a]));

  const categories = ["fatture", "contratti", "report"] as const;

  return (
    <div className="space-y-6" style={{ maxWidth: 860 }}>
      <div>
        <h1 className="font-semibold" style={{ fontSize: 24, letterSpacing: "-0.02em", color: "var(--fg)" }}>
          Automazioni
        </h1>
        <p className="text-[13px]" style={{ color: "var(--fg-3)" }}>
          Configura le azioni automatiche del gestionale. Le automazioni attive vengono eseguite secondo la loro pianificazione.
        </p>
      </div>

      {/* Status banner */}
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-[8px] text-[13px]"
        style={{ backgroundColor: "#4f7deb12", border: "1px solid #4f7deb25", color: "var(--fg-2)" }}
      >
        <Zap className="w-4 h-4 shrink-0" style={{ color: "#4f7deb" }} />
        <span>
          Le automazioni vengono eseguite automaticamente dal server.{" "}
          <span style={{ color: "var(--fg)" }}>
            {stored.filter(a => a.active).length} di {AUTOMATIONS.length} attive.
          </span>
        </span>
      </div>

      {categories.map(cat => {
        const items = AUTOMATIONS.filter(a => a.category === cat);
        const color = CATEGORY_COLORS[cat];
        return (
          <div key={cat}>
            <div className="flex items-center gap-2 mb-3">
              <span
                className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider"
                style={{ backgroundColor: color + "18", color }}
              >
                {CATEGORY_LABELS[cat]}
              </span>
            </div>
            <div className="space-y-3">
              {items.map(def => {
                const record = stateMap[def.type];
                const active = record?.active ?? false;
                const lastRun = record?.lastRunAt;
                return (
                  <div
                    key={def.type}
                    className="rounded-[8px] p-5"
                    style={{
                      backgroundColor: "#ffffff",
                      border: `1px solid ${active ? color + "35" : "var(--border)"}`,
                      transition: "border-color 0.15s",
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span
                          className="w-8 h-8 rounded-[6px] flex items-center justify-center shrink-0 mt-0.5"
                          style={{ backgroundColor: color + "15", color }}
                        >
                          {def.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[14px] font-semibold" style={{ color: "var(--fg)" }}>{def.title}</p>
                            {def.implemented ? (
                              <span
                                className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                                style={{ backgroundColor: "#3b9e6a18", color: "#3b9e6a" }}
                              >
                                ✓ cron attivo
                              </span>
                            ) : (
                              <span
                                className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                                style={{ backgroundColor: "#f9741618", color: "#c2590a" }}
                              >
                                in sviluppo
                              </span>
                            )}
                            {active && def.implemented && (
                              <span
                                className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                                style={{ backgroundColor: "#4f7deb18", color: "#4f7deb" }}
                              >
                                attiva
                              </span>
                            )}
                          </div>
                          <p className="text-[12px] mt-1" style={{ color: "var(--fg-2)" }}>{def.desc}</p>
                          {!def.implemented && (
                            <p className="text-[11px] mt-1" style={{ color: "#c2590a" }}>
                              Il toggle non ha ancora effetto — richiede implementazione del cron endpoint.
                            </p>
                          )}
                          {def.implemented && def.configFields?.map(cf => (
                            <AutomationConfigInput
                              key={cf.field}
                              type={def.type}
                              label={cf.label}
                              field={cf.field}
                              currentValue={(record?.config as Record<string, unknown>)?.[cf.field] as string ?? ""}
                              placeholder={cf.placeholder}
                            />
                          ))}
                          <div className="flex items-center gap-4 mt-2 flex-wrap">
                            <span className="font-mono text-[11px]" style={{ color: "var(--fg-3)" }}>
                              ⏱ {def.schedule}
                            </span>
                            {lastRun && (
                              <span className="font-mono text-[11px]" style={{ color: "var(--fg-3)" }}>
                                · Ultima esecuzione: {new Date(lastRun).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}
                              </span>
                            )}
                            {!lastRun && (
                              <span className="font-mono text-[11px]" style={{ color: "var(--fg-3)" }}>
                                · Mai eseguita
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <AutomationToggle type={def.type} active={active} color={color} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div
        className="p-4 rounded-[8px] text-[12px]"
        style={{ backgroundColor: "var(--subtle)", border: "1px solid var(--border)", color: "var(--fg-3)" }}
      >
        <p className="font-semibold mb-1" style={{ color: "var(--fg-2)" }}>Note sulle automazioni</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>Le automazioni sono pianificate lato server e non richiedono che l'app sia aperta.</li>
          <li>Le email vengono inviate all'indirizzo configurato nelle impostazioni aziendali.</li>
          <li>Puoi attivare o disattivare ogni automazione senza perdere la configurazione.</li>
        </ul>
      </div>
    </div>
  );
}
