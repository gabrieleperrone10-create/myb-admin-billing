import { randomBytes } from "node:crypto";

/**
 * Token segreti (Contact.replyToken, Appointment.manageToken): chi li conosce
 * puo' scrivere nel thread di un contatto o annullare/spostare un appuntamento.
 * Il default dello schema e' cuid(), che non e' crittografico: ogni create li
 * passa esplicitamente da qui. Esadecimale minuscolo (48 caratteri, 192 bit):
 * sopravvive ai server di posta che abbassano la parte locale dell'indirizzo e
 * rientra nelle regex di validazione ([a-z0-9], max 64).
 */
export function secureToken(): string {
  return randomBytes(24).toString("hex");
}
