// Entry QR format, shared between the client (signing) and
// the redeem endpoint (verification).

/** Lifetime of each QR. The client rotates before it expires. */
export const QR_TTL_MS = 45_000;

/** Server grace period when validating exp (clock skew). */
export const QR_CLOCK_SKEW_MS = 5_000;

/** QR content (compact JSON). */
export type QrPayload = {
  /** ticketId */
  t: string;
  /** expiry in epoch ms */
  e: number;
  /** random nonce */
  n: string;
  /** base58 ed25519 signature of the canonical message */
  s: string;
};

/** Canonical message signed by the buyer's wallet. */
export function qrMessage(ticketId: string, exp: number, nonce: string) {
  return `tkt|${ticketId}|${exp}|${nonce}`;
}
