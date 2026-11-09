# Roadmap

Planned work, roughly in priority order. The first section turns the "Known limitations" in the README into concrete tasks.

## 1. Reliability

- [ ] Move minting out of the buyer's claim request into a job queue, with idempotent retries so a crash mid-mint can't leave an orphan cNFT.
- [ ] Gate promoter signup (invite or approval) instead of letting any logged-in user become a promoter.
- [ ] Serve NFT metadata from durable storage (Arweave) so on-chain URIs don't depend on the app's own domain.

## 2. Promoter tools

- [ ] Ticket tiers with their own capacity and price label, instead of a free-text tier.
- [ ] Bulk ticket creation from a CSV of buyer emails.
- [ ] Event stats page: tickets by status, entries over time, rejected scans by reason (from `RedemptionLog`).
- [ ] Cancel an event and revoke all its unused tickets in one step.

## 3. Door experience

- [ ] Scanner feedback with sound and vibration, plus a manual lookup by email for buyers whose phone died.
- [ ] Clear error states for the most common rejections (expired QR, wrong event) aimed at door staff, not developers.

## 4. Mainnet readiness

- [ ] Server keypair in a KMS instead of an environment variable.
- [ ] Merkle tree sizing and cost estimate per event size.
- [ ] Rate-limit handling and retries for paid RPC providers.

## 5. Tests and tooling

- [ ] Turn `scripts/test-double-scan.ts` into a proper test suite that runs in CI against a throwaway database.
- [ ] Unit tests for the QR payload, signature verification and redemption chain in `src/lib`.
- [ ] Fix the remaining React lint errors (setState inside effects, refs read during render).
