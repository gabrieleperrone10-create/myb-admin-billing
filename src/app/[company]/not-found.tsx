import Link from "next/link";

export default function CompanyNotFound() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 text-center px-4" style={{ backgroundColor: "var(--bg)" }}>
      <p className="text-[15px] font-semibold" style={{ color: "var(--fg)" }}>Pagina non trovata</p>
      <p className="text-[13px]" style={{ color: "var(--fg-3)" }}>
        L&apos;azienda non esiste o non ne fai parte, oppure questa pagina non esiste.
      </p>
      <Link
        href="/"
        className="mt-2 text-[13px] font-medium underline"
        style={{ color: "var(--info)" }}
      >
        Torna alla home
      </Link>
    </div>
  );
}
