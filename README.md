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
- Stellar CLI Soroban workspace under `contracts/`.
- ZoKrates Groth16/BN128 compliance proof pipeline:
  - circuit source;
  - generated proving and verification artifacts;
  - proof generation in the browser/app runtime;
  - local verifier checks before contract authorization.
- `compliance_gateway` Soroban contract with:
  - admin initialization;
  - issuer allowlist and quorum root governance;
  - KYC and sanctions root rotation;
  - corridor policy and proof-tier gating;
  - nullifier replay protection;
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

The frontend generates an actual Groth16 proof for the compliance statement and
verifies it locally before producing the contract request. The contract records a
`proof_hash`, `proof_inputs_hash`, proof tier, roots, commitments, nullifier, and
payment intent. The remaining cryptographic hardening step is to port the
generated verification key into a Soroban BN254 pairing verifier so proof
verification happens on-chain instead of verifier-bound preflight plus on-chain
commitment.

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

Deploy to Testnet:

```bash
STELLAR_ACCOUNT=your-funded-cli-identity npm run deploy:testnet
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
contracts/contracts/compliance_gateway/src/test.rs
```

## Remaining Real Work

- Port the generated ZoKrates verification key into a Soroban BN254 pairing
  verifier and call it inside `authorize_payment` / `authorize_and_transfer`.
- Replace the demo field hash in the circuit with a production Poseidon Merkle
  tree circuit compatible with Soroban Poseidon host functions.
- Add a deployed Testnet configuration once a funded source account is provided.
- Expand the UI from proof preflight to full Freighter submission once the
  Testnet contract ID is available.
