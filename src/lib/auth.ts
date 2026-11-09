import { PrivyClient } from "@privy-io/server-auth";
import { prisma } from "./prisma";

export const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
);

/** Verifies the Privy Bearer token and returns the claims, or null. */
export async function verifyRequest(req: Request) {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  try {
    return await privy.verifyAuthToken(header.slice("Bearer ".length));
  } catch {
    return null;
  }
}

/** Returns the authenticated Promoter for the request, or null if missing/unauthenticated. */
export async function getAuthedPromoter(req: Request) {
  const claims = await verifyRequest(req);
  if (!claims) return null;
  return prisma.promoter.findUnique({ where: { privyUserId: claims.userId } });
}

/**
 * Context for whoever scans at the door: can be a promoter (their
 * own events) and/or staff registered by one or more promoters.
 * Returns the promoterIds whose events they can redeem, or null if
 * they're authorized as neither.
 */
export async function getScannerContext(req: Request) {
  const claims = await verifyRequest(req);
  if (!claims) return null;

  const user = await privy.getUserById(claims.userId);
  const email = user.email?.address?.toLowerCase();
  if (!email) return null;

  const [promoter, staffRows] = await Promise.all([
    prisma.promoter.findUnique({ where: { privyUserId: claims.userId } }),
    prisma.staff.findMany({ where: { email } }),
  ]);

  const promoterIds = [
    ...(promoter ? [promoter.id] : []),
    ...staffRows.map((s) => s.promoterId),
  ];
  if (promoterIds.length === 0) return null;

  return { scannerId: email, promoterIds };
}

/**
 * Authenticated buyer context: email and embedded Solana wallet.
 * walletAddress can be null if Privy hasn't finished creating the wallet yet.
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
