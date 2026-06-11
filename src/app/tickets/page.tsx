"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useCallback, useEffect, useRef, useState } from "react";

type MyTicket = {
  id: string;
  tier: string;
  status: "PENDING" | "ASSIGNED" | "MINTED" | "USED" | "REVOKED";
  walletAddress: string | null;
  event: { name: string; venue: string; startsAt: string };
};

const STATUS_LABEL: Record<MyTicket["status"], string> = {
  PENDING: "Procesando",
  ASSIGNED: "Confirmado",
  MINTED: "Listo (NFT emitido)",
  USED: "Usado",
  REVOKED: "Anulado",
};

const CLAIM_RETRIES = 5;

export default function MyTicketsPage() {
  const { ready, authenticated, login, logout, user, getAccessToken } = usePrivy();
  const [tickets, setTickets] = useState<MyTicket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const claiming = useRef(false);

  const loadTickets = useCallback(async () => {
    const token = await getAccessToken();
    const res = await fetch("/api/tickets/mine", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setTickets(await res.json());
    else setError("No se pudieron cargar tus tickets");
  }, [getAccessToken]);

  useEffect(() => {
    if (!ready || !authenticated || claiming.current) return;
    claiming.current = true;
    (async () => {
      const token = await getAccessToken();
      // La wallet embebida puede tardar unos segundos en crearse tras el
      // login; el claim devuelve 409 hasta que exista, asi que reintentamos.
      for (let i = 0; i < CLAIM_RETRIES; i++) {
        const res = await fetch("/api/tickets/claim", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status !== 409) break;
        await new Promise((r) => setTimeout(r, 2000));
      }
      await loadTickets();
    })();
  }, [ready, authenticated, getAccessToken, loadTickets]);

  if (!ready) return <main className="p-8">Cargando…</main>;

  if (!authenticated) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <h1 className="text-2xl font-bold">Mis tickets</h1>
        <p className="max-w-sm text-center text-gray-500">
          Inicia sesión con el email con el que compraste tu ticket.
        </p>
        <button
          onClick={login}
          className="rounded-lg bg-black px-6 py-3 font-medium text-white dark:bg-white dark:text-black"
        >
          Ver mis tickets
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-xl flex-1 p-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mis tickets</h1>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>{user?.email?.address}</span>
          <button onClick={logout} className="underline">
            Salir
          </button>
        </div>
      </div>

      {error && <p className="mb-4 text-red-600">{error}</p>}
      {tickets === null && <p className="text-gray-500">Buscando tus tickets…</p>}
      {tickets?.length === 0 && (
        <p className="text-gray-500">
          No hay tickets asociados a este email. Si acabas de comprar, pide al
          promotor que verifique el email que registró.
        </p>
      )}

      <ul className="space-y-4">
        {tickets?.map((t) => (
          <li
            key={t.id}
            className="rounded-xl border border-gray-300 p-5 dark:border-gray-700"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-semibold">{t.event.name}</div>
                <div className="text-sm text-gray-500">
                  {t.event.venue} · {new Date(t.event.startsAt).toLocaleString()}
                </div>
                <div className="mt-1 text-sm text-gray-500">Tier: {t.tier}</div>
              </div>
              <span className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                {STATUS_LABEL[t.status]}
              </span>
            </div>
            {t.walletAddress && (
              <div className="mt-3 truncate text-xs text-gray-400">
                Wallet: {t.walletAddress}
              </div>
            )}
            <div className="mt-3 rounded bg-gray-50 p-3 text-center text-sm text-gray-400 dark:bg-gray-900">
              El QR de entrada se habilitará el día del evento
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
