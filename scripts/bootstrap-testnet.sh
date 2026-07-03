#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

: "${STELLAR_ACCOUNT:?Set STELLAR_ACCOUNT to a Stellar CLI identity, secret key, or funded source account.}"
: "${CONTRACT_ID:?Set CONTRACT_ID to the deployed compliance_gateway contract id.}"

STELLAR_NETWORK="${STELLAR_NETWORK:-testnet}"
STELLAR_RPC_URL="${STELLAR_RPC_URL:-https://soroban-testnet.stellar.org}"
STELLAR_NETWORK_PASSPHRASE="${STELLAR_NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"

ADMIN_ADDRESS="${ADMIN_ADDRESS:-$(stellar keys address "$STELLAR_ACCOUNT")}"
read -r KYC_ROOT SANCTIONS_ROOT < <(
  cd "$ROOT_DIR"
  npx tsx -e "import { defaultRoots } from './src/lib/compliance/protocol'; console.log(defaultRoots.kycRoot.replace(/^0x/, ''), defaultRoots.sanctionsRoot.replace(/^0x/, ''));"
)

stellar_args=(
  --id "$CONTRACT_ID"
  --source-account "$STELLAR_ACCOUNT"
  --network "$STELLAR_NETWORK"
  --rpc-url "$STELLAR_RPC_URL"
  --network-passphrase "$STELLAR_NETWORK_PASSPHRASE"
)

stellar contract invoke "${stellar_args[@]}" -- init \
  --admin "$ADMIN_ADDRESS"

stellar contract invoke "${stellar_args[@]}" -- rotate_root \
  --kind Kyc \
  --root "$KYC_ROOT" \
  --epoch 42 \
  --issuer "$ADMIN_ADDRESS"

stellar contract invoke "${stellar_args[@]}" -- rotate_root \
  --kind Sanctions \
  --root "$SANCTIONS_ROOT" \
  --epoch 118 \
  --issuer "$ADMIN_ADDRESS"

stellar contract invoke "${stellar_args[@]}" -- set_corridor \
  --code USDCMXN \
  --asset USDC \
  --limit 25000000000 \
  --min_proof_tier 2 \
  --active true

echo "Bootstrapped compliance gateway $CONTRACT_ID"
