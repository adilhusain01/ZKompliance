"use client";

import { Buffer } from "buffer";
import {
  Asset,
  BASE_FEE,
  Horizon,
  Memo,
  Networks,
  Operation,
  Transaction,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import {
  getAddress,
  isConnected,
  requestAccess,
  signTransaction,
} from "@stellar/freighter-api";
import {
  Client as ComplianceGatewayClient,
  type Corridor,
  type Groth16Proof,
  type PaymentRequest,
  type RootKind,
  type RootRecord,
} from "@/contracts/compliance_gateway/src";
import type { GatewayAuthorization } from "@/lib/compliance/protocol";

export const STELLAR_TESTNET = {
  horizonUrl: "https://horizon-testnet.stellar.org",
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: Networks.TESTNET,
};

export async function connectFreighterWallet() {
  const connected = await isConnected();
  if (connected.error) throw new Error(connected.error.message);

  const access = connected.isConnected ? await getAddress() : await requestAccess();
  if (access.error) throw new Error(access.error.message);
  if (!access.address) throw new Error("Freighter did not return an address.");
  return access.address;
}

export async function buildNativeSettlementXdr(params: {
  source: string;
  destination: string;
  amount: string;
  memo: string;
}) {
  const server = new Horizon.Server(STELLAR_TESTNET.horizonUrl);
  const account = await server.loadAccount(params.source);
  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: STELLAR_TESTNET.networkPassphrase,
  })
    .addOperation(
      Operation.payment({
        destination: params.destination,
        asset: Asset.native(),
        amount: params.amount,
      }),
    )
    .addMemo(Memo.text(params.memo.slice(0, 28)))
    .setTimeout(180)
    .build();

  return transaction.toXDR();
}

export async function signWithFreighter(xdr: string, address?: string) {
  const signed = await signTransaction(xdr, {
    address,
    networkPassphrase: STELLAR_TESTNET.networkPassphrase,
  });
  if (signed.error) throw new Error(signed.error.message);
  if (!signed.signedTxXdr) throw new Error("Freighter returned an empty transaction.");
  return signed.signedTxXdr;
}

export async function submitHorizonXdr(signedXdr: string) {
  const server = new Horizon.Server(STELLAR_TESTNET.horizonUrl);
  const transaction = new Transaction(signedXdr, STELLAR_TESTNET.networkPassphrase);
  const result = await server.submitTransaction(transaction);
  return {
    hash: result.hash,
    ledger: result.ledger,
  };
}

export function getComplianceGatewayClient(params: {
  contractId: string;
  publicKey?: string;
}) {
  return new ComplianceGatewayClient({
    contractId: params.contractId,
    publicKey: params.publicKey,
    networkPassphrase: STELLAR_TESTNET.networkPassphrase,
    rpcUrl: STELLAR_TESTNET.rpcUrl,
  });
}

export type GatewaySnapshot = {
  admin: string;
  kycRoot?: RootRecord;
  sanctionsRoot?: RootRecord;
  corridor?: Corridor;
};

export async function readGatewaySnapshot(params: {
  contractId: string;
  corridorCode?: string;
}): Promise<GatewaySnapshot> {
  const client = getComplianceGatewayClient({
    contractId: params.contractId,
  });
  const [admin, kycRoot, sanctionsRoot, corridor] = await Promise.all([
    client.get_admin(),
    client.get_root({ kind: rootKind("Kyc") }),
    client.get_root({ kind: rootKind("Sanctions") }),
    client.get_corridor({ code: params.corridorCode ?? "USDCMXN" }),
  ]);

  return {
    admin: admin.result,
    kycRoot: kycRoot.result ?? undefined,
    sanctionsRoot: sanctionsRoot.result ?? undefined,
    corridor: corridor.result ?? undefined,
  };
}

export async function readGatewayIntent(params: {
  contractId: string;
  intentId?: string;
}) {
  if (!params.intentId) return undefined;
  const client = getComplianceGatewayClient({
    contractId: params.contractId,
  });
  const intent = await client.get_intent({
    intent_id: hexToBuffer(params.intentId),
  });
  return intent.result ?? undefined;
}

