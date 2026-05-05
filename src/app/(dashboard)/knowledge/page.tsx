export const dynamic = "force-dynamic";

const C = {
  ok:   "#3b9e6a",
  info: "#4f7deb",
  warn: "#c78b2a",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[8px] p-6" style={{ backgroundColor: "#ffffff", border: "1px solid var(--border)" }}>
      <h2 className="text-[15px] font-semibold mb-4" style={{ color: "var(--fg)", letterSpacing: "-0.01em" }}>{title}</h2>
      {children}
    </div>
  );
}

function HowTo({ step, title, desc }: { step: number; title: string; desc: string }) {
  return (
    <div className="flex gap-3 py-3" style={{ borderBottom: "1px solid var(--subtle)" }}>
      <span
        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-mono text-[11px] font-semibold mt-0.5"
        style={{ backgroundColor: C.info + "18", color: C.info }}
      >
        {step}
      </span>
      <div>
        <p className="text-[13px] font-medium" style={{ color: "var(--fg)" }}>{title}</p>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--fg-3)" }}>{desc}</p>
      </div>
    </div>
  );
}

function Entity({ name, color, desc, links }: { name: string; color: string; desc: string; links: string[] }) {
  return (
    <div className="p-4 rounded-[6px]" style={{ backgroundColor: color + "10", border: `1px solid ${color}25` }}>
      <p className="text-[13px] font-semibold mb-1" style={{ color }}>{name}</p>
      <p className="text-[12px] mb-2" style={{ color: "var(--fg-2)" }}>{desc}</p>
      {links.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {links.map(l => (
            <span key={l} className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: color + "20", color }}>→ {l}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function KnowledgePage() {
  return (
    <div className="space-y-5" style={{ maxWidth: 860 }}>

      <div>
        <h1 className="font-semibold" style={{ fontSize: 24, letterSpacing: "-0.02em", color: "var(--fg)" }}>
          Knowledge Base
        </h1>
        <p className="text-[13px]" style={{ color: "var(--fg-3)" }}>
          Struttura del gestionale, guide operative e relazioni tra gli elementi
        </p>
      </div>

      {/* Struttura entità */}
      <Section title="Struttura del gestionale">
        <p className="text-[13px] mb-4" style={{ color: "var(--fg-2)" }}>
          Il gestionale è organizzato attorno a 8 entità principali, collegate tra loro in modo gerarchico.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Entity name="Clienti" color="#4f7deb" desc="Anagrafica dei tuoi clienti. Punto di partenza per contratti e fatture." links={["Contratti", "Fatture"]} />
          <Entity name="Prodotti & Servizi" color="#a855f7" desc="Catalogo di ciò che vendi: subscription, coaching, consulenza, digitale." links={["Contratti"]} />
          <Entity name="Contratti" color="#3b9e6a" desc="Collegano un cliente a un prodotto. Possono essere ricorrenti o one-shot." links={["Fatture", "Depositi"]} />
          <Entity name="Fatture" color="#f97316" desc="Documenti di pagamento emessi al cliente. Hanno uno stato (bozza → inviata → pagata)." links={["Pagamenti"]} />
          <Entity name="Pagamenti" color="#06b6d4" desc="Registrano l'effettivo incasso di una fattura o di un deposito." links={[]} />
          <Entity name="Depositi" color="#eab308" desc="Caparre associate ai contratti. Hanno un proprio ciclo di vita (atteso → pagato)." links={["Pagamenti"]} />
          <Entity name="Spese" color="#dc2626" desc="Costi aziendali categorizzati. Usati per calcolare utile netto e marginalità." links={[]} />
          <Entity name="Automazioni" color="#8b5cf6" desc="Azioni automatiche configurabili: solleciti, report, creazione fatture ricorrenti." links={[]} />
        </div>
      </Section>

      {/* Flusso tipico */}
      <Section title="Flusso operativo tipico">
        <div className="text-[12px] font-mono px-4 py-3 rounded-[6px] mb-4" style={{ backgroundColor: "var(--subtle)", color: "var(--fg-2)" }}>
          Cliente → Prodotto → Contratto → Deposito → Fattura → Pagamento
        </div>
        <div className="space-y-0">
          <HowTo step={1} title="Crea il cliente" desc="Vai in Clienti → Nuovo cliente. Inserisci nome, email e dati fiscali. Il cliente sarà disponibile per contratti e fatture." />
          <HowTo step={2} title="Crea il prodotto/servizio" desc="Vai in Prodotti & Servizi → Nuovo prodotto. Definisci nome, tipo e prezzo base. Questo diventa il template per i contratti." />
          <HowTo step={3} title="Crea il contratto" desc="Collega cliente e prodotto con importo, data inizio e tipo (ricorrente o one-shot). Puoi aggiungere un deposito obbligatorio." />
          <HowTo step={4} title="Gestisci il deposito (se presente)" desc="Dal dettaglio contratto segna il deposito come pagato quando ricevi il bonifico. Questo registra automaticamente un pagamento." />
          <HowTo step={5} title="Emetti la fattura" desc="Vai in Fatture → Nuova fattura. Seleziona cliente e contratto, i dati vengono precompilati. Puoi aggiungere line items personalizzati." />
          <HowTo step={6} title="Invia e incassa" desc="Dalla scheda fattura puoi inviarla via email, scaricare il PDF e segnare il pagamento. Lo stato si aggiorna automaticamente." />
          <HowTo step={7} title="Registra le spese" desc="Vai in Spese → Nuova spesa. Seleziona la categoria e l'importo. La dashboard calcola automaticamente utile netto e margine." />
        </div>
      </Section>

      {/* Stati fattura */}
      <Section title="Stati delle fatture">
        <div className="grid grid-cols-2 gap-3">
          {[
            { stato: "Bozza",    color: "#94a3b8", desc: "Fattura creata ma non ancora inviata al cliente. Modificabile." },
            { stato: "Inviata",  color: "#4f7deb", desc: "Fattura inviata al cliente. In attesa di pagamento." },
            { stato: "Pagata",   color: "#3b9e6a", desc: "Pagamento ricevuto e registrato. Fattura chiusa." },
            { stato: "Insoluta", color: "#dc4040", desc: "La data di scadenza è passata senza pagamento. Compare negli alert dashboard." },
            { stato: "Annullata",color: "#94a3b8", desc: "Fattura annullata. Non contribuisce a nessun calcolo." },
          ].map(s => (
            <div key={s.stato} className="flex items-start gap-3 p-3 rounded-[6px]" style={{ border: "1px solid var(--subtle)" }}>
              <span className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: s.color }} />
              <div>
                <p className="text-[12px] font-semibold" style={{ color: "var(--fg)" }}>{s.stato}</p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--fg-3)" }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Dashboard KPI */}
      <Section title="Come leggere la dashboard">
        <div className="space-y-3">
          {[
            { label: "Entrate · periodo",  color: "#3b9e6a", desc: "Somma degli incassi effettivi (pagamenti registrati) nel periodo selezionato. Confrontata con il periodo precedente." },
            { label: "Spese · periodo",    color: "#dc4040", desc: "Totale delle spese registrate nel periodo. Include tutte le categorie." },
            { label: "Utile netto",        color: "#3b9e6a", desc: "Entrate meno Spese. Verde = positivo, rosso = perdita. Il margine % mostra l'efficienza." },
            { label: "Da incassare",       color: "#c78b2a", desc: "Somma delle fatture in stato 'Inviata'. Crediti non ancora incassati." },
            { label: "Previsione cashflow",color: "#4f7deb", desc: "Proiezione sui prossimi 6 mesi basata sui contratti ricorrenti attivi." },
          ].map(k => (
            <div key={k.label} className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-2" style={{ backgroundColor: k.color }} />
              <div>
                <span className="text-[12px] font-semibold" style={{ color: "var(--fg)" }}>{k.label}: </span>
                <span className="text-[12px]" style={{ color: "var(--fg-2)" }}>{k.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Categorie spese */}
      <Section title="Categorie di spesa">
        <div className="grid grid-cols-2 gap-2">
          {[
            { cat: "Software & Tools",   desc: "Abbonamenti SaaS, licenze, strumenti digitali" },
            { cat: "Marketing & Ads",    desc: "Pubblicità, campagne, materiali promozionali" },
            { cat: "Personale",          desc: "Stipendi, contributi, benefit dipendenti" },
            { cat: "Collaboratori",      desc: "Freelancer, consulenti, subappaltatori" },
            { cat: "Infrastruttura",     desc: "Server, hosting, cloud, hardware" },
            { cat: "Legale & Fiscale",   desc: "Commercialista, avvocato, notaio, bolli" },
            { cat: "Trasferte",          desc: "Viaggi, trasporti, alloggi, rimborsi km" },
            { cat: "Ufficio & Materiali",desc: "Forniture, attrezzature, cancelleria" },
            { cat: "Tasse & Imposte",    desc: "IVA, IRES, IRAP, contributi previdenziali" },
            { cat: "Altro",              desc: "Costi non classificabili nelle categorie sopra" },
          ].map(s => (
            <div key={s.cat} className="p-3 rounded-[6px]" style={{ border: "1px solid var(--subtle)" }}>
              <p className="text-[12px] font-medium" style={{ color: "var(--fg)" }}>{s.cat}</p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--fg-3)" }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Tips */}
      <Section title="Consigli operativi">
        <div className="space-y-2">
          {[
            "Registra le spese mensilmente per avere la dashboard P&L sempre aggiornata.",
            "Usa i contratti ricorrenti per generare fatture mensili in modo consistente.",
            "Attiva le automazioni per ricevere alert quando una fattura diventa insoluta.",
            "Esporta i dati in CSV per importarli nel tuo software di contabilità.",
            "Il filtro periodo nella topbar sincronizza la vista su tutte le pagine.",
            "Il codice fattura viene generato automaticamente (es. MYB-2026-001). Puoi personalizzarlo.",
          ].map((tip, i) => (
            <div key={i} className="flex items-start gap-2.5 py-2" style={{ borderBottom: "1px solid var(--subtle)" }}>
              <span className="font-mono text-[10px] mt-0.5 px-1.5 py-0.5 rounded" style={{ backgroundColor: C.ok + "18", color: C.ok }}>TIP</span>
              <p className="text-[13px]" style={{ color: "var(--fg-2)" }}>{tip}</p>
            </div>
          ))}
        </div>
      </Section>

    </div>
  );
}
