import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireCompanyFromRequest } from "@/lib/company";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function tiptapToText(content: unknown): string {
  if (!content || typeof content !== "object") return "";
  const node = content as { type?: string; text?: string; content?: unknown[]; attrs?: Record<string, unknown> };
  if (node.type === "text") return node.text ?? "";
  if (node.attrs?.src) return `[Video: ${node.attrs.src}]`;
  return (node.content ?? []).map(tiptapToText).join(node.type === "paragraph" ? "\n" : " ");
}

export async function POST(req: NextRequest) {
  const auth = await requireCompanyFromRequest(req);
  if ("response" in auth) return auth.response;
  const { db, company } = auth.ctx;

  const { question, sopId } = await req.json();
  if (!question) return NextResponse.json({ error: "No question" }, { status: 400 });

  const sops = await db.sop.findMany({
    where: { published: true },
    include: { folder: true, tags: { include: { tag: true } }, attachments: true },
    orderBy: { title: "asc" },
  });

  const context = sops.map(sop => {
    const text = tiptapToText(sop.content);
    const tags = sop.tags.map(t => t.tag.name).join(", ");
    const folder = sop.folder?.name ?? "Senza cartella";
    const attachments = sop.attachments.map(a => `${a.name}: ${a.url}`).join(", ");
    return [
      `## SOP: ${sop.title}`,
      `ID: ${sop.id}`,
      `Cartella: ${folder}`,
      tags ? `Tag: ${tags}` : "",
      `Ruoli: ${sop.roles.join(", ") || "tutti"}`,
      attachments ? `Allegati: ${attachments}` : "",
      `Contenuto:\n${text}`,
    ].filter(Boolean).join("\n");
  }).join("\n\n---\n\n");

  const system = `Sei l'assistente AI per le SOP (Standard Operating Procedures) di ${company.name}.
Hai accesso a tutte le procedure operative del team. Rispondi sempre in italiano.

Quando rispondi:
- Cita esplicitamente il titolo della SOP rilevante
- Includi il link diretto: /sop/[ID_DELLA_SOP]
- Se la SOP ha video o allegati, menzionali
- Dai risposte precise, pratiche e concise
- Se non trovi la risposta nelle SOP, dillo chiaramente

SOP DISPONIBILI:
${context}`;

  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system,
    messages: [{ role: "user", content: question }],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Transfer-Encoding": "chunked" },
  });
}
