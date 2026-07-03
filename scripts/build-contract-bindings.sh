#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS_DIR="$ROOT_DIR/contracts"
WASM="$CONTRACTS_DIR/target/wasm32v1-none/release/compliance_gateway.wasm"
OUT_DIR="$ROOT_DIR/src/contracts/compliance_gateway"

cd "$CONTRACTS_DIR"
stellar contract build
stellar contract bindings typescript \
  --wasm "$WASM" \
  --output-dir "$OUT_DIR" \
  --overwrite
