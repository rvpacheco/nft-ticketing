import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold">Ticketera</h1>
      <p className="max-w-md text-center text-gray-500">
        Tickets de eventos como NFTs en Solana. Vende por WhatsApp, valida en
        puerta con QR de un solo uso.
      </p>
      <div className="flex gap-4">
        <Link
          href="/dashboard"
          className="rounded-lg bg-black px-6 py-3 font-medium text-white dark:bg-white dark:text-black"
        >
          Soy promotor
        </Link>
        <Link
          href="/tickets"
          className="rounded-lg border border-gray-400 px-6 py-3 font-medium"
        >
          Ver mis tickets
        </Link>
      </div>
    </main>
  );
}
