export const dynamic = "force-dynamic";

const C = {
  ok:     "#3b9e6a",
  info:   "#4f7deb",
  warn:   "#c78b2a",
  danger: "#dc2626",
  purple: "#8b5cf6",
};

// ── UI Components ─────────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--r-lg)] p-5 md:p-6" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
      <h2 className="text-[15px] font-bold mb-4" style={{ color: "var(--fg)", letterSpacing: "-0.01em" }}>
        {icon && <span className="mr-2">{icon}</span>}{title}
      </h2>
      {children}
    </div>
  );
}

function Step({ step, title, desc }: { step: number; title: string; desc: string }) {
  return (
    <div className="flex gap-3 py-3" style={{ borderBottom: "1px solid var(--subtle)" }}>
      <span
        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-mono text-[11px] font-bold mt-0.5"
        style={{ backgroundColor: C.info + "18", color: C.info }}
      >
        {step}
      </span>
      <div>
        <p className="text-[13px] font-semibold" style={{ color: "var(--fg)" }}>{title}</p>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--fg-3)" }}>{desc}</p>
      </div>
    </div>
  );
}

function Entity({ name, color, desc, links }: { name: string; color: string; desc: string; links: string[] }) {
  return (
    <div className="p-4 rounded-[var(--r-md)]" style={{ backgroundColor: color + "10", border: `1px solid ${color}25` }}>
      <p className="text-[13px] font-bold mb-1" style={{ color }}>{name}</p>
      <p className="text-[12px] mb-2" style={{ color: "var(--fg-2)" }}>{desc}</p>
      {links.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {links.map(l => (
            <span key={l} className="font-mono text-[10px] px-1.5 py-0.5 rounded badge" style={{ backgroundColor: color + "20", color }}>→ {l}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusPill({ label, color, desc }: { label: string; color: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-[var(--r-md)]" style={{ border: "1px solid var(--subtle)" }}>
      <span className="w-2.5 h-2.5 rounded-full shrink-0 mt-1" style={{ backgroundColor: color }} />
      <div>
        <p className="text-[12px] font-semibold" style={{ color: "var(--fg)" }}>{label}</p>
        <p className="text-[11px] mt-0.5" style={{ color: "var(--fg-3)" }}>{desc}</p>
      </div>
    </div>
  );
}

function Tip({ text, color = C.ok }: { text: string; color?: string }) {
  return (
    <div className="flex items-start gap-2.5 py-2.5" style={{ borderBottom: "1px solid var(--subtle)" }}>
      <span className="font-mono text-[10px] mt-0.5 px-1.5 py-0.5 rounded shrink-0 badge" style={{ backgroundColor: color + "18", color }}>TIP</span>
      <p className="text-[13px]" style={{ color: "var(--fg-2)" }}>{text}</p>
    </div>
  );
}

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 py-2" style={{ borderBottom: "1px solid var(--subtle)" }}>
      <span className="text-[12px] font-semibold shrink-0 w-40" style={{ color: "var(--fg-2)" }}>{label}</span>
      <span className="text-[12px]" style={{ color: "var(--fg-3)" }}>{value}</span>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function KnowledgePage() {
  return (
    <div className="space-y-5" style={{ maxWidth: 900 }}>

      {/* Header */}
      <div>
        <h1 className="font-bold" style={{ fontSize: "clamp(20px, 4vw, 26px)", letterSpacing: "-0.025em", color: "var(--fg)" }}>
          Knowledge Base
        </h1>
        <p className="text-[13px] mt-1" style={{ color: "var(--fg-3)" }}>
          Guida completa al gestionale MYB — struttura, flussi, moduli e consigli operativi
        </p>
      </div>

      {/* ── 1. Struttura entità ─────────────────────────────────────────────── */}
      <Section title="Struttura del gestionale" icon="🏗️">
        <p className="text-[13px] mb-4" style={{ color: "var(--fg-2)" }}>
          Il gestionale è diviso in due macro-aree: <strong>Operazioni</strong> (fatturazione, clienti, finanza) e <strong>Team & Formazione</strong> (academy, SOP, eventi).
        </p>

        <p className="text-[11px] font-mono font-semibold uppercase mb-2" style={{ color: "var(--fg-3)", letterSpacing: "0.1em" }}>Operazioni</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
          <Entity name="Clienti" color="#4f7deb" desc="Anagrafica clienti. Punto di partenza per contratti e fatture." links={["Contratti", "Fatture"]} />
          <Entity name="Prodotti & Servizi" color="#a855f7" desc="Catalogo servizi: subscription, coaching, consulenza, digitale." links={["Contratti"]} />
          <Entity name="Contratti" color="#3b9e6a" desc="3 tipi: Ricorrente (rata fissa per periodo), A Rate (importo totale in N rate), Una Tantum (pagamento unico). Generano fatture automaticamente." links={["Fatture", "Depositi"]} />
          <Entity name="Fatture" color="#f97316" desc="Documenti di pagamento emessi al cliente. Ciclo: bozza → inviata → pagata. Eliminabili se in bozza/annullata." links={["Pagamenti"]} />
          <Entity name="Note di credito" color="#dc2626" desc="Storno di una fattura (totale o parziale). Numerazione propria NC-YYYY-NNNN, separata dalle fatture. Generabili dalla fattura o manualmente per fatture vecchie non presenti nel gestionale." links={["Fatture"]} />
          <Entity name="Pagamenti" color="#06b6d4" desc="Registrano l'incasso. STRIPE = pass-through (escluso dai conteggi). BANK_TRANSFER e PAYPAL = entrate reali." links={[]} />
          <Entity name="Depositi" color="#eab308" desc="Caparre sui contratti. Ciclo: atteso → pagato → rimborsato." links={["Pagamenti"]} />
          <Entity name="Spese" color="#dc2626" desc="Costi aziendali categorizzati. Alimentano il calcolo utile netto." links={[]} />
          <Entity name="Obiettivi" color="#8b5cf6" desc="OKR con Key Results (METRIC o MILESTONE). Periodi: Q1-Q4, Annuale, mensili M1-M12. 4 viste: Card, Gantt annuale, Calendario, Planner settimanale." links={[]} />
          <Entity name="Automazioni" color="#f97316" desc="Azioni automatiche: solleciti insoluti, report mensili, fatture ricorrenti." links={[]} />
        </div>

        <p className="text-[11px] font-mono font-semibold uppercase mb-2" style={{ color: "var(--fg-3)", letterSpacing: "0.1em" }}>Team & Formazione</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Entity name="Team" color="#3b9e6a" desc="Gestione membri del team con tag, ruoli e tracking progressi corso." links={["Academy"]} />
          <Entity name="Academy" color="#f97316" desc="Corsi video con moduli, lezioni, allegati e progressi per membro." links={["Team"]} />
          <Entity name="SOP" color="#4f7deb" desc="Procedure operative in rich text. Organizzate per cartelle e tag, con AI assistant." links={["Team"]} />
          <Entity name="Eventi" color="#8b5cf6" desc="Live, workshop, webinar. RSVP, ricorrenze, link Google Calendar." links={["Team"]} />
        </div>
      </Section>

      {/* ── 2. Flusso fatturazione ──────────────────────────────────────────── */}
      <Section title="Flusso operativo — Fatturazione" icon="💶">
        <div className="text-[12px] font-mono px-4 py-3 rounded-[var(--r-md)] mb-4" style={{ backgroundColor: "var(--subtle)", color: "var(--fg-2)" }}>
          Cliente → Prodotto → Contratto → Deposito → Fattura → Pagamento
        </div>
        <Step step={1} title="Crea il cliente" desc="Clienti → Nuovo cliente. Inserisci nome, email, dati fiscali. È il punto di ancoraggio per tutto il resto." />
        <Step step={2} title="Crea il prodotto/servizio" desc="Prodotti & Servizi → Nuovo prodotto. Definisci tipo (subscription, coaching, consulenza, digitale) e prezzo base." />
        <Step step={3} title="Crea il contratto" desc="Collega cliente e prodotto con importo, date e tipo. Se abiliti il deposito, la fattura acconto viene generata automaticamente come bozza." />
        <Step step={4} title="Genera la prima fattura" desc="Dalla pagina di dettaglio contratto, sezione 'Piano fatturazione', clicca 'Genera subito' per creare subito la prima rata senza aspettare il cron." />
        <Step step={5} title="Gestisci il deposito (se presente)" desc="La fattura deposito è già in bozza — inviaLa al cliente. Quando pagata, segnala come pagata dal dettaglio contratto." />
        <Step step={6} title="Invia e incassa" desc="Dalla scheda fattura: scarica PDF, invia via email o WhatsApp, segna il pagamento. Lo stato si aggiorna in cascata." />
        <Step step={7} title="Registra le spese" desc="Spese → Nuova spesa. Seleziona categoria. La dashboard aggiorna istantaneamente utile netto e margine %." />
      </Section>

      {/* ── 3. Flusso Academy ──────────────────────────────────────────────── */}
      <Section title="Flusso operativo — Academy" icon="🎓">
        <div className="text-[12px] font-mono px-4 py-3 rounded-[var(--r-md)] mb-4" style={{ backgroundColor: "var(--subtle)", color: "var(--fg-2)" }}>
          Categoria → Corso → Cartella/Modulo → Lezione → Allegati
        </div>
        <Step step={1} title="Crea una categoria" desc="Academy → + Categoria. Ogni categoria ha un colore e raccoglie più corsi correlati (es. Marketing, Vendita, Operations)." />
        <Step step={2} title="Crea il corso" desc="Dentro la categoria crea un corso. Definisci titolo, descrizione e se è pubblicato o in bozza." />
        <Step step={3} title="Organizza in moduli/cartelle" desc="All'interno del corso crea cartelle (moduli) per organizzare le lezioni per argomento. Supporta sottocartelle annidate." />
        <Step step={4} title="Aggiungi lezioni" desc="Ogni lezione contiene: URL YouTube/Vimeo (embed automatico), descrizione, durata in minuti, stato pubblicato/bozza." />
        <Step step={5} title="Allega materiali" desc="A ogni lezione puoi allegare link esterni o caricare file (PDF, slide, ZIP) via Vercel Blob." />
        <Step step={6} title="Aggiungi membri al team" desc="Team → Aggiungi membro. Assegna tag di ruolo. I membri vedono i corsi assegnati e il loro progresso viene tracciato." />
      </Section>

      {/* ── 4. SOP ─────────────────────────────────────────────────────────── */}
      <Section title="SOP — Standard Operating Procedures" icon="📋">
        <p className="text-[13px] mb-4" style={{ color: "var(--fg-2)" }}>
          Il modulo SOP è il centro operativo per documentare procedure, processi e istruzioni del team. Ogni SOP è un documento rich text con allegati.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
          <div className="p-4 rounded-[var(--r-md)]" style={{ backgroundColor: C.info + "08", border: `1px solid ${C.info}20` }}>
            <p className="text-[12px] font-bold mb-2" style={{ color: C.info }}>Editor Rich Text</p>
            <p className="text-[12px]" style={{ color: "var(--fg-2)" }}>
              Titoli H1/H2/H3, grassetto, corsivo, sottolineato, highlight, allineamento, liste, citazioni, codice, tabelle, link, embed YouTube/Vimeo, separatori.
            </p>
          </div>
          <div className="p-4 rounded-[var(--r-md)]" style={{ backgroundColor: C.ok + "08", border: `1px solid ${C.ok}20` }}>
            <p className="text-[12px] font-bold mb-2" style={{ color: C.ok }}>Organizzazione</p>
            <p className="text-[12px]" style={{ color: "var(--fg-2)" }}>
              Cartelle colorate per area (Marketing, Sales, Ops...). Tag per cross-referenza. Filtro per ruolo. Ricerca full-text.
            </p>
          </div>
          <div className="p-4 rounded-[var(--r-md)]" style={{ backgroundColor: C.purple + "08", border: `1px solid ${C.purple}20` }}>
            <p className="text-[12px] font-bold mb-2" style={{ color: C.purple }}>AI Assistant</p>
            <p className="text-[12px]" style={{ color: "var(--fg-2)" }}>
              Pulsante AI in basso — risponde a domande sulle SOP caricate, fornisce link alle procedure e riassunti. Usa Claude claude-sonnet-4-6 con streaming.
            </p>
          </div>
          <div className="p-4 rounded-[var(--r-md)]" style={{ backgroundColor: C.warn + "08", border: `1px solid ${C.warn}20` }}>
            <p className="text-[12px] font-bold mb-2" style={{ color: C.warn }}>Allegati</p>
            <p className="text-[12px]" style={{ color: "var(--fg-2)" }}>
              Ogni SOP può avere allegati: link esterni o file caricati (PDF, DOCX, PPTX, XLSX, ZIP, immagini) via Vercel Blob.
            </p>
          </div>
        </div>

        <p className="text-[11px] font-mono font-semibold uppercase mb-2" style={{ color: "var(--fg-3)", letterSpacing: "0.1em" }}>Come usare l'AI assistant SOP</p>
        <Step step={1} title="Scrivi le SOP e pubblicale" desc="Solo le SOP in stato 'Pubblica' vengono fornite come contesto all'AI." />
        <Step step={2} title="Apri il pannello AI" desc="Clicca il pulsante 'AI SOP' in basso a destra (su mobile si apre come bottom sheet)." />
        <Step step={3} title="Fai domande in linguaggio naturale" desc="L'AI conosce tutte le procedure e risponde con riferimenti e link diretti alle SOP pertinenti." />
      </Section>

      {/* ── 5. Events ──────────────────────────────────────────────────────── */}
      <Section title="Gestione Eventi" icon="📅">
        <p className="text-[13px] mb-4" style={{ color: "var(--fg-2)" }}>
          Il modulo eventi gestisce le sessioni del team: live, workshop, webinar, registrazioni.
        </p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { tipo: "Live",          color: "#dc2626", desc: "Sessione in diretta, streaming o presenza fisica" },
            { tipo: "Workshop",      color: "#8b5cf6", desc: "Sessione pratica con esercizi e interazione" },
            { tipo: "Webinar",       color: "#4f7deb", desc: "Presentazione online con Q&A" },
            { tipo: "Registrazione", color: "#6b7280", desc: "Video registrato da rivedere in autonomia" },
          ].map(e => (
            <div key={e.tipo} className="flex items-start gap-2 p-3 rounded-[var(--r-md)]" style={{ border: "1px solid var(--subtle)" }}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0 mt-1" style={{ backgroundColor: e.color }} />
              <div>
                <p className="text-[12px] font-semibold" style={{ color: "var(--fg)" }}>{e.tipo}</p>
                <p className="text-[11px]" style={{ color: "var(--fg-3)" }}>{e.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-0">
          <Kv label="Ricorrenza" value="One-time, Giornaliero, Settimanale, Mensile, Custom (ogni N giorni)" />
          <Kv label="RSVP" value="I membri del team confermano la partecipazione. Il contatore è visibile sulla card." />
          <Kv label="Link meeting" value="Aggiungi URL Meet/Zoom/Teams direttamente sull'evento." />
          <Kv label="Google Calendar" value="Ogni evento futuro ha il pulsante 'Aggiungi al calendario Google' — pre-compila titolo, data e link." />
        </div>
      </Section>

      {/* ── 6. Stati fattura ────────────────────────────────────────────────── */}
      <Section title="Stati delle fatture" icon="🔄">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <StatusPill label="Bozza"     color="#94a3b8" desc="Creata, non inviata. Modificabile liberamente." />
          <StatusPill label="Inviata"   color="#4f7deb" desc="Inviata al cliente. In attesa di pagamento." />
          <StatusPill label="Pagata"    color="#3b9e6a" desc="Incassata. Contribuisce alle entrate del periodo." />
          <StatusPill label="Insoluta"  color="#dc2626" desc="Scaduta senza pagamento. Appare negli alert dashboard." />
          <StatusPill label="Annullata" color="#94a3b8" desc="Stornata. Non entra in nessun calcolo." />
        </div>
      </Section>

      {/* ── 6bis. Note di credito ───────────────────────────────────────────── */}
      <Section title="Note di credito" icon="↩️">
        <p className="text-[13px] mb-4" style={{ color: "var(--fg-2)" }}>
          Storno di una fattura, totale o parziale. Hanno una numerazione propria (<strong>NC-YYYY-NNNN</strong>), separata da quella delle fatture, e non modificano automaticamente lo stato della fattura collegata.
        </p>

        <p className="text-[11px] font-mono font-semibold uppercase mb-2" style={{ color: "var(--fg-3)", letterSpacing: "0.1em" }}>Due modi per generarla</p>
        <Step step={1} title="Da una fattura esistente" desc="Nel dettaglio fattura (stato Inviata/Pagata/Scaduta), pulsante 'Nota di credito' → conferma importo (default: totale fattura, modificabile per storni parziali) e motivo." />
        <Step step={2} title="Manuale, per fatture vecchie" desc="Note di credito → Nuova nota di credito. Per fatture non presenti nel gestionale: cliente (da anagrafica o inserito a mano), numero/data fattura originale, importo e motivo." />

        <p className="text-[11px] font-mono font-semibold uppercase mb-2 mt-5" style={{ color: "var(--fg-3)", letterSpacing: "0.1em" }}>Stati</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <StatusPill label="Emessa"    color="#4f7deb" desc="Documento numerato, non ancora inviato al cliente. Eliminabile." />
          <StatusPill label="Inviata"   color="#3b9e6a" desc="Inviata via email al cliente con PDF allegato. Non più eliminabile." />
          <StatusPill label="Annullata" color="#94a3b8" desc="Invalidata manualmente. Non entra in nessun calcolo." />
        </div>
      </Section>

      {/* ── 7. Dashboard ────────────────────────────────────────────────────── */}
      <Section title="Come leggere la dashboard" icon="📊">
        <div className="space-y-0">
          {[
            { label: "Saldo CC",            color: C.ok,     desc: "Saldo banca inserito manualmente + movimenti automatici da quella data. Nascondibile con l'occhio 👁. Solo per il titolare." },
            { label: "Volume vendite",      color: C.info,   desc: "Valore totale dei nuovi contratti firmati nel periodo (non le fatture — i contratti). Misura quanto hai venduto." },
            { label: "Entrate · periodo",   color: C.ok,     desc: "Somma pagamenti incassati nel periodo (BANK_TRANSFER + PayPal). I pagamenti STRIPE sono esclusi — sono pass-through Multiplicator." },
            { label: "Spese · periodo",     color: C.danger, desc: "Totale spese registrate nel periodo, per tutte le categorie." },
            { label: "Utile netto",         color: C.ok,     desc: "Entrate − Spese. Verde = positivo, rosso = perdita. Il % mostra il margine di profitto." },
            { label: "Da incassare",        color: C.warn,   desc: "Somma delle fatture in stato 'Inviata' — crediti ancora aperti." },
            { label: "Andamento 12 mesi",   color: C.info,   desc: "Grafico ad area: entrate (verde) vs spese (rosso) negli ultimi 12 mesi." },
            { label: "Andamento 30 giorni", color: C.info,   desc: "Grafico giornaliero degli ultimi 30 giorni di incasso." },
            { label: "Previsione cashflow", color: C.ok,     desc: "Proiezione sui prossimi 6 mesi basata sui contratti ricorrenti attivi." },
            { label: "Mix pagamenti",       color: C.info,   desc: "Ripartizione entrate per metodo: Stripe, PayPal, Bonifico." },
            { label: "Stato fatture",       color: C.info,   desc: "Barre proporzionali per stato (pagate/inviate/insolute) sul periodo." },
            { label: "Spese per categoria", color: C.danger, desc: "Top 5 categorie di spesa del periodo con barre di confronto." },
          ].map(k => (
            <div key={k.label} className="flex items-start gap-3 py-2.5" style={{ borderBottom: "1px solid var(--subtle)" }}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-2" style={{ backgroundColor: k.color }} />
              <div>
                <span className="text-[12px] font-semibold" style={{ color: "var(--fg)" }}>{k.label}: </span>
                <span className="text-[12px]" style={{ color: "var(--fg-2)" }}>{k.desc}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[12px] mt-4" style={{ color: "var(--fg-3)" }}>
          Il selettore periodo (Oggi / Settimana / Mese / Anno / Da sempre / Custom) filtra tutti i KPI simultaneamente.
        </p>
      </Section>

      {/* ── 8. Contratti — tipi e logica ────────────────────────────────────── */}
      <Section title="Tipi di contratto" icon="📄">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          {[
            { tipo: "Ricorrente", color: C.ok,   desc: "Rata fissa ogni periodo (mensile/trimestrale/annuale). Va avanti finché non lo disattivi o fino alla data fine. L'importo è la rata per periodo." },
            { tipo: "A Rate",     color: C.info,  desc: "Importo totale diviso in N rate con frequenza propria. Es: percorso 6 mesi pagato in 3 rate mensili. Il cron si ferma dopo l'ultima rata." },
            { tipo: "Una Tantum", color: C.warn,  desc: "Pagamento unico, una sola fattura generata. Può avere deposito. Nessuna fattura successiva." },
          ].map(t => (
            <div key={t.tipo} className="p-4 rounded-[var(--r-md)]" style={{ backgroundColor: t.color + "08", border: `1px solid ${t.color}25` }}>
              <p className="text-[13px] font-bold mb-1" style={{ color: t.color }}>{t.tipo}</p>
              <p className="text-[12px]" style={{ color: "var(--fg-2)" }}>{t.desc}</p>
            </div>
          ))}
        </div>
        <div className="space-y-0">
          <Kv label="Genera subito"       value="Dal dettaglio contratto → 'Piano fatturazione' → bottone 'Genera subito'. Crea la prossima rata come bozza e apre direttamente la fattura." />
          <Kv label="Giorno fatturazione" value="Determina il giorno del mese in cui il cron auto-genera le rate successive. Suggerimento: metti lo stesso giorno della startDate così le date coincidono sempre." />
          <Kv label="Deposito auto"      value="Se crei un contratto con deposito, la fattura acconto viene generata automaticamente come bozza. Quando la segni pagata, la fattura si aggiorna a PAID (non crea duplicati)." />
          <Kv label="Elimina contratto"  value="Visibile solo se non ci sono fatture pagate. Elimina automaticamente anche le fatture bozza collegate." />
          <Kv label="Elimina fattura"    value="Solo su fatture in stato Bozza o Annullata. Non eliminabile se già inviata o pagata." />
          <Kv label="Cron generazione"   value="Ogni giorno il cron controlla i contratti attivi e genera la rata successiva se la data è scaduta." />
        </div>
      </Section>

      {/* ── 9. Automazioni ──────────────────────────────────────────────────── */}
      <Section title="Automazioni disponibili" icon="⚡">
        <div className="space-y-0">
          <Kv label="Promemoria insolute" value="Email automatica al team quando una fattura supera la scadenza. Configurabile ogni N giorni." />
          <Kv label="Alert insolute"      value="Notifica istantanea quando una fattura passa in stato OVERDUE." />
          <Kv label="Report mensile"      value="Riepilogo mensile delle performance inviato via email a fine mese." />
          <Kv label="Fatture ricorrenti"  value="Generazione automatica delle fatture per tutti i tipi di contratto attivi. Gira ogni giorno alle 9:00." />
          <Kv label="Cron schedule"       value="Le automazioni girano come Vercel Cron Jobs alle 9:00 ogni giorno." />
        </div>
      </Section>

      {/* ── 9. Categorie spese ──────────────────────────────────────────────── */}
      <Section title="Categorie di spesa" icon="🧾">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {[
            { cat: "⚙️  Software & Tools",    desc: "Abbonamenti SaaS, licenze, strumenti digitali" },
            { cat: "📣  Marketing & Ads",     desc: "Pubblicità, campagne, materiali promozionali" },
            { cat: "👥  Personale",           desc: "Stipendi, contributi, benefit dipendenti" },
            { cat: "🤝  Collaboratori",       desc: "Freelancer, consulenti, subappaltatori" },
            { cat: "🖥️  Infrastruttura",      desc: "Server, hosting, cloud, hardware" },
            { cat: "⚖️  Legale & Fiscale",   desc: "Commercialista, avvocato, notaio, bolli" },
            { cat: "✈️  Trasferte",           desc: "Viaggi, trasporti, alloggi, rimborsi km" },
            { cat: "📦  Ufficio & Materiali", desc: "Forniture, attrezzature, cancelleria" },
            { cat: "🏛️  Tasse & Imposte",    desc: "IVA, IRES, IRAP, contributi previdenziali" },
            { cat: "📌  Altro",               desc: "Costi non classificabili in altre categorie" },
          ].map(s => (
            <div key={s.cat} className="p-3 rounded-[var(--r-md)]" style={{ border: "1px solid var(--subtle)" }}>
              <p className="text-[12px] font-semibold" style={{ color: "var(--fg)" }}>{s.cat}</p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--fg-3)" }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 10. Funzionalità app ────────────────────────────────────────────── */}
      <Section title="Funzionalità dell'app" icon="📱">
        <div className="space-y-0">
          <Kv label="PWA installabile"   value="L'app può essere installata su iPhone/Android come app nativa dal browser (Safari → Aggiungi a schermata Home)." />
          <Kv label="Dark mode"          value="Attivabile dal toggle luna/sole in basso nella sidebar (desktop) o nell'header mobile. Persiste tra le sessioni." />
          <Kv label="Navigazione mobile" value="Bottom bar con 5 tab: Home, Fatture, Clienti, Spese, Altro. 'Altro' apre un drawer con tutti i moduli." />
          <Kv label="Export CSV"         value="Ogni sezione principale ha il bottone 'CSV' (desktop) per esportare i dati filtrati." />
          <Kv label="PDF fatture"        value="Ogni fattura ha il bottone 'Scarica PDF' — generato lato server con @react-pdf/renderer." />
          <Kv label="Invio email"        value="Le fatture possono essere inviate via email direttamente dal gestionale (Resend)." />
          <Kv label="Invio WhatsApp"     value="Le fatture hanno il pulsante WhatsApp per condividere il link in un click." />
          <Kv label="File storage"       value="Allegati (SOP, Academy) vengono caricati su Vercel Blob Store 'academy-files'." />
          <Kv label="AI assistant"       value="Disponibile nella sezione SOP — powered by Claude claude-sonnet-4-6 con streaming real-time." />
          <Kv label="Autenticazione"     value="Gestita da Clerk. Solo utenti autenticati accedono al gestionale." />
        </div>
      </Section>

      {/* ── 11. Utenti & Controllo accessi ─────────────────────────────────── */}
      <Section title="Utenti & Controllo accessi" icon="🔐">
        <p className="text-[13px] mb-4" style={{ color: "var(--fg-3)" }}>
          Il sistema di accesso è role-based (RBAC). Ogni utente può avere più ruoli; i permessi si sommano (vince sempre il livello più alto).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          {[
            { name: "Owner", color: "#dc2626", desc: "Accesso FULL a tutto. Ruolo di sistema, non eliminabile." },
            { name: "Admin", color: "#f97316", desc: "Accesso FULL a tutto tranne la gestione degli Owner." },
            { name: "Manager", color: "#8b5cf6", desc: "EDIT su operazioni, VIEW su impostazioni/utenti." },
            { name: "Editor", color: "#4f7deb", desc: "EDIT solo su contenuti: Academy, SOP, Events, Knowledge." },
            { name: "Viewer", color: "#6b7280", desc: "VIEW su tutte le sezioni. Nessuna modifica possibile." },
          ].map(r => (
            <div key={r.name} className="p-3 rounded-[var(--r-md)] flex gap-2.5 items-start" style={{ border: "1px solid var(--border)" }}>
              <div className="w-2.5 h-2.5 rounded-full shrink-0 mt-1" style={{ backgroundColor: r.color }} />
              <div>
                <p className="text-[13px] font-semibold" style={{ color: "var(--fg)" }}>{r.name}</p>
                <p className="text-[12px]" style={{ color: "var(--fg-3)" }}>{r.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[12px]">
          {[
            { level: "NONE",  label: "Nessuno",    desc: "Sezione nascosta" },
            { level: "VIEW",  label: "Visualizza", desc: "Solo lettura" },
            { level: "EDIT",  label: "Modifica",   desc: "Crea e modifica" },
            { level: "FULL",  label: "Completo",   desc: "Include eliminazione" },
          ].map(l => (
            <div key={l.level} className="p-2.5 rounded-[var(--r-md)]" style={{ backgroundColor: "var(--subtle)" }}>
              <p className="font-semibold font-mono text-[10px] uppercase mb-0.5" style={{ color: "var(--fg-2)" }}>{l.level}</p>
              <p className="font-medium text-[12px]" style={{ color: "var(--fg)" }}>{l.label}</p>
              <p style={{ color: "var(--fg-3)" }}>{l.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-0">
          <Kv label="Invita utenti"    value="Settings → Utenti → 'Invita utente'. Clerk invia un'email con link di registrazione." />
          <Kv label="Assegna ruoli"    value="Dopo che l'utente si è registrato, clicca 'Ruoli' nella riga utente per aggiungere/rimuovere ruoli." />
          <Kv label="Crea ruoli custom" value="Settings → Ruoli → 'Nuovo ruolo'. Poi clicca 'Modifica' per configurare i permessi sezione per sezione." />
          <Kv label="Setup mode"       value="Finché nessun ruolo è assegnato, tutti gli utenti hanno accesso completo. Il sistema si attiva solo dopo la prima assegnazione." />
          <Kv label="Multi-ruolo"      value="Un utente può avere più ruoli contemporaneamente. I permessi vengono sommati (si prende il livello più alto per ogni sezione)." />
        </div>
      </Section>

      {/* ── 12. Obiettivi OKR ──────────────────────────────────────────────── */}
      <Section title="Obiettivi & OKR" icon="🎯">
        <p className="text-[13px] mb-4" style={{ color: "var(--fg-2)" }}>
          Il modulo obiettivi segue la metodologia OKR (Objectives & Key Results). Ogni obiettivo ha Key Results che misurano il progresso.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          {[
            { name: "Card view",            color: C.info,   desc: "Vista principale: una card per obiettivo con KR, progress bar, check-in e note." },
            { name: "Gantt annuale",        color: C.ok,     desc: "Vista a 12 colonne (mesi): barre colorate che mostrano la durata di ogni obiettivo nell'anno." },
            { name: "Calendario mensile",   color: C.purple, desc: "Vista calendario: mostra check-in e scadenze KR per giorno." },
            { name: "Planner settimanale",  color: C.warn,   desc: "Vista settimana: 7 colonne con obiettivi e KR in scadenza per ogni giorno." },
          ].map(v => (
            <div key={v.name} className="p-3 rounded-[var(--r-md)]" style={{ backgroundColor: v.color + "08", border: `1px solid ${v.color}25` }}>
              <p className="text-[12px] font-bold mb-1" style={{ color: v.color }}>{v.name}</p>
              <p className="text-[12px]" style={{ color: "var(--fg-2)" }}>{v.desc}</p>
            </div>
          ))}
        </div>
        <div className="space-y-0">
          <Kv label="Tipi KR"       value="METRIC (valore numerico con target, es. '€50.000 fatturato') · MILESTONE (completato sì/no)" />
          <Kv label="Data source"   value="I KR metrici possono agganciarsi a dati reali: fatturato incassato, clienti attivi, spese totali, contratti" />
          <Kv label="Periodi"       value="Q1 · Q2 · Q3 · Q4 · Annuale · Mensili M1-M12 (richiede SQL su Supabase per i mesi)" />
          <Kv label="Check-in"      value="Note di avanzamento aggiungibili a ogni obiettivo. Appaiono nel calendario e nel planner." />
        </div>
      </Section>

      {/* ── 13. Consigli operativi ──────────────────────────────────────────── */}
      <Section title="Consigli operativi" icon="💡">
        <Tip text="Registra le spese mensilmente: la dashboard P&L è tanto più utile quanto più è aggiornata." />
        <Tip text="Usa i contratti ricorrenti e attiva l'automazione 'Fatture ricorrenti' per non dimenticare mai una fattura mensile." />
        <Tip text="Attiva l'automazione 'Promemoria insolute' con cadenza settimanale per sollecitare automaticamente i clienti morosi." />
        <Tip text="Esporta i dati in CSV da ogni sezione per importarli nel tuo software di contabilità (es. FattureInCloud, Xero)." />
        <Tip text="Il filtro periodo in alto sincronizza tutti i KPI della dashboard — usa 'Questo mese' come vista predefinita." />
        <Tip text="Il codice fattura (es. MYB-2026-001) è generato automaticamente in ordine crescente. Puoi personalizzarlo manualmente." />
        <Tip text="Pubblica le SOP prima di usare l'AI assistant: solo le SOP pubblicate vengono caricate come contesto." />
        <Tip text="Organizza l'Academy in categorie (es. Marketing, Sales, Tech): i moduli annidati permettono percorsi strutturati." />
        <Tip text="Installa l'app su iPhone: Safari → icona condividi → 'Aggiungi a schermata Home'. Si apre in modalità standalone." color={C.info} />
        <Tip text="Assegna il ruolo Owner a te stesso prima di assegnare qualsiasi altro ruolo, per non perdere l'accesso al gestionale." color={C.warn} />
        <Tip text="I pagamenti STRIPE sono esclusi dai conteggi entrate — rappresentano pass-through Multiplicator. Il bonifico consolidato mensile da Stripe va registrato come BANK_TRANSFER." color={C.warn} />
        <Tip text="Per i contratti A Rate: l'importo inserito è il TOTALE, il sistema divide automaticamente per il numero di rate." />
        <Tip text="Dopo aver creato un contratto, vai subito nel dettaglio → 'Piano fatturazione' → 'Genera subito' per emettere la prima fattura senza aspettare il cron del giorno dopo." color={C.info} />
        <Tip text="Giorno di fatturazione: metti lo stesso giorno del mese della startDate (es. startDate=8 giugno → giorno 8). Le rate successive verranno auto-generate sempre quel giorno." />
        <Tip text="Aggiorna il Saldo CC ogni volta che controlli il conto corrente: il sistema calcola automaticamente il delta da quella data." color={C.info} />
        <Tip text="Usa la ricerca globale (CMD+K) per trovare qualsiasi cosa: clienti, fatture, contratti, prodotti, spese, SOP, eventi, team." color={C.info} />
      </Section>

    </div>
  );
}
