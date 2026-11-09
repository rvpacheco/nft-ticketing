import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold">Ticketera</h1>
      <p className="max-w-md text-center text-gray-500">
        Event tickets as NFTs on Solana. Sell over WhatsApp, validate at
        the door with a single-use QR.
      </p>
      <div className="flex gap-4">
        <Link
          href="/dashboard"
          className="rounded-lg bg-black px-6 py-3 font-medium text-white dark:bg-white dark:text-black"
        >
          I am a promoter
        </Link>
        <Link
          href="/tickets"
          className="rounded-lg border border-gray-400 px-6 py-3 font-medium"
        >
          View my tickets
        </Link>
      </div>
    </main>
  );
}
