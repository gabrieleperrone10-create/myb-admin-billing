/**
 * Costruzione dei path con lo slug azienda. Funzione pura, niente direttive:
 * usabile sia dai server component sia dai client component.
 *
 * Le mappe di navigazione (SECTION_MAP, PAGE_CTA, ...) restano con path
 * relativi: il prefisso si applica qui, al momento del render.
 */
export function companyPath(slug: string, path = "/") {
  if (!path.startsWith("/")) path = `/${path}`;
  return path === "/" ? `/${slug}` : `/${slug}${path}`;
}

export function withCompany(slug: string) {
  return (path: string) => companyPath(slug, path);
}

/** Path senza il prefisso azienda: "/acme/invoices/1" -> "/invoices/1". */
export function stripCompany(pathname: string) {
  const rest = pathname.split("/").slice(2).join("/");
  return rest ? `/${rest}` : "/";
}
