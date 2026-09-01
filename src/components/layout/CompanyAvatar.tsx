/**
 * Avatar azienda: mostra il logo se presente, altrimenti l'iniziale del nome
 * su uno sfondo colorato. Usato ovunque compaia lo switcher azienda (sidebar
 * desktop, drawer mobile) cosi' logo e fallback restano consistenti.
 */
export function CompanyAvatar({
  name,
  logoUrl,
  size = 22,
  radius = 5,
  variant = "solid",
}: {
  name: string;
  logoUrl?: string | null;
  size?: number;
  radius?: number;
  variant?: "solid" | "subtle";
}) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        className="shrink-0 object-contain"
        style={{ width: size, height: size, borderRadius: radius, backgroundColor: "var(--surface)" }}
      />
    );
  }

  const bg = variant === "solid" ? "var(--fg)" : "var(--subtle)";
  const fg = variant === "solid" ? "var(--surface)" : "var(--fg-2)";

  return (
    <div
      className="shrink-0 flex items-center justify-center"
      style={{ width: size, height: size, borderRadius: radius, backgroundColor: bg }}
    >
      <span
        className="font-bold leading-none select-none"
        style={{ fontSize: Math.round(size * 0.5), color: fg }}
      >
        {name[0]?.toUpperCase() ?? "A"}
      </span>
    </div>
  );
}
