import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div
        className="hidden lg:flex lg:w-[45%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(145deg, #080810 0%, #111128 60%, #0d0d20 100%)" }}
      >
        {/* Subtle glow */}
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(201,169,110,0.06) 0%, transparent 70%)" }}
        />

        {/* Logo */}
        <div className="flex items-center gap-3 relative">
          <div
            className="w-8 h-8 rounded-[8px] flex items-center justify-center"
            style={{ backgroundColor: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <span className="text-white font-bold text-sm select-none">M</span>
          </div>
          <span className="text-white/70 font-medium text-[14px] tracking-tight">Market Your Business</span>
        </div>

        {/* Main message */}
        <div className="relative">
          <p
            className="text-[11px] font-mono uppercase tracking-[0.25em] mb-8"
            style={{ color: "rgba(201,169,110,0.6)" }}
          >
            Il tuo gestionale
          </p>
          <h1
            className="text-[44px] font-bold leading-[1.08] mb-8 text-white"
            style={{ letterSpacing: "-0.035em" }}
          >
            Non è un software.
            <br />
            È il tuo
            <br />
            <span
              style={{
                background: "linear-gradient(90deg, #c9a96e 0%, #f0d898 50%, #c9a96e 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              vantaggio competitivo.
            </span>
          </h1>
          <p className="text-[15px] leading-relaxed max-w-[300px]" style={{ color: "rgba(255,255,255,0.45)" }}>
            Chi entra qui ha già scelto l&apos;eccellenza. Ogni cliente, ogni euro, ogni decisione — tutto sotto controllo.
          </p>
        </div>

        {/* Quote */}
        <div style={{ borderLeft: "2px solid rgba(201,169,110,0.25)", paddingLeft: "18px" }}>
          <p className="text-[13px] italic leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>
            &ldquo;Il successo non è un caso. È la somma di scelte precise,
            <br />
            fatte ogni giorno, con disciplina.&rdquo;
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div
        className="flex-1 flex flex-col items-center justify-center p-8"
        style={{ backgroundColor: "var(--bg)" }}
      >
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-10">
          <div
            className="w-7 h-7 rounded-[6px] flex items-center justify-center"
            style={{ backgroundColor: "var(--fg)" }}
          >
            <span className="text-[11px] font-bold select-none" style={{ color: "var(--surface)" }}>M</span>
          </div>
          <span className="font-semibold text-[15px]" style={{ color: "var(--fg)" }}>Market Your Business</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2
              className="text-[26px] font-bold mb-2"
              style={{ color: "var(--fg)", letterSpacing: "-0.025em" }}
            >
              Bentornato
            </h2>
            <p className="text-[14px]" style={{ color: "var(--fg-3)" }}>
              Accedi al tuo pannello di controllo
            </p>
          </div>
          <SignIn />
        </div>
      </div>
    </div>
  );
}
