# Ticketera — NFT event ticketing on Solana

A B2B2C ticketing system where event promoters sell tickets over WhatsApp, buyers get an invisible embedded wallet from just their email, tickets are minted as compressed NFTs on Solana, and door entry is validated with a rotating single-use QR code.

Built as a portfolio project to learn the Solana stack end to end. Everything below is honest about what the chain does and does not provide here.

## The flow

1. A promoter creates an event and registers tickets by typing the buyer's email. Payment happens off-chain (cash, transfer, whatever the promoter already does on WhatsApp). No crypto UX is pushed onto anyone.
2. The buyer opens the app and logs in with that email (Privy magic link). An embedded Solana wallet is created for them invisibly. They never see a seed phrase.
3. The server mints the ticket as a compressed NFT (Metaplex Bubblegum) to the buyer's wallet on devnet.
4. At the door, the buyer's screen shows a QR that rotates every 40 seconds. Each QR contains `{ticketId, expiry, nonce}` signed ed25519 by the buyer's wallet. A screenshot dies in 45 seconds; a forged QR fails signature verification.
5. Door staff (registered by the promoter, with per-scanner audit logs) scan it. The server verifies, in order: staff authorization for that event, QR expiry, wallet signature, on-chain ownership via DAS, and finally an atomic `UPDATE ... WHERE status = 'MINTED'` that makes double entry impossible even with concurrent scanners.

## What the chain actually guarantees here (and what it doesn't)

This is intentionally not a decentralization story. The server and the promoter are trusted parties: the server holds the mint authority and the database decides whether a ticket was already used.

What the NFT genuinely adds:

- The ticket is a verifiable, non-duplicable asset in the buyer's own wallet. Anyone can check its existence and ownership against the chain without trusting this app.
- The door check verifies on-chain ownership at scan time, so a ticket whose NFT moved away stops working.
- Ownership is real: the server cannot burn a buyer's cNFT, because Bubblegum requires the leaf owner's signature. This bit us in the reassignment feature (below) and is the clearest proof that custody actually sits with the user.

What it does not add: payments (off-chain by design in v1), censorship resistance (the DB can revoke), or trustlessness (you are trusting the promoter exactly as much as you already do when you pay them on WhatsApp).

## Design decisions worth reading

**Rotating signed QR instead of a static one.** A static QR is a screenshot-forwarding free-for-all. Here the buyer's wallet signs a payload with a 45-second expiry, silently (Privy `showWalletUIs: false` — a confirmation modal per signature would make the door unusable). The private key never leaves Privy's enclave.

**The DB is the arbiter of "already used", not the chain.** The atomic conditional update is what prevents double entry; the DAS ownership check is an extra verification with a 3-second timeout. If the indexer is slow, the line keeps moving and the scan is logged with `chainCheckSkipped: true`. A venue queue should not depend on an RPC's p99.

**Reassignment without burn.** Promoters can reassign unused tickets (typos, off-chain resale). The original plan was burn + re-mint; it turns out the server cannot burn the buyer's cNFT (leaf-owner signature required). So reassignment resets the same ticket row to a new email — the old cNFT remains in the old wallet as a dead souvenir, its QR no longer verifies, and the `ReassignmentLog` keeps the audit trail. Real custody forced a more honest design.

**Offline behavior.** A buyer who loaded their ticket before losing signal keeps working: signing and QR rotation are fully client-side. The scanner, however, requires connectivity — it is the one consulting the single arbiter. We prefer a slow line over two people inside with the same ticket.

## Bugs found the hard way

- `parseLeafFromMintV1Transaction` from mpl-bubblegum fails on devnet because it fetches the transaction immediately after confirmation, before the RPC can serve it. Replaced with a retrying parse with explicit commitment (`src/lib/solana.ts`).
- Privy hooks return new object identities every render. A `useEffect` depending on the wallet object re-signed the QR in an infinite loop. Fixed with refs and stable dependencies (`src/components/ticket-qr.tsx`).
- A failed parse after a successful mint produced an orphan cNFT (minted on chain, never recorded). Known gap: production would persist the signature before confirming, making the mint idempotent.

## Stack

- Next.js 16 (App Router, single deploy), TypeScript, Tailwind
- Postgres (Neon) + Prisma 7
- Privy: email magic-link auth + embedded Solana wallets (buyers, promoters, and door staff all use the same login)
- Metaplex Bubblegum v1 via Umi for compressed NFTs; Helius for RPC + DAS API
- `tweetnacl` for ed25519 verification server-side; `html5-qrcode` for the scanner camera

## Running it

```bash
npm install
cp .env.example .env   # follow the comments: Neon, Privy, Helius
npx prisma migrate dev
npx tsx scripts/generate-keypair.ts   # server wallet; fund it on https://faucet.solana.com
npx tsx scripts/create-tree.ts        # one-time Merkle tree, paste address into .env
npm run dev
```

For testing the full door flow on a phone, `npm run dev:lan` serves HTTPS on your LAN IP (embedded wallets and camera require a secure context). Add that origin to Privy's allowed origins.

The concurrency test (two simultaneous scans of the same QR, exactly one wins, plus expiry/forgery/authorization cases):

```bash
npx tsx scripts/test-double-scan.ts
```

## Known limitations / future work

- Mint is synchronous inside the buyer's claim request and not idempotent across crashes (orphan mint case above). A job queue would fix both.
- Anyone who logs in can become a promoter; harmless because scanning and ticket access are scoped by event ownership, but a real deployment would gate promoter signup.
- NFT metadata is served from the app's own URL, so on localhost the URI in the on-chain metadata is not publicly resolvable. Deploying fixes it; Arweave would decouple it.
- Devnet only. Mainnet would need: KMS for the server keypair, careful Merkle tree sizing (creation cost scales with depth), and rate-limit handling on paid RPC tiers.
- Offline scanner mode (pre-downloaded ticket list, sync later) is a known pattern, deliberately excluded: it reintroduces double-entry risk across doors.
