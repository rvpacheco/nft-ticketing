import {
  findLeafAssetIdPda,
  getLeafSchemaSerializer,
  mintV1,
} from "@metaplex-foundation/mpl-bubblegum";
import {
  keypairIdentity,
  none,
  publicKey,
  type TransactionSignature,
  type Umi,
} from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import type { Event, Ticket } from "@/generated/prisma/client";

// Umi singleton con el keypair del servidor (paga y firma los mints)
const globalForUmi = globalThis as unknown as { umi?: Umi };

function getUmi(): Umi {
  if (globalForUmi.umi) return globalForUmi.umi;
  const rpc = process.env.SOLANA_RPC_URL;
  const secret = process.env.SERVER_WALLET_SECRET_KEY;
  if (!rpc || !secret) {
    throw new Error("Faltan SOLANA_RPC_URL o SERVER_WALLET_SECRET_KEY en .env");
  }
  const umi = createUmi(rpc);
  umi.use(
    keypairIdentity(
      umi.eddsa.createKeypairFromSecretKey(
        Uint8Array.from(JSON.parse(secret)),
      ),
    ),
  );
  globalForUmi.umi = umi;
  return umi;
}

/**
 * Mintea el cNFT de un ticket a la wallet del comprador.
 * Devuelve el assetId del cNFT (identificador para DAS y la DB).
 */
export async function mintTicketNft(
  ticket: Ticket,
  event: Pick<Event, "name">,
): Promise<string> {
  const treeAddress = process.env.MERKLE_TREE_ADDRESS;
  if (!treeAddress) throw new Error("Falta MERKLE_TREE_ADDRESS en .env");
  if (!ticket.walletAddress) throw new Error("Ticket sin walletAddress");

  const umi = getUmi();
  const merkleTree = publicKey(treeAddress);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const { signature } = await mintV1(umi, {
    leafOwner: publicKey(ticket.walletAddress),
    merkleTree,
    metadata: {
      name: `${event.name} — ${ticket.tier}`.slice(0, 32),
      symbol: "TKT",
      uri: `${appUrl}/api/metadata/${ticket.id}`,
      sellerFeeBasisPoints: 0,
      collection: none(),
      creators: [
        { address: umi.identity.publicKey, verified: false, share: 100 },
      ],
    },
  }).sendAndConfirm(umi);

  const leaf = await parseLeafWithRetry(umi, signature);
  const [assetId] = findLeafAssetIdPda(umi, {
    merkleTree,
    leafIndex: leaf.nonce,
  });

  return assetId.toString();
}

/**
 * Igual que parseLeafFromMintV1Transaction de Bubblegum, pero con
 * commitment explicito y reintentos: en devnet la transaccion no
 * siempre esta disponible via getTransaction apenas se confirma.
 */
async function parseLeafWithRetry(umi: Umi, signature: TransactionSignature) {
  for (let attempt = 0; attempt < 15; attempt++) {
    const tx = await umi.rpc.getTransaction(signature, {
      commitment: "confirmed",
    });
    const inner = tx?.meta.innerInstructions?.[0]?.instructions?.[0];
    if (inner) {
      return getLeafSchemaSerializer().deserialize(inner.data.slice(8))[0];
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("No se pudo leer la transaccion del mint tras confirmarse");
}
