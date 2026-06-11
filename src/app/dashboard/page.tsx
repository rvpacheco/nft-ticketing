"use client";

import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { StaffPanel } from "@/components/staff-panel";

type EventRow = {
  id: string;
  name: string;
  venue: string;
  startsAt: string;
  capacity: number;
  _count: { tickets: number };
};

export default function DashboardPage() {
  const { ready, authenticated, login, logout, user, getAccessToken } = usePrivy();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadEvents = useCallback(async () => {
    const token = await getAccessToken();
    const res = await fetch("/api/events", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setEvents(await res.json());
    else setError("No se pudieron cargar los eventos");
  }, [getAccessToken]);

  useEffect(() => {
    if (!ready || !authenticated) return;
    (async () => {
      const token = await getAccessToken();
      // upsert del promotor en nuestra DB antes de pedir datos
      await fetch("/api/promoter/sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      await loadEvents();
    })();
  }, [ready, authenticated, getAccessToken, loadEvents]);

  async function createEvent(formData: FormData) {
    setSaving(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/events", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.get("name"),
          venue: formData.get("venue"),
          startsAt: formData.get("startsAt"),
          capacity: Number(formData.get("capacity")),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Error creando el evento");
        return;
      }
      await loadEvents();
    } finally {
      setSaving(false);
    }
  }

  if (!ready) return <main className="p-8">Cargando…</main>;

  if (!authenticated) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <h1 className="text-2xl font-bold">Dashboard del promotor</h1>
        <button
          onClick={login}
          className="rounded-lg bg-black px-6 py-3 font-medium text-white dark:bg-white dark:text-black"
        >
          Iniciar sesión con email
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mis eventos</h1>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>{user?.email?.address}</span>
          <button onClick={logout} className="underline">
            Salir
          </button>
        </div>
      </div>

      <form
        action={createEvent}
        className="mb-8 grid grid-cols-2 gap-3 rounded-lg border border-gray-300 p-4 dark:border-gray-700"
      >
        <h2 className="col-span-2 font-semibold">Crear evento</h2>
        <input name="name" placeholder="Nombre" required className="rounded border px-3 py-2 dark:bg-transparent" />
        <input name="venue" placeholder="Venue" required className="rounded border px-3 py-2 dark:bg-transparent" />
        <input name="startsAt" type="datetime-local" required className="rounded border px-3 py-2 dark:bg-transparent" />
        <input name="capacity" type="number" min={1} placeholder="Capacidad" required className="rounded border px-3 py-2 dark:bg-transparent" />
        <button
          type="submit"
          disabled={saving}
          className="col-span-2 rounded bg-black py-2 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {saving ? "Creando…" : "Crear"}
        </button>
      </form>

      {error && <p className="mb-4 text-red-600">{error}</p>}

      <ul className="space-y-3">
        {events.map((ev) => (
          <li key={ev.id}>
            <Link
              href={`/dashboard/events/${ev.id}`}
              className="block rounded-lg border border-gray-300 p-4 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{ev.name}</span>
                <span className="text-sm text-gray-500">
                  {ev._count.tickets}/{ev.capacity} tickets
                </span>
              </div>
              <div className="text-sm text-gray-500">
                {ev.venue} · {new Date(ev.startsAt).toLocaleString()}
              </div>
            </Link>
          </li>
        ))}
        {events.length === 0 && (
          <li className="text-gray-500">Todavía no tienes eventos.</li>
        )}
      </ul>

      <StaffPanel />
    </main>
  );
}
