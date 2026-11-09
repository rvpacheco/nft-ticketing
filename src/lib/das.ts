// DAS (Helius) lookup of a cNFT's current owner.

/**
 * Returns the asset owner, or null if the indexer didn't respond in
 * time (the caller decides whether to tolerate the skip; the source of truth for
 * "not used" is the DB).
 */
export async function getAssetOwner(
  assetId: string,
  timeoutMs = 3_000,
): Promise<string | null> {
  const rpc = process.env.SOLANA_RPC_URL;
  if (!rpc) return null;
  try {
    const res = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "redeem",
        method: "getAsset",
        params: { id: assetId },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.result?.ownership?.owner ?? null;
  } catch {
    return null;
  }
}
