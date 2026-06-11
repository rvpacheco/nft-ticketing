// Genera el keypair del servidor para devnet y pide un airdrop de 2 SOL.
// Uso: npx tsx scripts/generate-keypair.ts
// Pega la linea SERVER_WALLET_SECRET_KEY que imprime en tu .env (nunca en git).
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
    console.log("\nPidiendo airdrop de 2 SOL en devnet...");
    const sig = await connection.requestAirdrop(
      keypair.publicKey,
      2 * LAMPORTS_PER_SOL,
    );
    await connection.confirmTransaction(sig, "confirmed");
    const balance = await connection.getBalance(keypair.publicKey);
    console.log("Balance:", balance / LAMPORTS_PER_SOL, "SOL");
  } catch (err) {
    console.error(
      "Airdrop fallo (los faucets de devnet se agotan seguido).",
      "Reintenta luego o usa https://faucet.solana.com con la public key de arriba.",
    );
    console.error(String(err));
  }
}

main();