export async function readNullifierStatus(params: {
  contractId: string;
  nullifier?: string;
}) {
  if (!params.nullifier) return false;
  const client = getComplianceGatewayClient({
    contractId: params.contractId,
  });
  const status = await client.is_nullifier_used({
    nullifier: hexToBuffer(params.nullifier),
  });
  return status.result;
}

export async function buildGatewayAuthorization(params: {
  contractId: string;
  source: string;
  destination: string;
  authorization: GatewayAuthorization;
}) {
  const client = getComplianceGatewayClient({
    contractId: params.contractId,
    publicKey: params.source,
  });
  const request = gatewayAuthorizationToRequest({
    authorization: params.authorization,
    destination: params.destination,
  });
  return client.authorize_payment({ request });
}

export async function buildGatewayAtomicTransfer(params: {
  contractId: string;
  source: string;
  destination: string;
  assetContract: string;
  authorization: GatewayAuthorization;
}) {
  const client = getComplianceGatewayClient({
    contractId: params.contractId,
    publicKey: params.source,
  });
  const request = gatewayAuthorizationToRequest({
    authorization: params.authorization,
    destination: params.destination,
  });
  return client.authorize_and_transfer({
    request,
    asset_contract: params.assetContract,
    source: params.source,
  });
}

export async function buildRootRotation(params: {
  contractId: string;
  source: string;
  kind: "Kyc" | "Sanctions";
  root: string;
  epoch: number;
}) {
  const client = getComplianceGatewayClient({
    contractId: params.contractId,
    publicKey: params.source,
  });
  return client.rotate_root({
    kind: rootKind(params.kind),
    root: hexToBuffer(params.root),
    epoch: params.epoch,
    issuer: params.source,
  });
}

export function gatewayAuthorizationToRequest(params: {
  authorization: GatewayAuthorization;
  destination: string;
}): PaymentRequest {
  const proof = params.authorization.proof;
  return {
    intent_id: hexToBuffer(proof.intentId),
    nullifier: hexToBuffer(proof.nullifier),
    corridor: params.authorization.corridor.replace("-", ""),
    sender_commitment: hexToBuffer(proof.senderCommitment),
    receiver_commitment: hexToBuffer(proof.receiverCommitment),
    destination: params.destination,
    amount: BigInt(Math.round(params.authorization.amount * 10_000_000)),
    proof_hash: hexToBuffer(proof.proofHash),
    proof_inputs_hash: hexToBuffer(proof.proofInputsHash),
    proof_tier: proof.proofTier,
    zk_proof: proofPayloadToContractProof(proof.proof),
  };
}

function proofPayloadToContractProof(
  payload: GatewayAuthorization["proof"]["proof"],
): Groth16Proof {
  const proof = payload.proof.proof as {
    a: [string, string];
    b: [[string, string], [string, string]];
    c: [string, string];
  };

  return {
    a: g1ToBuffer(proof.a),
    b: g2ToBuffer(proof.b),
    c: g1ToBuffer(proof.c),
    inputs: payload.proof.inputs.map(hexToBuffer),
  };
}

function g1ToBuffer(point: [string, string]) {
  return Buffer.concat([hexToBuffer(point[0]), hexToBuffer(point[1])]);
}

function g2ToBuffer(point: [[string, string], [string, string]]) {
  return Buffer.concat([
    hexToBuffer(point[0][1]),
    hexToBuffer(point[0][0]),
    hexToBuffer(point[1][1]),
    hexToBuffer(point[1][0]),
  ]);
}

export function bufferToHex(buffer?: Buffer) {
  return buffer ? `0x${Buffer.from(buffer).toString("hex")}` : undefined;
}

export function hexToBuffer(hex: string) {
  return Buffer.from(hexWithoutPrefix(hex).padStart(64, "0"), "hex");
}

function hexWithoutPrefix(hex: string) {
  return hex.replace(/^0x/, "");
}

function rootKind(tag: "Kyc" | "Sanctions"): RootKind {
  return { tag, values: undefined };
}
