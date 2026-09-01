"use client";
import { useParams } from "next/navigation";
import { useCallback } from "react";
import { companyPath } from "@/lib/paths";

export function useCompanySlug(): string {
  const { company } = useParams<{ company: string }>();
  if (!company) {
    // Fallire rumorosamente: senza slug ogni href diventerebbe "/undefined/..."
    throw new Error("useCompanySlug() usato fuori dall'albero /[company]");
  }
  return company;
}

/** Prefissa un path relativo con lo slug corrente: h("/invoices") -> "/acme/invoices" */
export function useCompanyHref() {
  const slug = useCompanySlug();
  return useCallback((path: string) => companyPath(slug, path), [slug]);
}
