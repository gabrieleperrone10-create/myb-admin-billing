"use client";

import { useTransition, useState, useRef } from "react";
import { Input, Textarea } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { saveCompanySettings } from "@/app/actions/settings";
import type { CompanySettings } from "@prisma/client";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props { settings: CompanySettings }

const sections = [
  { id: "azienda",   label: "Azienda" },
  { id: "fiscale",   label: "Dati Fiscali" },
  { id: "indirizzo", label: "Indirizzo" },
  { id: "banca",     label: "Coordinate Bancarie" },
  { id: "footer",    label: "Nota Fattura" },
];

export default function SettingsForm({ settings }: Props) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [active, setActive] = useState("azienda");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  function scrollTo(id: string) {
    setActive(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const action = (formData: FormData) => {
    startTransition(async () => {
      await saveCompanySettings(formData);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  };

  return (
    <div className="flex gap-8">
      {/* Left nav */}
      <nav className="w-44 shrink-0">
        <div className="sticky top-4 space-y-0.5">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => scrollTo(s.id)}
              className={cn(
                "w-full text-left px-3 py-1.5 rounded-[var(--r-md)] text-[13px] transition-colors",
                active === s.id
                  ? "bg-subtle text-fg font-medium"
                  : "text-fg-2 hover:bg-subtle hover:text-fg"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Form */}
      <form action={action} className="flex-1 space-y-5">

        {/* Azienda */}
        <section
          id="azienda"
          ref={(el) => { sectionRefs.current["azienda"] = el; }}
          className="bg-surface border border-border rounded-[var(--r-lg)] p-5 space-y-4"
        >
          <div>
            <p className="text-[13px] font-medium text-fg">Dati azienda</p>
            <p className="text-[12px] text-fg-3 mt-0.5">Appaiono nella sezione &quot;Emessa da&quot; di ogni fattura.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Nome azienda / Brand" name="name" required placeholder="Market Your Business" defaultValue={settings.name} />
            <Input label="Email aziendale" name="email" type="email" required placeholder="info@example.com" defaultValue={settings.email} />
            <Input label="Telefono" name="phone" type="tel" placeholder="+44 7700 000000" defaultValue={settings.phone ?? ""} />
            <Input label="Sito web" name="website" placeholder="www.marketyourbusiness.com" defaultValue={settings.website ?? ""} />
          </div>
        </section>

        {/* Dati Fiscali */}
        <section
          id="fiscale"
          ref={(el) => { sectionRefs.current["fiscale"] = el; }}
          className="bg-surface border border-border rounded-[var(--r-lg)] p-5 space-y-4"
        >
          <p className="text-[13px] font-medium text-fg">Dati Fiscali</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="UTR (Unique Taxpayer Reference)"
              name="vatNumber"
              placeholder="1234567890"
              defaultValue={settings.vatNumber ?? ""}
              hint="Numero fiscale UK rilasciato da HMRC"
            />
          </div>
        </section>

        {/* Indirizzo */}
        <section
          id="indirizzo"
          ref={(el) => { sectionRefs.current["indirizzo"] = el; }}
          className="bg-surface border border-border rounded-[var(--r-lg)] p-5 space-y-4"
        >
          <p className="text-[13px] font-medium text-fg">Indirizzo sede</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Input label="Via / Indirizzo" name="address" placeholder="123 High Street" defaultValue={settings.address ?? ""} />
            </div>
            <Input label="Città" name="city" placeholder="London" defaultValue={settings.city ?? ""} />
            <Input label="CAP / Postcode" name="zip" placeholder="EC1A 1BB" defaultValue={settings.zip ?? ""} />
            <Input label="Contea / Provincia" name="province" placeholder="Greater London" defaultValue={settings.province ?? ""} />
            <Input label="Paese" name="country" placeholder="Regno Unito" defaultValue={settings.country ?? ""} />
          </div>
        </section>

        {/* Coordinate Bancarie */}
        <section
          id="banca"
          ref={(el) => { sectionRefs.current["banca"] = el; }}
          className="bg-surface border border-border rounded-[var(--r-lg)] p-5 space-y-4"
        >
          <div>
            <p className="text-[13px] font-medium text-fg">Coordinate bancarie</p>
            <p className="text-[12px] text-fg-3 mt-0.5">Mostrate in fondo alla fattura per i pagamenti tramite bonifico.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Nome banca" name="bankName" placeholder="Monzo" defaultValue={settings.bankName ?? ""} />
            <Input label="BIC / SWIFT" name="bic" placeholder="MONZGB2L" defaultValue={settings.bic ?? ""} />
            <div className="md:col-span-2">
              <Input label="IBAN" name="iban" placeholder="GB29 NWBK 6016 1331 9268 19" defaultValue={settings.iban ?? ""} />
            </div>
          </div>
        </section>

        {/* Nota Fattura */}
        <section
          id="footer"
          ref={(el) => { sectionRefs.current["footer"] = el; }}
          className="bg-surface border border-border rounded-[var(--r-lg)] p-5 space-y-4"
        >
          <div>
            <p className="text-[13px] font-medium text-fg">Nota a piè di fattura</p>
            <p className="text-[12px] text-fg-3 mt-0.5">Appare in fondo ad ogni PDF di fattura.</p>
          </div>
          <Textarea
            label="Testo footer"
            name="invoiceFooter"
            placeholder="Es: Operazione effettuata da soggetto in regime forfettario…"
            defaultValue={settings.invoiceFooter ?? ""}
          />
        </section>

        {/* Save */}
        <div className="flex items-center gap-3">
          <Button type="submit" loading={pending}>Salva impostazioni</Button>
          {saved && (
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ok">
              <Check className="w-3.5 h-3.5" strokeWidth={2} />
              Salvato
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
