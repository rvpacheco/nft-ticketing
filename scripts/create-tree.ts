// Crea el Merkle tree donde se mintean todos los tickets (setup de UNA vez).
// Uso: npx tsx scripts/create-tree.ts
// Al final imprime MERKLE_TREE_ADDRESS para pegar en tu .env.
//
// maxDepth 14 = 16,384 tickets posibles; maxBufferSize 64 es el estandar
// para ese depth; canopyDepth 0 minimiza el costo de creacion (~0.3 SOL)
// y con depth 14 las proofs igual caben en una transaccion.
import "dotenv/config";
import { createTree } from "@metaplex-foundation/mpl-bubblegum";
import { generateSigner, keypairIdentity } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";

const RPC = process.env.SOLANA_RPC_URL;
const SECRET = process.env.SERVER_WALLET_SECRET_KEY;
if (!RPC || !SECRET) {
  throw new Error("Faltan SOLANA_RPC_URL o SERVER_WALLET_SECRET_KEY en .env");
}

async function main() {
  const umi = createUmi(RPC!);
  const serverKeypair = umi.eddsa.createKeypairFromSecretKey(
    Uint8Array.from(JSON.parse(SECRET!)),
  );
  umi.use(keypairIdentity(serverKeypair));
  console.log("Pagador / tree authority:", serverKeypair.publicKey);

  const merkleTree = generateSigner(umi);
  console.log("Creando Merkle tree:", merkleTree.publicKey);

  const builder = await createTree(umi, {
    merkleTree,
    maxDepth: 14,
    maxBufferSize: 64,
    canopyDepth: 0,
  });
  await builder.sendAndConfirm(umi);

  console.log("\nArbol creado. Agrega esta linea a tu .env:");
  console.log(`MERKLE_TREE_ADDRESS="${merkleTree.publicKey}"`);
}

main();
