/**
 * Test della verifica firma dei webhook (Svix/Resend e Meta/WhatsApp) e del
 * parsing del Reply-To. Nessun DB, nessuna env:
 *
 *   npx tsx scripts/test-webhook-signatures.mts
 */
import assert from "node:assert/strict";
import {
  extractEmailAddress,
  parseReplyToken,
  signMeta,
  signSvix,
  stripQuotedReply,
  verifyMetaSignature,
  verifySvixSignature,
} from "../src/lib/crm/messaging/signatures.js";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

console.log("Svix (Resend)");
const secret = "whsec_" + Buffer.from("una-chiave-segreta-di-test-32byte!").toString("base64");
const body = JSON.stringify({ type: "email.delivered", data: { email_id: "abc" } });
const id = "msg_2abc";
const now = 1_760_000_000;
const ts = String(now);
const sig = signSvix(body, id, ts, secret);

test("firma valida", () => assert.equal(verifySvixSignature({ payload: body, id, timestamp: ts, signature: sig, secret, nowSec: now }), true));
test("firma valida fra piu' firme (rotazione)", () =>
  assert.equal(verifySvixSignature({ payload: body, id, timestamp: ts, signature: `v1,AAAA ${sig}`, secret, nowSec: now }), true));
test("body alterato", () =>
  assert.equal(verifySvixSignature({ payload: body + " ", id, timestamp: ts, signature: sig, secret, nowSec: now }), false));
test("svix-id alterato", () =>
  assert.equal(verifySvixSignature({ payload: body, id: "msg_other", timestamp: ts, signature: sig, secret, nowSec: now }), false));
test("secret sbagliato", () =>
  assert.equal(verifySvixSignature({ payload: body, id, timestamp: ts, signature: sig, secret: "whsec_" + Buffer.from("altro").toString("base64"), nowSec: now }), false));
test("timestamp oltre 5 minuti (replay)", () =>
  assert.equal(verifySvixSignature({ payload: body, id, timestamp: ts, signature: sig, secret, nowSec: now + 301 }), false));
test("timestamp nel futuro oltre 5 minuti", () =>
  assert.equal(verifySvixSignature({ payload: body, id, timestamp: ts, signature: sig, secret, nowSec: now - 301 }), false));
test("entro tolleranza", () =>
  assert.equal(verifySvixSignature({ payload: body, id, timestamp: ts, signature: sig, secret, nowSec: now + 299 }), true));
test("header mancanti", () => {
  assert.equal(verifySvixSignature({ payload: body, id: null, timestamp: ts, signature: sig, secret, nowSec: now }), false);
  assert.equal(verifySvixSignature({ payload: body, id, timestamp: null, signature: sig, secret, nowSec: now }), false);
  assert.equal(verifySvixSignature({ payload: body, id, timestamp: ts, signature: null, secret, nowSec: now }), false);
});
test("versione diversa da v1 ignorata", () =>
  assert.equal(verifySvixSignature({ payload: body, id, timestamp: ts, signature: sig.replace("v1,", "v2,"), secret, nowSec: now }), false));
test("secret vuoto", () =>
  assert.equal(verifySvixSignature({ payload: body, id, timestamp: ts, signature: sig, secret: "", nowSec: now }), false));

console.log("Meta (WhatsApp)");
const appSecret = "0123456789abcdef0123456789abcdef";
const raw = '{"object":"whatsapp_business_account","entry":[{"changes":[{"value":{"metadata":{"phone_number_id":"123"}}}]}]}';
const header = signMeta(raw, appSecret);

test("firma valida", () => assert.equal(verifyMetaSignature(raw, header, appSecret), true));
test("firma maiuscola (hex case-insensitive)", () =>
  assert.equal(verifyMetaSignature(raw, "sha256=" + header.slice(7).toUpperCase(), appSecret), true));
test("body ri-serializzato non valido", () =>
  assert.equal(verifyMetaSignature(JSON.stringify(JSON.parse(raw), null, 1), header, appSecret), false));
test("app secret sbagliato", () => assert.equal(verifyMetaSignature(raw, header, "altro-secret"), false));
test("header mancante o malformato", () => {
  assert.equal(verifyMetaSignature(raw, null, appSecret), false);
  assert.equal(verifyMetaSignature(raw, header.slice(7), appSecret), false);
  assert.equal(verifyMetaSignature(raw, "sha256=zz", appSecret), false);
  assert.equal(verifyMetaSignature(raw, "sha1=" + header.slice(7), appSecret), false);
});
test("app secret vuoto", () => assert.equal(verifyMetaSignature(raw, header, ""), false));

console.log("Indirizzi");
test("estrazione indirizzo", () => {
  assert.equal(extractEmailAddress("Mario Rossi <Mario@Example.IT>"), "mario@example.it");
  assert.equal(extractEmailAddress("mario@example.it"), "mario@example.it");
  assert.equal(extractEmailAddress("non un indirizzo"), null);
});
test("replyToken dal destinatario", () => {
  assert.equal(parseReplyToken("c-cm1abcdef0123456789@in.example.com", "in.example.com"), "cm1abcdef0123456789");
  assert.equal(parseReplyToken("Supporto <c-cm1abcdef0123456789@IN.example.com>", "in.example.com"), "cm1abcdef0123456789");
  assert.equal(parseReplyToken("c-cm1abcdef0123456789@altro.com", "in.example.com"), null);
  assert.equal(parseReplyToken("info@in.example.com", "in.example.com"), null);
  assert.equal(parseReplyToken("c-../../x@in.example.com", "in.example.com"), null);
});
test("taglio della citazione", () => {
  assert.equal(stripQuotedReply("Va bene, grazie!\n\nIl giorno lun 1 set 2026 alle 10:00 Acme ha scritto:\n> ciao"), "Va bene, grazie!");
  assert.equal(stripQuotedReply("Ok\nOn Mon, Sep 1, 2026 at 10:00 AM Acme wrote:\n> hi"), "Ok");
  assert.equal(stripQuotedReply("> solo citazione"), "> solo citazione");
});

console.log(`\n${passed} test superati`);
