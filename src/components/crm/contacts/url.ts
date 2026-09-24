/**
 * Helper per costruire URL della lista contatti a partire dai searchParams
 * correnti. Filtri, ordinamento, colonne, tab e paginazione vivono tutti
 * nell'URL: ogni componente client aggiorna solo le chiavi che gli
 * competono, il resto resta invariato.
 */
export function patchSearchParams(current: URLSearchParams, patch: Record<string, string | null | undefined>): URLSearchParams {
  const params = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined || value === "") params.delete(key);
    else params.set(key, value);
  }
  // qualsiasi cambio filtro/ordinamento/colonne riparte dalla pagina 1
  if (!("page" in patch)) params.delete("page");
  return params;
}

export function buildHref(pathname: string, current: URLSearchParams, patch: Record<string, string | null | undefined>): string {
  const params = patchSearchParams(current, patch);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
