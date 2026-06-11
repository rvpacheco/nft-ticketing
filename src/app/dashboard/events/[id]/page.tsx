"use client";

import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";

type Ticket = {
  id: string;
  buyerEmail: string;
  tier: string;
  status: "PENDING" | "ASSIGNED" | "MINTED" | "USED" | "REVOKED";
  walletAddress: string | null;
  createdAt: string;
};

type EventDetail = {
  id: string;
  name: string;
  venue: string;
  startsAt: string;
  capacity: number;
  tickets: Ticket[];
};

const STATUS_STYLES: Record<Ticket["status"], string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  ASSIGNED: "bg-blue-100 text-blue-800",
  MINTED: "bg-green-100 text-green-800",
  USED: "bg-gray-200 text-gray-600",
  REVOKED: "bg-red-100 text-red-800",
};

export default function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { ready, authenticated, login, getAccessToken } = usePrivy();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const token = await getAccessToken();
    const res = await fetch(`/api/events/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setEvent(await res.json());
    else setError("Evento no encontrado");
  }, [getAccessToken, id]);

  useEffect(() => {
    if (ready && authenticated) load();
  }, [ready, authenticated, load]);

  async function addTicket(formData: FormData) {
    setSaving(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/events/${id}/tickets`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          buyerEmail: formData.get("buyerEmail"),
          tier: formData.get("tier") || "general",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Error creando el ticket");
        return;
      }
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (!ready) return <main className="p-8">Cargando…</main>;
  if (!authenticated) {
    return (
      <main className="flex flex-1 items-center justify-center p-8">
        <button onClick={login} className="rounded-lg bg-black px-6 py-3 text-white dark:bg-white dark:text-black">
          Iniciar sesión
        </button>
      </main>
    );
  }
  if (!event) return <main className="p-8">{error ?? "Cargando evento…"}</main>;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-8">
      <Link href="/dashboard" className="text-sm text-gray-500 underline">
        ← Mis eventos
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{event.name}</h1>
      <p className="mb-6 text-gray-500">
        {event.venue} · {new Date(event.startsAt).toLocaleString()} ·{" "}
        {event.tickets.filter((t) => t.status !== "REVOKED").length}/
        {event.capacity} tickets
      </p>

      <form
        action={addTicket}
        className="mb-8 flex gap-3 rounded-lg border border-gray-300 p-4 dark:border-gray-700"
      >
        <input
          name="buyerEmail"
          type="email"
          placeholder="email del comprador"
          required
          className="flex-1 rounded border px-3 py-2 dark:bg-transparent"
        />
        <input
          name="tier"
          placeholder="tier (general)"
          className="w-36 rounded border px-3 py-2 dark:bg-transparent"
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-black px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {saving ? "…" : "Crear ticket"}
        </button>
      </form>

      {error && <p className="mb-4 text-red-600">{error}</p>}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-gray-500">
            <th className="py-2">Email</th>
            <th>Tier</th>
            <th>Estado</th>
            <th>Creado</th>
          </tr>
        </thead>
        <tbody>
          {event.tickets.map((t) => (
            <tr key={t.id} className="border-b border-gray-200 dark:border-gray-800">
              <td className="py-2">{t.buyerEmail}</td>
              <td>{t.tier}</td>
              <td>
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[t.status]}`}>
                  {t.status}
                </span>
              </td>
              <td className="text-gray-500">
                {new Date(t.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
          {event.tickets.length === 0 && (
            <tr>
              <td colSpan={4} className="py-4 text-gray-500">
                Sin tickets todavía. Crea el primero con el email del comprador.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
