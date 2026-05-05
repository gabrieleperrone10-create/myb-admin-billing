"use client";

import { MessageCircle } from "lucide-react";

interface Props {
  whatsapp: string | null;
  clientName: string;
  invoiceNumber: string;
  amount: number;
  dueDate: Date | string;
  iban?: string | null;
  companyName: string;
  replyEmail: string;
}

export default function WhatsAppButton({
  whatsapp,
  clientName,
  invoiceNumber,
  amount,
  dueDate,
  iban,
  companyName,
  replyEmail,
}: Props) {
  if (!whatsapp) return null;

  const phone = whatsapp.replace(/\D/g, "");
  const formattedAmount = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(amount);
  const formattedDue = new Intl.DateTimeFormat("it-IT").format(new Date(dueDate));

  const lines = [
    `Ciao ${clientName} 👋`,
    ``,
    `Ti inviamo la fattura *${invoiceNumber}* di *${formattedAmount}* con scadenza il *${formattedDue}*.`,
    ``,
    iban ? `💳 *Coordinate bancarie per il pagamento:*\nIBAN: ${iban}` : "",
    ``,
    `Per qualsiasi informazione scrivici qui o a ${replyEmail}.`,
    ``,
    `Grazie! 🙏\n${companyName}`,
  ].filter((l, i, arr) => !(l === "" && arr[i - 1] === "")).join("\n");

  const url = `https://wa.me/${phone}?text=${encodeURIComponent(lines)}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50"
    >
      <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
      WhatsApp
    </a>
  );
}
