import { CopySnippet } from "./CopySnippet";

export function ShareTab({
  origin,
  formId,
  trackingKey,
  active,
}: {
  origin: string;
  formId: string;
  trackingKey: string;
  active: boolean;
}) {
  const publicUrl = `${origin}/f/${formId}`;
  const iframeId = `myb-form-${formId}`;
  const iframeSnippet = `<iframe id="${iframeId}" src="${publicUrl}" style="width:100%;border:0;min-height:400px;" title="Form"></iframe>
<script>
(function () {
  window.addEventListener("message", function (e) {
    if (!e.data || e.data.source !== "myb-form" || !e.data.height) return;
    var el = document.getElementById("${iframeId}");
    if (el) el.style.height = e.data.height + "px";
  });
})();
</script>`;
  const trackingSnippet = `<script async src="${origin}/t.js" data-key="${trackingKey}"></script>`;

  return (
    <div className="max-w-2xl space-y-6">
      {!active && (
        <div className="text-[12px] px-3 py-2 rounded-[var(--r-md)] bg-warn-soft text-warn border border-warn/20">
          Il form è in bozza: salvalo come attivo prima di condividerlo, altrimenti il link e l&apos;embed non funzionano.
        </div>
      )}

      <section className="space-y-2">
        <h3 className="text-[13px] font-semibold text-fg">Link diretto</h3>
        <CopySnippet label="Pagina pubblica del form" code={publicUrl} />
      </section>

      <section className="space-y-2">
        <h3 className="text-[13px] font-semibold text-fg">Incorporato (iframe)</h3>
        <CopySnippet
          label="Codice da incollare nel sito"
          code={iframeSnippet}
          hint="Lo script regola automaticamente l'altezza dell'iframe in base al contenuto del form."
        />
      </section>

      <section className="space-y-2">
        <h3 className="text-[13px] font-semibold text-fg">Tracciamento visite</h3>
        <CopySnippet
          label="Snippet, unico per tutta l'azienda"
          code={trackingSnippet}
          hint="Se il sito lo ha già installato per un altro form, non serve aggiungerlo di nuovo."
        />
      </section>
    </div>
  );
}
