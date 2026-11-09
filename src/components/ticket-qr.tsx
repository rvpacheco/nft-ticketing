"use client";

import { useSignMessage, useWallets } from "@privy-io/react-auth/solana";
import bs58 from "bs58";
import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { QR_TTL_MS, qrMessage, type QrPayload } from "@/lib/qr";

// Rotate a bit before expiry so the scanned QR is always still valid
const ROTATE_MS = QR_TTL_MS - 5_000;

export function TicketQr({
  ticketId,
  walletAddress,
}: {
  ticketId: string;
  walletAddress: string;
}) {
  const { wallets, ready } = useWallets();
  const { signMessage } = useSignMessage();
  const [qrValue, setQrValue] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number>(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const wallet = wallets.find((w) => w.address === walletAddress);
  const hasWallet = !!wallet;

  // Privy hooks return objects/functions with a new identity on
  // every render: if rotate() depended on them directly, each signature
  // would trigger a re-render -> new dependency -> new signature (loop).
  // Always-fresh refs + stable deps break that cycle.
  const walletRef = useRef(wallet);
  walletRef.current = wallet;
  const signRef = useRef(signMessage);
  signRef.current = signMessage;
  const rotating = useRef(false);

  const rotate = useCallback(async () => {
    const w = walletRef.current;
    if (!w || rotating.current) return;
    rotating.current = true;
    try {
      const exp = Date.now() + QR_TTL_MS;
      const nonce = crypto.randomUUID();
      const { signature } = await signRef.current({
        message: new TextEncoder().encode(qrMessage(ticketId, exp, nonce)),
        wallet: w,
      });
      const payload: QrPayload = {
        t: ticketId,
        e: exp,
        n: nonce,
        s: bs58.encode(signature),
      };
      setQrValue(JSON.stringify(payload));
      setExpiresAt(exp);
      setError(null);
    } catch (err) {
      console.error("QR signing failed:", err);
      setError("Could not sign the QR. Reload the page.");
    } finally {
      rotating.current = false;
    }
  }, [ticketId]);

  // Rotation: first QR once the wallet is ready, then every ROTATE_MS
  useEffect(() => {
    if (!ready || !hasWallet) return;
    rotate();
    const interval = setInterval(rotate, ROTATE_MS);
    return () => clearInterval(interval);
  }, [ready, hasWallet, rotate]);

  // Visual countdown
  useEffect(() => {
    const tick = setInterval(() => {
      setSecondsLeft(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    }, 250);
    return () => clearInterval(tick);
  }, [expiresAt]);

  if (!ready) {
    return <QrShell>Connecting to your wallet…</QrShell>;
  }
  if (!wallet) {
    return (
      <QrShell>
        Your wallet is not available in this session. Log out and log back
        in with your email.
      </QrShell>
    );
  }
  if (error) {
    return <QrShell>{error}</QrShell>;
  }
  if (!qrValue) {
    return <QrShell>Generando QR…</QrShell>;
  }

  return (
    <div className="mt-3 flex flex-col items-center gap-2 rounded bg-white p-4">
      <QRCode value={qrValue} size={196} />
      <div className="text-xs text-gray-500">
        Refreshes in {secondsLeft}s — keep this screen open at the
        door
      </div>
    </div>
  );
}

function QrShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded bg-gray-50 p-3 text-center text-sm text-gray-400 dark:bg-gray-900">
      {children}
    </div>
  );
}
