"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { companyPath } from "@/lib/paths";
import { Input, Select, Textarea } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { createContact, lookupContactByIdentity } from "@/app/actions/contacts";
import type { MemberOption, TagOption, CustomFieldDefLite } from "./types";

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  whatsapp: string;
  companyName: string;
  jobTitle: string;
  ownerUserId: string;
  tagIds: string[];
  assigneeUserIds: string[];
  customFields: Record<string, string | boolean | string[]>;
};

const EMPTY: FormState = {
  firstName: "", lastName: "", email: "", phone: "", whatsapp: "",
  companyName: "", jobTitle: "", ownerUserId: "", tagIds: [], assigneeUserIds: [], customFields: {},
};

export default function NewContactForm({
  slug, members, tags, customFieldDefs,
}: {
  slug: string;
  members: MemberOption[];
  tags: TagOption[];
  customFieldDefs: CustomFieldDefLite[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [duplicate, setDuplicate] = useState<{ id: string; name: string } | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function checkDuplicate() {
    if (!form.email.trim() && !form.phone.trim()) { setDuplicate(null); return; }
    const found = await lookupContactByIdentity(slug, { email: form.email, phone: form.phone });
    setDuplicate(found);
  }

  function toggleTag(id: string) {
    set("tagIds", form.tagIds.includes(id) ? form.tagIds.filter(t => t !== id) : [...form.tagIds, id]);
  }

  function toggleAssignee(userId: string) {
    set("assigneeUserIds", form.assigneeUserIds.includes(userId)
      ? form.assigneeUserIds.filter(u => u !== userId)
      : [...form.assigneeUserIds, userId]);
  }

  function setCustom(key: string, value: string | boolean | string[]) {
    setForm(f => ({ ...f, customFields: { ...f.customFields, [key]: value } }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    if (!form.email.trim() && !form.phone.trim() && !form.whatsapp.trim()) {
      setError("Inserisci almeno email o telefono.");
      return;
    }
    startTransition(async () => {
      const res = await createContact(slug, {
        firstName: form.firstName, lastName: form.lastName, email: form.email, phone: form.phone,
        whatsapp: form.whatsapp, companyName: form.companyName, jobTitle: form.jobTitle,
        ownerUserId: form.ownerUserId, tagIds: form.tagIds, assigneeUserIds: form.assigneeUserIds,
        customFields: form.customFields,
      });
      if (!res.ok) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      router.push(companyPath(slug, `/contacts/${res.contactId}`));
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {duplicate && (
        <div className="flex items-start gap-2.5 p-3 rounded-[var(--r-md)]" style={{ backgroundColor: "var(--warn-soft)", border: "1px solid var(--warn)" }}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--warn)" }} />
          <div className="text-[13px]" style={{ color: "var(--fg)" }}>
            Esiste già un contatto con questa email o telefono: <strong>{duplicate.name}</strong>.{" "}
            <Link href={companyPath(slug, `/contacts/${duplicate.id}`)} className="underline font-medium">Apri il contatto esistente</Link>
            {" "}oppure continua: i dati verranno uniti a quello, senza crearne uno duplicato.
          </div>
        </div>
      )}
      {error && (
        <div className="p-3 rounded-[var(--r-md)] text-[13px]" style={{ backgroundColor: "var(--danger-soft)", color: "var(--danger)", border: "1px solid var(--danger)" }}>
          {error}
        </div>
      )}

      <section className="space-y-4">
        <h2 className="text-[13px] font-semibold" style={{ color: "var(--fg)" }}>Dati principali</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Nome" value={form.firstName} onChange={e => set("firstName", e.target.value)} />
          <Input label="Cognome" value={form.lastName} onChange={e => set("lastName", e.target.value)} />
          <Input label="Email" type="email" value={form.email} onChange={e => set("email", e.target.value)} onBlur={checkDuplicate} />
          <Input label="Telefono" value={form.phone} onChange={e => set("phone", e.target.value)} onBlur={checkDuplicate} hint="Se diverso da WhatsApp" />
          <Input label="WhatsApp" value={form.whatsapp} onChange={e => set("whatsapp", e.target.value)} />
          <Input label="Azienda" value={form.companyName} onChange={e => set("companyName", e.target.value)} />
          <Input label="Ruolo" value={form.jobTitle} onChange={e => set("jobTitle", e.target.value)} />
          <Select
            label="Responsabile"
            value={form.ownerUserId}
            onChange={e => set("ownerUserId", e.target.value)}
            options={members.map(m => ({ value: m.userId, label: m.name }))}
            placeholder="Nessuno"
          />
        </div>
      </section>

      {tags.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[13px] font-semibold" style={{ color: "var(--fg)" }}>Etichette</h2>
          <div className="flex flex-wrap gap-1.5">
            {tags.map(t => (
              <button
                key={t.id} type="button" onClick={() => toggleTag(t.id)}
                className="text-[12px] px-2.5 py-1 rounded-full border"
                style={{
                  backgroundColor: form.tagIds.includes(t.id) ? `${t.color}26` : "transparent",
                  borderColor: form.tagIds.includes(t.id) ? t.color : "var(--border)",
                  color: form.tagIds.includes(t.id) ? t.color : "var(--fg-2)",
                }}
              >
                {t.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {members.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[13px] font-semibold" style={{ color: "var(--fg)" }}>Assegnato a</h2>
          <div className="flex flex-wrap gap-1.5">
            {members.map(m => (
              <button
                key={m.userId} type="button" onClick={() => toggleAssignee(m.userId)}
                className="text-[12px] px-2.5 py-1 rounded-full border"
                style={{
                  backgroundColor: form.assigneeUserIds.includes(m.userId) ? "var(--info-soft)" : "transparent",
                  borderColor: form.assigneeUserIds.includes(m.userId) ? "var(--info)" : "var(--border)",
                  color: form.assigneeUserIds.includes(m.userId) ? "var(--info)" : "var(--fg-2)",
                }}
              >
                {m.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {customFieldDefs.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-[13px] font-semibold" style={{ color: "var(--fg)" }}>Campi personalizzati</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {customFieldDefs.map(def => (
              <CustomFieldInput key={def.id} def={def} value={form.customFields[def.key]} onChange={v => setCustom(def.key, v)} error={fieldErrors[def.key]} />
            ))}
          </div>
        </section>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" loading={pending}>Crea contatto</Button>
        <Button type="button" variant="secondary" onClick={() => router.push(companyPath(slug, "/contacts"))}>Annulla</Button>
      </div>
    </form>
  );
}

function CustomFieldInput({
  def, value, onChange, error,
}: {
  def: CustomFieldDefLite;
  value: string | boolean | string[] | undefined;
  onChange: (v: string | boolean | string[]) => void;
  error?: string;
}) {
  switch (def.type) {
    case "TEXTAREA":
      return <Textarea label={def.label} required={def.required} value={(value as string) ?? ""} onChange={e => onChange(e.target.value)} error={error} />;
    case "NUMBER":
      return <Input label={def.label} type="number" required={def.required} value={(value as string) ?? ""} onChange={e => onChange(e.target.value)} error={error} />;
    case "DATE":
      return <Input label={def.label} type="date" required={def.required} value={(value as string) ?? ""} onChange={e => onChange(e.target.value)} error={error} />;
    case "CHECKBOX":
      return (
        <label className="flex items-center gap-2 text-[13px] mt-6" style={{ color: "var(--fg-2)" }}>
          <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} />
          {def.label}
        </label>
      );
    case "SELECT":
      return (
        <Select
          label={def.label}
          required={def.required}
          value={(value as string) ?? ""}
          onChange={e => onChange(e.target.value)}
          options={def.options.map(o => ({ value: o, label: o }))}
          placeholder="Seleziona…"
          error={error}
        />
      );
    case "MULTISELECT": {
      const list = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-1">
          <p className="text-[12px] font-medium" style={{ color: "var(--fg-2)" }}>{def.label}</p>
          <div className="flex flex-wrap gap-1.5">
            {def.options.map(o => (
              <button
                key={o} type="button"
                onClick={() => onChange(list.includes(o) ? list.filter(x => x !== o) : [...list, o])}
                className="text-[12px] px-2.5 py-1 rounded-full border"
                style={{
                  backgroundColor: list.includes(o) ? "var(--info-soft)" : "transparent",
                  borderColor: list.includes(o) ? "var(--info)" : "var(--border)",
                  color: list.includes(o) ? "var(--info)" : "var(--fg-2)",
                }}
              >
                {o}
              </button>
            ))}
          </div>
          {error && <p className="text-[11px] text-danger">{error}</p>}
        </div>
      );
    }
    case "EMAIL":
      return <Input label={def.label} type="email" required={def.required} value={(value as string) ?? ""} onChange={e => onChange(e.target.value)} error={error} />;
    case "URL":
      return <Input label={def.label} type="url" required={def.required} value={(value as string) ?? ""} onChange={e => onChange(e.target.value)} error={error} />;
    case "PHONE":
      return <Input label={def.label} type="tel" required={def.required} value={(value as string) ?? ""} onChange={e => onChange(e.target.value)} error={error} />;
    case "TEXT":
    default:
      return <Input label={def.label} required={def.required} value={(value as string) ?? ""} onChange={e => onChange(e.target.value)} error={error} />;
  }
}
