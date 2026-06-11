import { PrivyClient } from "@privy-io/server-auth";
import { prisma } from "./prisma";

export const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
);

/** Verifica el Bearer token de Privy y devuelve los claims, o null. */
export async function verifyRequest(req: Request) {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  try {
    return await privy.verifyAuthToken(header.slice("Bearer ".length));
  } catch {
    return null;
  }
}

/** Devuelve el Promoter autenticado de la request, o null si no existe/no auth. */
export async function getAuthedPromoter(req: Request) {
  const claims = await verifyRequest(req);
  if (!claims) return null;
  return prisma.promoter.findUnique({ where: { privyUserId: claims.userId } });
}

/**
 * Contexto del comprador autenticado: email y wallet Solana embebida.
 * walletAddress puede ser null si Privy aun no termino de crear la wallet.
 */
export async function getBuyerContext(req: Request) {
  const claims = await verifyRequest(req);
  if (!claims) return null;

  const user = await privy.getUserById(claims.userId);
  const email = user.email?.address?.toLowerCase();
  if (!email) return null;

  const solanaWallet = user.linkedAccounts.find(
    (acc) =>
      acc.type === "wallet" &&
      acc.chainType === "solana" &&
      acc.walletClientType === "privy",
  );
  const walletAddress =
    solanaWallet && "address" in solanaWallet ? solanaWallet.address : null;

  return { userId: claims.userId, email, walletAddress };
}
