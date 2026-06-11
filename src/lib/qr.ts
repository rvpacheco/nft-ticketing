// Formato del QR de entrada, compartido entre el cliente (firma) y
// el endpoint de redeem (verificacion).

/** Vida util de cada QR. El cliente rota antes de que expire. */
export const QR_TTL_MS = 45_000;

/** Margen de gracia del server al validar exp (relojes desfasados). */
export const QR_CLOCK_SKEW_MS = 5_000;

/** Contenido del QR (JSON compacto). */
export type QrPayload = {
  /** ticketId */
  t: string;
  /** expiracion en epoch ms */
  e: number;
  /** nonce aleatorio */
  n: string;
  /** firma ed25519 en base58 del mensaje canonico */
  s: string;
};

/** Mensaje canonico que firma la wallet del comprador. */
export function qrMessage(ticketId: string, exp: number, nonce: string) {
  return `tkt|${ticketId}|${exp}|${nonce}`;
}
