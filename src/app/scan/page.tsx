"use client";

import { usePrivy } from "@privy-io/react-auth";
import { Html5Qrcode } from "html5-qrcode";
import { useEffect, useRef, useState } from "react";

type RedeemOutcome = {
  granted: boolean;
  result: string;
  message: string;
  ticket?: { buyerEmail: string; tier: string; eventName: string };
  chainCheckSkipped?: boolean;
};

export default function ScanPage() {
  const { ready, authenticated, login, getAccessToken } = usePrivy();
  const [outcome, setOutcome] = useState<RedeemOutcome | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    if (!ready || !authenticated) return;

    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          if (busy.current) return;
          busy.current = true;
          scanner.pause(true);
          try {
            const token = await getAccessToken();
            const res = await fetch("/api/redeem", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ qr: decodedText }),
            });
            setOutcome(await res.json());
          } catch {
            setOutcome({
              granted: false,
              result: "NETWORK",
              message: "Sin conexión — reintenta",
            });
          }
        },
        () => {
          // frames sin QR: ruido normal, no hacer nada
        },
      )
      .then(() => setScanning(true))
      .catch((err) => setCameraError(String(err)));

    return () => {
      scannerRef.current = null;
      scanner.stop().catch(() => {});
    };
    // getAccessToken cambia de identidad por render (hooks de Privy);
    // solo importa re-correr cuando cambia el estado de auth
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authenticated]);

  function nextScan() {
    setOutcome(null);
    busy.current = false;
    scannerRef.current?.resume();
  }

  if (!ready) return <main className="p-8">Cargando…</main>;
  if (!authenticated) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <h1 className="text-2xl font-bold">Scanner de puerta</h1>
        <button
          onClick={login}
          className="rounded-lg bg-black px-6 py-3 font-medium text-white dark:bg-white dark:text-black"
        >
          Iniciar sesión (staff)
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col p-4">
      <h1 className="mb-3 text-center text-xl font-bold">Scanner de puerta</h1>

      {cameraError && (
        <p className="mb-3 rounded bg-red-100 p-3 text-sm text-red-800">
          No se pudo abrir la cámara: {cameraError}. La cámara requiere HTTPS o
          localhost.
        </p>
      )}

      <div
        id="qr-reader"
        className={outcome ? "hidden" : "overflow-hidden rounded-lg"}
      />
      {!outcome && scanning && (
        <p className="mt-3 text-center text-sm text-gray-500">
          Apunta al QR del ticket
        </p>
      )}

      {outcome && (
        <div
          className={`flex flex-1 flex-col items-center justify-center gap-3 rounded-xl p-8 text-center ${
            outcome.granted ? "bg-green-600" : "bg-red-600"
          } text-white`}
        >
          <div className="text-5xl font-black">
            {outcome.granted ? "ENTRA" : "NO ENTRA"}
          </div>
          <div className="text-lg">{outcome.message}</div>
          {outcome.ticket && (
            <div className="text-sm opacity-90">
              {outcome.ticket.eventName} · {outcome.ticket.tier}
              <br />
              {outcome.ticket.buyerEmail}
            </div>
          )}
          {outcome.chainCheckSkipped && (
            <div className="text-xs opacity-75">
              (verificación on-chain omitida por timeout)
            </div>
          )}
          <button
            onClick={nextScan}
            className="mt-4 rounded-lg bg-white px-6 py-3 font-semibold text-black"
          >
            Escanear siguiente
          </button>
        </div>
      )}
    </main>
  );
}
