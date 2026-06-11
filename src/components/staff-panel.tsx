"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useCallback, useEffect, useState } from "react";

type StaffRow = {
  id: string;
  email: string;
  name: string | null;
};

export function StaffPanel() {
  const { getAccessToken } = usePrivy();
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const token = await getAccessToken();
    const res = await fetch("/api/staff", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setStaff(await res.json());
  }, [getAccessToken]);

  useEffect(() => {
    load();
  }, [load]);

  async function addStaff(formData: FormData) {
    setSaving(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.get("email"),
          name: formData.get("name"),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Error agregando staff");
        return;
      }
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function removeStaff(id: string) {
    const token = await getAccessToken();
    await fetch(`/api/staff/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    await load();
  }

  return (
    <section className="mt-10 rounded-lg border border-gray-300 p-4 dark:border-gray-700">
      <h2 className="font-semibold">Staff de puerta</h2>
      <p className="mb-3 text-sm text-gray-500">
        Estos emails pueden entrar a /scan y canjear tickets de tus eventos.
      </p>

      <form action={addStaff} className="mb-4 flex gap-3">
        <input
          name="email"
          type="email"
          placeholder="email del portero"
          required
          className="flex-1 rounded border px-3 py-2 dark:bg-transparent"
        />
        <input
          name="name"
          placeholder="nombre (opcional)"
          className="w-40 rounded border px-3 py-2 dark:bg-transparent"
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-black px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {saving ? "…" : "Agregar"}
        </button>
      </form>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <ul className="space-y-2">
        {staff.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 text-sm dark:border-gray-800"
          >
            <span>
              {s.email}
              {s.name && <span className="text-gray-500"> · {s.name}</span>}
            </span>
            <button
              onClick={() => removeStaff(s.id)}
              className="text-xs text-red-600 underline"
            >
              Quitar
            </button>
          </li>
        ))}
        {staff.length === 0 && (
          <li className="text-sm text-gray-500">
            Sin staff registrado. Tú siempre puedes escanear tus propios
            eventos.
          </li>
        )}
      </ul>
    </section>
  );
}
