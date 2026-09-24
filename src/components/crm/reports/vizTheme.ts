/**
 * Colori dei grafici dei report. Palette categoriale validata (skill dataviz,
 * validate_palette.js: CVD e normal-vision ok in chiaro e scuro, ordine fisso):
 *   serie 1 = lead (blu), serie 2 = vinte (arancio), serie 3 = incassato (acqua).
 * Il colore segue l'entita': "incassato" e' acqua in ogni grafico dei report.
 * L'acqua in tema chiaro ha contrasto < 3:1 sulla superficie: per questo ogni
 * grafico ha la vista tabella e le etichette di testo usano i token del testo.
 * Il tema scuro dell'app e' `[data-theme="dark"]` (vedi globals.css).
 */
export const REPORT_VIZ_CSS = `
.rep-viz {
  --rep-s1: #2a78d6;
  --rep-s2: #eb6834;
  --rep-s3: #1baf7a;
  --rep-s1-soft: #cde2fb;
  --rep-grid: var(--border);
  --rep-axis: var(--fg-3);
}
[data-theme="dark"] .rep-viz {
  --rep-s1: #3987e5;
  --rep-s2: #d95926;
  --rep-s3: #199e70;
  --rep-s1-soft: #184f95;
}
`;

export const SERIES = {
  leads: "var(--rep-s1)",
  won: "var(--rep-s2)",
  collected: "var(--rep-s3)",
} as const;
