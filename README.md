# ZK Compliance Gateway

Autonomous cross-border compliance and settlement for Stellar corridors.

The goal is not a nicer remittance UI. The goal is a payment agent that can prove
KYC membership, sanctions non-membership, and corridor amount eligibility to a
Soroban gateway contract without exposing the sender or receiver identifiers to
every routing hop.

## Product Thesis

Cross-border payment routes are slow because each bank, anchor, or intermediary
repeats trust checks. This project turns those checks into reusable proof
statements:

- sender is in a licensed KYC issuer's current allowlist;
- sender and receiver are not in the current sanctions root;
- payment amount and rolling window total fit the corridor's tier limit;
- a nullifier prevents replay for the same credential and window;
- settlement is authorized only when the proof tier satisfies the receiving
  corridor's policy.

## What Exists

- Next.js 16 app scaffolded with `create-next-app`.
- shadcn UI initialized through the shadcn CLI.
- TanStack Query for proof/authorization mutations.
- Zustand for local payment-intent state.
- Stellar SDK for Stellar account validation.
- Freighter helpers for wallet connection and transaction signing.
- Live Freighter submission UI for `authorize_payment` on Testnet.
- Stellar CLI Soroban workspace under `contracts/`.
- ZoKrates Groth16/BN128 compliance proof pipeline:
  - circuit source;
  - generated proving and verification artifacts;
  - proof generation in the browser/app runtime;
  - Poseidon roots, commitments, and replay nullifiers;
  - local verifier checks before contract authorization.
- Soroban BN254 pairing verifier generated from the ZoKrates verification key.
- `compliance_gateway` Soroban contract with:
  - admin initialization;
  - issuer allowlist and quorum root governance;
  - KYC and sanctions root rotation;
  - corridor policy and proof-tier gating;
  - nullifier replay protection;
  - on-chain Groth16 public-input binding and pairing verification;
  - payment-intent authorization records;
  - atomic Stellar Asset Contract transfer path through
    `authorize_and_transfer`;
  - settlement recording;
  - unit tests covering the core state machine.
- Stellar CLI generated TypeScript bindings in `src/contracts/compliance_gateway`.

## Current Architecture

```text
sender agent
  -> corridor router
  -> local proof builder
  -> compliance_gateway.authorize_payment(...)
  -> Stellar payment/path payment settlement
```

The frontend generates an actual Groth16 proof for the compliance statement,
verifies it locally, and submits the proof plus public inputs to the gateway.
The contract binds the public inputs to current roots, commitments, nullifier,
amount, and corridor limit, then verifies the proof with Soroban BN254 pairing
host functions before recording or settling a payment intent.

## Technical Direction

Use Stellar's current ZK direction around Soroban-friendly primitives such as
BN254/Poseidon-era tooling for the first on-chain verifier path. Keep the proof
system modular:

- Tier 1: commitment and issuer signature checks for low-risk transfers.
- Tier 2: KYC membership, sanctions non-membership, and amount range proof.
- Tier 3: aggregated corridor proof for strict anchors and high-value transfers.

This lets the routing agent choose the cheapest proof that satisfies the
destination corridor without weakening the full protocol.

## Commands

```bash
npm run dev
npm run lint
npm run build
npm run zk:generate
npm run zk:test
```

Contract tests:

```bash
npm run contract:test
```

Build the Soroban contract:

```bash
npm run contract:build
```

Regenerate TypeScript bindings:

```bash
npm run contract:bindings
```

Regenerate the Soroban verifier and Rust proof fixture after changing the ZK
circuit:

```bash
npm run zk:generate
npm run contract:verifier
npm run zk:fixture
```

Deploy to Testnet:

```bash
STELLAR_ACCOUNT=your-funded-cli-identity npm run deploy:testnet
```

Bootstrap a deployed Testnet contract with the demo roots and corridor:

```bash
CONTRACT_ID=your-contract-id STELLAR_ACCOUNT=your-funded-cli-identity npm run bootstrap:testnet
```

Current Testnet deployment:

```text
contract: CAVNJJEORHARTAAKWB77DJK6I3TVJWH2MYVDCGBO7DZZTWQQ5QLWGSE6
admin:    GABMPCECAIYWFD5NN5QH4TBEMYZDPIU3NDEFKWGMG364R7BBXP46BY5H
network:  Test SDF Network ; September 2015
```

## Project Layout

```text
src/app/page.tsx
src/components/compliance-console.tsx
src/lib/compliance/protocol.ts
src/lib/compliance/store.ts
src/lib/stellar/gateway.ts
src/lib/zk/compliance-proof-source.ts
src/lib/zk/compliance-proof-core.ts
src/lib/zk/compliance-proof.ts
src/contracts/compliance_gateway/src/index.ts
contracts/contracts/compliance_gateway/src/lib.rs
contracts/contracts/compliance_gateway/src/verifier.rs
contracts/contracts/compliance_gateway/src/test.rs
scripts/generate-contract-verifier.ts
scripts/bootstrap-testnet.sh
```

## Remaining Real Work

- Add live Testnet state readback for roots, corridors, nullifiers, and intents.
- Add issuer/operator dashboards for rotating KYC and sanctions roots.
