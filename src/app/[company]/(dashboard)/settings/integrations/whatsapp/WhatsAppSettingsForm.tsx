"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, PlugZap, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/FormField";
import {
  removeWhatsAppIntegration,
  saveWhatsAppSettings,
  testWhatsAppConnection,
} from "@/app/actions/whatsappSettings";
import type { WhatsAppStatus } from "@/lib/crm/messaging/whatsapp";

type Feedback = { ok: boolean; text: string } | null;

export default function WhatsAppSettingsForm({
  slug,
  status,
  canEdit,
  encryptionReady,
}: {
  slug: string;
  status: WhatsAppStatus;
  canEdit: boolean;
  encryptionReady: boolean;
}) {
  const router = useRouter();
  const [phoneNumberId, setPhoneNumberId] = useState(status.phoneNumberId ?? "");
  const [wabaId, setWabaId] = useState(status.wabaId ?? "");
  const [displayPhone, setDisplayPhone] = useState(status.displayPhone ?? "");
  // I segreti non tornano mai dal server: i campi partono vuoti, vuoto = "mantieni"
  const [accessToken, setAccessToken] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [active, setActive] = useState(status.configured ? status.active : true);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [pending, startTransition] = useTransition();
  const [action, setAction] = useState<"save" | "test" | "remove" | null>(null);

  const disabled = !canEdit || pending;

  const run = (kind: "save" | "test" | "remove", fn: () => Promise<Feedback>) => {
    setFeedback(null);
    setAction(kind);
    startTransition(async () => {
      try {
        setFeedback(await fn());
      } catch (e) {
        setFeedback({ ok: false, text: e instanceof Error ? e.message : "Operazione non riuscita" });
      }
      router.refresh();
    });
  };

  const save = () =>
    run("save", async () => {
      const res = await saveWhatsAppSettings(slug, { phoneNumberId, wabaId, displayPhone, accessToken, appSecret, active });
      if (!res.ok) return { ok: false, text: res.error };
      setAccessToken("");
      setAppSecret("");
      return { ok: true, text: "Configurazione salvata" };
    });

  const test = () =>
    run("test", async () => {
      const res = await testWhatsAppConnection(slug);
      if (!res.ok) return { ok: false, text: res.error };
      const d = res.data;
      const parts = [
        "Connessione riuscita",
        d?.verifiedName && `nome verificato: ${d.verifiedName}`,
        d?.displayPhone && `numero: ${d.displayPhone}`,
        d?.quality && `qualità: ${d.quality}`,
        d && !d.subscribed && "attenzione: iscrizione dell'app al WABA non riuscita, i messaggi in entrata potrebbero non arrivare",
      ].filter(Boolean);
      return { ok: true, text: parts.join(" · ") };
    });

  const remove = () => {
    if (!confirm("Scollegare WhatsApp? Token e App Secret verranno cancellati.")) return;
    run("remove", async () => {
      const res = await removeWhatsAppIntegration(slug);
      if (!res.ok) return { ok: false, text: res.error };
      setPhoneNumberId(""); setWabaId(""); setDisplayPhone(""); setActive(true);
      return { ok: true, text: "WhatsApp scollegato" };
    });
  };

  return (
    <section
      className="p-5 rounded-[var(--r-lg)] space-y-4"
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-[15px] font-semibold" style={{ color: "var(--fg)" }}>Credenziali</h2>
        <span
          className="text-[11px] font-medium px-2 py-0.5 rounded-full"
          style={
            status.configured && status.active
              ? { backgroundColor: "var(--ok-soft)", color: "var(--ok)" }
              : { backgroundColor: "var(--subtle)", color: "var(--fg-3)" }
          }
        >
          {status.configured ? (status.active ? "Attivo" : "Disattivato") : "Non configurato"}
        </span>
      </div>

      {!canEdit && (
        <p className="text-[12px]" style={{ color: "var(--fg-3)" }}>
          Solo chi ha il permesso di modifica sulle Impostazioni può cambiare questa configurazione.
        </p>
      )}
      {!encryptionReady && (
        <p className="flex items-start gap-1.5 text-[12px]" style={{ color: "var(--danger)" }}>
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          TOKEN_ENCRYPTION_KEY non è configurata sul server: i segreti non possono essere salvati.
        </p>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <Input
          label="Phone Number ID"
          id="wa-phone-number-id"
          inputMode="numeric"
          value={phoneNumberId}
          onChange={e => setPhoneNumberId(e.target.value)}
          disabled={disabled}
          required
        />
        <Input
          label="WhatsApp Business Account ID"
          id="wa-waba-id"
          inputMode="numeric"
          value={wabaId}
          onChange={e => setWabaId(e.target.value)}
          disabled={disabled}
          required
        />
        <Input
          label="Numero visualizzato"
          id="wa-display-phone"
          placeholder="+39 333 123 4567"
          value={displayPhone}
          onChange={e => setDisplayPhone(e.target.value)}
          disabled={disabled}
        />
        <div className="hidden sm:block" />
        <Input
          label="Access Token (permanente)"
          id="wa-access-token"
          type="password"
          autoComplete="off"
          placeholder={status.tokenLast4 ? `Configurato ✓ (…${status.tokenLast4}) — lascia vuoto per non cambiarlo` : "EAAG…"}
          value={accessToken}
          onChange={e => setAccessToken(e.target.value)}
          disabled={disabled}
        />
        <Input
          label="App Secret"
          id="wa-app-secret"
          type="password"
          autoComplete="off"
          placeholder={status.hasAppSecret ? "Configurato ✓ — lascia vuoto per non cambiarlo" : ""}
          value={appSecret}
          onChange={e => setAppSecret(e.target.value)}
          disabled={disabled}
        />
      </div>

      <label className="inline-flex items-center gap-2 text-[13px]" style={{ color: "var(--fg-2)" }}>
        <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} disabled={disabled} />
        Integrazione attiva (invio e ricezione messaggi)
      </label>

      {status.lastCheckAt && (
        <p className="text-[12px]" style={{ color: "var(--fg-3)" }}>
          Ultima verifica: {new Date(status.lastCheckAt).toLocaleString("it-IT", { timeZone: "Europe/Rome" })} —{" "}
          {status.lastCheckOk ? "riuscita" : "non riuscita"}
        </p>
      )}

      {feedback && (
        <p
          className="flex items-start gap-1.5 text-[12px]"
          style={{ color: feedback.ok ? "var(--ok)" : "var(--danger)" }}
          role="status"
        >
          {feedback.ok ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
          {feedback.text}
        </p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <Button onClick={save} disabled={disabled || !encryptionReady} loading={pending && action === "save"}>
          Salva
        </Button>
        <Button
          variant="secondary"
          onClick={test}
          disabled={disabled || !status.configured}
          loading={pending && action === "test"}
          icon={<PlugZap className="w-3.5 h-3.5" />}
        >
          Verifica connessione
        </Button>
        {status.configured && (
          <Button
            variant="danger"
            onClick={remove}
            disabled={disabled}
            loading={pending && action === "remove"}
            icon={<Trash2 className="w-3.5 h-3.5" />}
            className="sm:ml-auto"
          >
            Scollega
          </Button>
        )}
      </div>
    </section>
  );
}
