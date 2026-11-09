// Creates the Merkle tree all tickets are minted into (ONE-time setup).
// Usage: npx tsx scripts/create-tree.ts
// At the end it prints MERKLE_TREE_ADDRESS to paste into your .env.
//
// maxDepth 14 = 16,384 possible tickets; maxBufferSize 64 is the standard
// for that depth; canopyDepth 0 minimizes creation cost (~0.3 SOL)
// and at depth 14 the proofs still fit in one transaction.
import "dotenv/config";
import { createTree } from "@metaplex-foundation/mpl-bubblegum";
import { generateSigner, keypairIdentity } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";

const RPC = process.env.SOLANA_RPC_URL;
const SECRET = process.env.SERVER_WALLET_SECRET_KEY;
if (!RPC || !SECRET) {
  throw new Error("Missing SOLANA_RPC_URL or SERVER_WALLET_SECRET_KEY in .env");
}

async function main() {
  const umi = createUmi(RPC!);
  const serverKeypair = umi.eddsa.createKeypairFromSecretKey(
    Uint8Array.from(JSON.parse(SECRET!)),
  );
  umi.use(keypairIdentity(serverKeypair));
  console.log("Payer / tree authority:", serverKeypair.publicKey);

  const merkleTree = generateSigner(umi);
  console.log("Creating Merkle tree:", merkleTree.publicKey);

  const builder = await createTree(umi, {
    merkleTree,
    maxDepth: 14,
    maxBufferSize: 64,
    canopyDepth: 0,
  });
  await builder.sendAndConfirm(umi);

  console.log("\nTree created. Add this line to your .env:");
  console.log(`MERKLE_TREE_ADDRESS="${merkleTree.publicKey}"`);
}

main();
