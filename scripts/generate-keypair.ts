// Generates the server keypair for devnet and requests a 2 SOL airdrop.
// Usage: npx tsx scripts/generate-keypair.ts
// Paste the SERVER_WALLET_SECRET_KEY line it prints into your .env (never into git).
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";

const RPC = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

async function main() {
  const keypair = Keypair.generate();
  console.log("Public key :", keypair.publicKey.toBase58());
  console.log(
    `SERVER_WALLET_SECRET_KEY="[${keypair.secretKey.toString()}]"`,
  );

  const connection = new Connection(RPC, "confirmed");
  try {
    console.log("\nRequesting a 2 SOL airdrop on devnet...");
    const sig = await connection.requestAirdrop(
      keypair.publicKey,
      2 * LAMPORTS_PER_SOL,
    );
    await connection.confirmTransaction(sig, "confirmed");
    const balance = await connection.getBalance(keypair.publicKey);
    console.log("Balance:", balance / LAMPORTS_PER_SOL, "SOL");
  } catch (err) {
    console.error(
      "Airdrop failed (devnet faucets run dry often).",
      "Retry later or use https://faucet.solana.com with the public key above.",
    );
    console.error(String(err));
  }
}

main();
