#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS_DIR="$ROOT_DIR/contracts"
WASM="$CONTRACTS_DIR/target/wasm32v1-none/release/compliance_gateway.wasm"

: "${STELLAR_ACCOUNT:?Set STELLAR_ACCOUNT to a Stellar CLI identity, secret key, or funded source account.}"

STELLAR_NETWORK="${STELLAR_NETWORK:-testnet}"
STELLAR_RPC_URL="${STELLAR_RPC_URL:-https://soroban-testnet.stellar.org}"
STELLAR_NETWORK_PASSPHRASE="${STELLAR_NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"

cd "$CONTRACTS_DIR"
stellar contract build

CONTRACT_ID="$(
  stellar contract deploy \
    --wasm "$WASM" \
    --source-account "$STELLAR_ACCOUNT" \
    --network "$STELLAR_NETWORK" \
    --rpc-url "$STELLAR_RPC_URL" \
    --network-passphrase "$STELLAR_NETWORK_PASSPHRASE" \
    --alias compliance_gateway
)"

echo "NEXT_PUBLIC_COMPLIANCE_GATEWAY_CONTRACT_ID=$CONTRACT_ID"
echo "NEXT_PUBLIC_STELLAR_RPC_URL=$STELLAR_RPC_URL"
echo "NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE=$STELLAR_NETWORK_PASSPHRASE"
