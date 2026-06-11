// Consulta DAS (Helius) del owner actual de un cNFT.

/**
 * Devuelve el owner del asset, o null si el indexer no respondio a
 * tiempo (el caller decide si tolera el skip; la fuente de verdad del
 * "no usado" es la DB).
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
