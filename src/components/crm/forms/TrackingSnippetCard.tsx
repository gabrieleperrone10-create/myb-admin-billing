import { CopySnippet } from "./CopySnippet";

/** Sezione "Tracciamento" della pagina /forms: script unico dell'azienda, da installare su ogni pagina del sito. */
export function TrackingSnippetCard({ origin, trackingKey }: { origin: string; trackingKey: string }) {
  const snippet = `<script async src="${origin}/t.js" data-key="${trackingKey}"></script>`;

  return (
    <section className="bg-surface border border-border rounded-[var(--r-lg)] p-4 space-y-3">
      <div>
        <h2 className="text-[15px] font-semibold text-fg">Tracciamento visite</h2>
        <p className="text-[12px] text-fg-3 mt-0.5">
          Incolla questo script prima della chiusura di <code>&lt;/body&gt;</code> su ogni pagina del sito: registra le
          visite dei visitatori e, quando compilano un form, collega automaticamente la loro cronologia al contatto.
        </p>
      </div>
      <CopySnippet
        label="Snippet di tracciamento"
        code={snippet}
        hint="Funziona su qualunque sito, anche fuori da questo gestionale. Rispetta Do Not Track."
      />
    </section>
  );
}
