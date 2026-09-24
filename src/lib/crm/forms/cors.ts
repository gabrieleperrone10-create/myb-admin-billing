import "server-only";
import { NextResponse } from "next/server";

/**
 * Header CORS per gli endpoint pubblici del CRM (form, tracciamento):
 * raggiungibili da qualunque sito che ospiti il form/embed dell'azienda,
 * quindi origin "*". Niente credenziali (cookie di sessione): l'identita' di
 * chi chiama qui non esiste, l'azienda si riconosce dal formId o dalla
 * trackingKey nel corpo della richiesta.
 */
export const PUBLIC_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

export function corsJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: PUBLIC_CORS_HEADERS });
}

export function corsPreflight(): NextResponse {
  return new NextResponse(null, { status: 204, headers: PUBLIC_CORS_HEADERS });
}
