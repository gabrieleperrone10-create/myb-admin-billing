"use client";

import { useEffect, useRef, useState } from "react";
import type { FormField, FormSettings } from "@/lib/crm/types";
import { HONEYPOT_FIELD } from "@/lib/crm/forms/shared";

type Brand = { name: string; logoUrl: string | null; color: string };

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid"] as const;

function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}
function writeCookie(name: string, value: string) {
  const oneYear = 365 * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${oneYear}; Path=/; SameSite=Lax`;
}
function genId(): string {
  return `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Form pubblico ospitato, interattivo. Renderizzata sia in visita diretta
 * (`/f/<id>`) sia incorporata in un iframe: niente presuppone di essere la
 * pagina di primo livello.
 */
export function PublicForm({
  formId,
  name,
  fields,
  settings,
  brand,
}: {
  formId: string;
  name: string;
  fields: FormField[];
  settings: FormSettings;
  brand: Brand;
}) {
  const [values, setValues] = useState<Record<string, string | string[] | boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const color = settings.theme?.primaryColor || brand.color || "#4f7deb";

  // Auto-resize per l'embed in iframe: segnala l'altezza al genitore a ogni
  // cambiamento di contenuto (errori mostrati, stato inviato, ecc.).
  useEffect(() => {
    if (typeof window === "undefined" || window.self === window.top || !rootRef.current) return;
    const el = rootRef.current;
    const post = () => window.parent.postMessage({ source: "myb-form", height: el.scrollHeight }, "*");
    post();
    const ro = new ResizeObserver(post);
    ro.observe(el);
    return () => ro.disconnect();
  }, [status, errors]);

  function setValue(id: string, v: string | string[] | boolean) {
    setValues(prev => ({ ...prev, [id]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setErrors({});
    setStatus("sending");

    const params = new URLSearchParams(window.location.search);
    let vid = params.get("vid");
    if (!vid) {
      vid = readCookie("myb_vid") ?? genId();
      writeCookie("myb_vid", vid);
    }

    const payload: Record<string, unknown> = { vid, pageUrl: window.location.href, referrer: document.referrer || undefined };
    for (const key of UTM_KEYS) {
      const v = params.get(key);
      if (v) payload[key] = v;
    }
    for (const field of fields) payload[field.id] = values[field.id] ?? "";
    payload[HONEYPOT_FIELD] = values[HONEYPOT_FIELD] ?? "";

    try {
      const res = await fetch(`/api/public/forms/${formId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        const fieldErrors = (json?.errors as Record<string, string>) ?? {};
        setErrors(fieldErrors);
        setFormError(json?.error ?? fieldErrors._form ?? "Invio non riuscito, controlla i campi evidenziati.");
        setStatus("error");
        return;
      }

      if (json.redirectUrl) {
        window.location.href = json.redirectUrl as string;
        return;
      }
      setStatus("done");
    } catch {
      setFormError("Errore di rete, riprova tra poco.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div ref={rootRef} className="min-h-[200px] flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-2">
          <div className="w-10 h-10 rounded-full mx-auto flex items-center justify-center text-white" style={{ backgroundColor: color }}>✓</div>
          <p className="text-[15px] font-medium text-gray-900">{settings.successMessage || "Grazie! Ti risponderemo al più presto."}</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="min-h-screen bg-white flex items-start justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg space-y-5 py-4">
        {(brand.logoUrl || brand.name) && (
          <div className="flex items-center gap-2.5">
            {brand.logoUrl && <img src={brand.logoUrl} alt={brand.name} className="h-8 w-auto" />}
            <span className="text-[14px] font-semibold text-gray-700">{brand.name}</span>
          </div>
        )}

        <h1 className="text-[19px] font-bold text-gray-900">{name}</h1>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Honeypot: fuori schermo, non display:none, nessun utente lo vede o lo raggiunge da tastiera. */}
          <div style={{ position: "absolute", left: "-9999px", top: "-9999px" }} aria-hidden="true">
            <label htmlFor={HONEYPOT_FIELD}>Sito web</label>
            <input
              id={HONEYPOT_FIELD}
              name={HONEYPOT_FIELD}
              tabIndex={-1}
              autoComplete="off"
              value={(values[HONEYPOT_FIELD] as string) ?? ""}
              onChange={e => setValue(HONEYPOT_FIELD, e.target.value)}
            />
          </div>

          {fields.map(field => (
            <FieldInput key={field.id} field={field} value={values[field.id]} error={errors[field.id]} onChange={v => setValue(field.id, v)} />
          ))}

          {formError && <p className="text-[13px] text-red-600" role="alert">{formError}</p>}

          <button
            type="submit"
            disabled={status === "sending"}
            className="w-full py-2.5 rounded-lg text-[14px] font-semibold text-white transition-opacity disabled:opacity-60"
            style={{ backgroundColor: color }}
          >
            {status === "sending" ? "Invio…" : (settings.submitLabel || "Invia")}
          </button>
        </form>
      </div>
    </div>
  );
}

function FieldInput({
  field,
  value,
  error,
  onChange,
}: {
  field: FormField;
  value: string | string[] | boolean | undefined;
  error?: string;
  onChange: (v: string | string[] | boolean) => void;
}) {
  const inputClass = `w-full px-3 py-2.5 border rounded-lg text-[14px] text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-offset-0 ${error ? "border-red-400 focus:ring-red-200" : "border-gray-300 focus:ring-gray-300"}`;

  return (
    <div className="space-y-1">
      <label htmlFor={field.id} className="block text-[13px] font-medium text-gray-700">
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      {field.type === "TEXTAREA" ? (
        <textarea id={field.id} required={field.required} placeholder={field.placeholder} rows={4}
          value={(value as string) ?? ""} onChange={e => onChange(e.target.value)} className={inputClass} />
      ) : field.type === "SELECT" ? (
        <select id={field.id} required={field.required} value={(value as string) ?? ""} onChange={e => onChange(e.target.value)} className={inputClass}>
          <option value="">{field.placeholder || "Seleziona…"}</option>
          {(field.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : field.type === "MULTISELECT" ? (
        <div className="flex flex-wrap gap-2">
          {(field.options ?? []).map(o => {
            const selected = Array.isArray(value) && value.includes(o);
            return (
              <button
                key={o}
                type="button"
                onClick={() => {
                  const arr = Array.isArray(value) ? value : [];
                  onChange(selected ? arr.filter(v => v !== o) : [...arr, o]);
                }}
                className="text-[13px] px-3 py-1.5 rounded-full border transition-colors"
                style={selected ? { backgroundColor: "#eef2ff", borderColor: "#6366f1", color: "#4338ca" } : { borderColor: "#d1d5db", color: "#374151" }}
              >
                {o}
              </button>
            );
          })}
        </div>
      ) : field.type === "CHECKBOX" ? (
        <label className="flex items-center gap-2 text-[13px] text-gray-700">
          <input id={field.id} type="checkbox" checked={Boolean(value)} onChange={e => onChange(e.target.checked)} />
          {field.placeholder || "Sì"}
        </label>
      ) : (
        <input
          id={field.id}
          type={field.type === "EMAIL" ? "email" : field.type === "PHONE" ? "tel" : field.type === "NUMBER" ? "number" : field.type === "DATE" ? "date" : field.type === "URL" ? "url" : "text"}
          required={field.required}
          placeholder={field.placeholder}
          value={(value as string) ?? ""}
          onChange={e => onChange(e.target.value)}
          className={inputClass}
        />
      )}

      {field.helpText && !error && <p className="text-[12px] text-gray-500">{field.helpText}</p>}
      {error && <p className="text-[12px] text-red-600" role="alert">{error}</p>}
    </div>
  );
}
