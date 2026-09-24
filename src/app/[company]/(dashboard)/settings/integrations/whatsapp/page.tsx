import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireCompany } from "@/lib/company";
import { companyPath } from "@/lib/paths";
import { canEdit, canView, getEffectivePermissions } from "@/lib/permissions";
import { isEncryptionConfigured } from "@/lib/crypto";
import { getWhatsAppStatus, GRAPH_VERSION } from "@/lib/crm/messaging/whatsapp";
import WhatsAppSettingsForm from "./WhatsAppSettingsForm";

export const dynamic = "force-dynamic";

async function appOrigin(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  if (env) return env;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function WhatsAppSettingsPage({ params }: { params: Promise<{ company: string }> }) {
  const { company: slug } = await params;
  const ctx = await requireCompany(slug);
  const perms = await getEffectivePermissions(ctx.db, ctx.companyId, ctx.userId);
  if (!canView(perms, "SETTINGS")) notFound();

  const status = await getWhatsAppStatus(ctx.companyId);
  const webhookUrl = `${await appOrigin()}/api/webhooks/whatsapp`;
  const editable = canEdit(perms, "SETTINGS");
  // Token di verifica: globale (uno per l'app), mostrato solo a chi puo' modificare le impostazioni.
  const verifyToken = !editable
    ? "— visibile a chi può modificare le impostazioni —"
    : process.env.WHATSAPP_VERIFY_TOKEN ?? "— WHATSAPP_VERIFY_TOKEN non impostata sul server —";

  return (
    <div className="max-w-[760px] space-y-6">
      <div className="flex items-start gap-3">
        <Link href={companyPath(slug, "/settings")} className="mt-1.5" style={{ color: "var(--fg-3)" }} aria-label="Torna alle impostazioni">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-[24px] font-semibold text-fg" style={{ letterSpacing: "-0.02em" }}>WhatsApp Business</h1>
          <p className="text-[13px] text-fg-3 mt-0.5">
            Collega il numero WhatsApp Cloud API (Meta) per scrivere e ricevere messaggi dalla scheda contatto
          </p>
        </div>
      </div>

      <WhatsAppSettingsForm
        slug={slug}
        status={status}
        canEdit={editable}
        encryptionReady={isEncryptionConfigured()}
      />

      <section
        className="p-5 rounded-[var(--r-lg)] space-y-3 text-[13px]"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--fg-2)" }}
      >
        <h2 className="text-[15px] font-semibold" style={{ color: "var(--fg)" }}>Configurazione su Meta</h2>
        <ol className="list-decimal pl-5 space-y-2">
          <li>
            In <strong>developers.facebook.com</strong> › la tua app › <strong>WhatsApp › Configurazione API</strong> copia
            il <strong>Phone Number ID</strong> e il <strong>WhatsApp Business Account ID</strong>.
          </li>
          <li>
            In <strong>business.facebook.com</strong> › Impostazioni › Utenti di sistema crea un utente di sistema, assegnagli
            l&apos;app e il WABA e genera un <strong>token permanente</strong> con i permessi{" "}
            <code>whatsapp_business_messaging</code> e <code>whatsapp_business_management</code>.
          </li>
          <li>
            In <strong>Impostazioni app › Di base</strong> copia l&apos;<strong>App Secret</strong>: serve a verificare
            che i webhook arrivino davvero da Meta.
          </li>
          <li>
            In <strong>WhatsApp › Configurazione › Webhook</strong> imposta:
            <div className="mt-2 space-y-1.5">
              <CopyRow label="URL di callback" value={webhookUrl} />
              <CopyRow label="Token di verifica" value={verifyToken} />
            </div>
            <p className="mt-2">
              Poi sottoscrivi il campo <code>messages</code> (include anche gli stati di consegna/lettura).
            </p>
          </li>
          <li>Salva qui sopra e premi <strong>Verifica connessione</strong>.</li>
        </ol>
        <p className="text-[12px]" style={{ color: "var(--fg-3)" }}>
          Graph API {GRAPH_VERSION}. I messaggi liberi sono consentiti solo entro 24 ore dall&apos;ultimo messaggio del
          contatto; oltre servono template approvati nel WhatsApp Manager.
        </p>
      </section>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
      <span className="text-[12px] sm:w-[130px] shrink-0" style={{ color: "var(--fg-3)" }}>{label}</span>
      <code
        className="text-[12px] px-2 py-1 rounded-[var(--r-sm)] break-all select-all flex-1"
        style={{ backgroundColor: "var(--subtle)", color: "var(--fg)", border: "1px solid var(--border)" }}
      >
        {value}
      </code>
    </div>
  );
}
