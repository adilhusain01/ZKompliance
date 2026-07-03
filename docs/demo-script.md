# ZK Compliance Gateway Demo Script

## One-Line Pitch

ZK Compliance Gateway lets an autonomous payment agent prove KYC, sanctions, and corridor-limit compliance to a Soroban contract before value moves, without revealing the sender or receiver identity to every routing hop.

## Judge Demo Flow

1. Open the dashboard and show the payment intent.
2. Keep the demo sender as `acme-payroll-us` and receiver as `worker-734-mx`.
3. Select `USDC-MXN`, choose an amount under the corridor limit, and generate the proof.
4. Point out the three public facts the proof binds: current KYC root, current sanctions root, and amount under corridor limit.
5. Connect Freighter on Stellar Testnet.
6. Submit to Soroban with either `Authorize only` or `Atomic native SAC transfer`.
7. Open the transaction on Stellar Expert and show the gateway authorization or settlement event.

## What Is Real

- The browser generates a Groth16 proof with ZoKrates.
- The proof uses Poseidon for roots, commitments, and nullifiers.
- The Soroban contract verifies the proof on-chain with BN254 pairing host functions.
- The contract rejects mismatched public inputs, low proof tiers, over-limit amounts, replayed nullifiers, and duplicate intents.
- The deployed Testnet contract is initialized with demo KYC and sanctions roots, three active corridors, and native SAC settlement for the atomic transfer path.

## Testnet Deployment

```text
contract: CCNX22JKOQ2SITUZMBVPFDBUO6W6NRN2VGMBB6A4VLETHJUF4RCQYVGP
admin:    GABMPCECAIYWFD5NN5QH4TBEMYZDPIU3NDEFKWGMG364R7BBXP46BY5H
network:  Test SDF Network ; September 2015
```

Configured corridors:

```text
USDCMXN   USDC  limit 2,500  min tier 2
USDCPHP   USDC  limit 1,200  min tier 2
EURCUSDC  EURC  limit 8,000  min tier 3
```

Atomic settlement demo asset:

```text
native SAC  CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
```

## Why Stellar

Stellar already has the corridor, anchor, and regulated asset concepts this project needs. Soroban gives the compliance gateway programmable enforcement, while BN254 host functions make verifier execution practical enough to move proof verification into the settlement transaction.

## Next Protocol Steps

- Add regulated asset issuance/minting around non-native Testnet demo assets.
- Add a multi-wallet judge script for two-issuer quorum execution.
