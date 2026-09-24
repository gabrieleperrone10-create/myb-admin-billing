/**
 * Sanificazione dell'HTML delle note (modulo puro: usato dalle server action
 * in scrittura E dal componente NoteCard in lettura, cosi' una nota salvata da
 * un percorso che si e' dimenticato di sanificare non diventa comunque XSS).
 */

/**
 * Whitelist di tag semplice per l'HTML delle note (niente librerie nuove).
 * Rimuove script/style/commenti, scarta ogni tag non in whitelist (tenendo il
 * testo dentro), e su <a> tiene solo un href http(s)/mailto validato — cosi'
 * anche un "on*" o uno stile inline arrivato per errore dall'editor sparisce,
 * perche' NESSUN attributo sopravvive tranne quell'href ricostruito a mano.
 */
const NOTE_ALLOWED_TAGS = new Set([
  "p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "a", "blockquote", "code", "h1", "h2", "h3",
]);

export function sanitizeNoteHtml(html: string): string {
  let out = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "");
  out = out.replace(/<!--[\s\S]*?-->/g, "");
  out = out.replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (match, tagRaw: string, attrsRaw: string) => {
    const tag = String(tagRaw).toLowerCase();
    const isClosing = match.startsWith("</");
    if (!NOTE_ALLOWED_TAGS.has(tag)) return "";
    if (isClosing) return `</${tag}>`;
    if (tag === "a") {
      const hrefMatch = /href\s*=\s*"([^"]*)"|href\s*=\s*'([^']*)'/i.exec(attrsRaw);
      const href = (hrefMatch ? hrefMatch[1] ?? hrefMatch[2] : "") ?? "";
      const safeHref = /^(https?:|mailto:)/i.test(href.trim()) ? href.trim() : "";
      return safeHref ? `<a href="${safeHref.replace(/"/g, "&quot;")}" target="_blank" rel="noopener noreferrer nofollow">` : "<a>";
    }
    return `<${tag}>`;
  });
  return out.trim();
}

export function htmlToPreview(html: string, max = 140): string {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}


/** Nota scritta come testo semplice (es. textarea delle opportunita') -> HTML sicuro. */
export function plainTextToNoteHtml(text: string): string {
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc.split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
}
