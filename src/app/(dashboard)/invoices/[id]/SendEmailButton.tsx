"use client";

import { useState, useTransition } from "react";
import { sendInvoiceEmail } from "@/app/actions/email";
import { Mail, CheckCircle, AlertCircle } from "lucide-react";

interface Props { invoiceId: string; clientEmail: string | null }

export default function SendEmailButton({ invoiceId, clientEmail }: Props) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);

  const handleSend = () => {
    setResult(null);
    startTransition(async () => {
      const res = await sendInvoiceEmail(invoiceId);
      setResult(res);
      if (res.ok) setTimeout(() => setResult(null), 4000);
    });
  };

  if (!clientEmail) return null;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleSend}
        disabled={pending}
        className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? (
          <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <Mail className="w-3.5 h-3.5" />
        )}
        Invia email
      </button>

      {result?.ok && (
        <span className="flex items-center gap-1 text-sm text-green-600">
          <CheckCircle className="w-4 h-4" /> Inviata!
        </span>
      )}
      {result && !result.ok && (
        <span className="flex items-center gap-1 text-sm text-red-600">
          <AlertCircle className="w-4 h-4" /> {result.error}
        </span>
      )}
    </div>
  );
}
