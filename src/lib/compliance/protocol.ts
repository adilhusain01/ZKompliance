import { StrKey } from "@stellar/stellar-sdk";
import { z } from "zod";
import {
  buildComplianceWitness,
  publicSignalsToInputs,
  randomField,
  type ComplianceProofPayload,
} from "@/lib/zk/compliance-proof-core";

export const proofTiers = [
  {
    id: 1,
    name: "Commitment",
    cost: "sub-kB",
    latency: "instant",
    description: "Low-risk transfers use signed issuer commitments and replay nullifiers.",
  },
  {
    id: 2,
    name: "Membership bundle",
    cost: "small",
    latency: "seconds",
    description: "KYC set membership, sanctions non-membership, and corridor amount range.",
  },
  {
    id: 3,
    name: "Full corridor proof",
    cost: "heavy",
    latency: "prover-bound",
    description: "Aggregated proof for high-value payments and strict receiving anchors.",
  },
] as const;

export const corridors = [
  {
    code: "USDC-MXN",
    source: "US",
    destination: "MX",
    asset: "USDC",
    localAsset: "MXN",
    limit: 2500,
    feeBps: 18,
    minTier: 2,
    anchor: "LatAm Anchor A",
    settlement: "path_payment_strict_send",
  },
  {
    code: "USDC-PHP",
    source: "US",
    destination: "PH",
    asset: "USDC",
    localAsset: "PHPC",
    limit: 1200,
    feeBps: 24,
    minTier: 2,
    anchor: "SEA Anchor B",
    settlement: "path_payment_strict_send",
  },
  {
    code: "EURC-USDC",
    source: "EU",
    destination: "US",
    asset: "EURC",
    localAsset: "USDC",
    limit: 8000,
    feeBps: 12,
    minTier: 3,
    anchor: "Transatlantic Anchor C",
    settlement: "payment",
  },
] as const;

export type CorridorCode = (typeof corridors)[number]["code"];

export const paymentSchema = z.object({
  corridor: z.custom<CorridorCode>((value) =>
    corridors.some((corridor) => corridor.code === value),
  ),
  amount: z.coerce.number().positive(),
  sender: z.string().min(8),
  receiver: z.string().min(8),
  destination: z.string().refine(
    (value) =>
      value === "demo-recipient" || StrKey.isValidEd25519PublicKey(value),
    "Destination must be a Stellar public key or demo-recipient.",
  ),
});

export type PaymentInput = z.infer<typeof paymentSchema>;

export type ComplianceRoots = {
  kycRoot: string;
  sanctionsRoot: string;
  kycEpoch: number;
  sanctionsEpoch: number;
};

export type ProofBundle = {
  proofTier: number;
  proofHash: string;
  nullifier: string;
  senderCommitment: string;
  receiverCommitment: string;
  intentId: string;
  proofInputsHash: string;
  roots: ComplianceRoots;
  proof: ComplianceProofPayload;
};

export type GatewayAuthorization = {
  status: "authorized";
  contract: "compliance_gateway";
  operation: "authorize_payment";
  corridor: CorridorCode;
  amount: number;
  settlement: string;
  proof: ProofBundle;
};

const demoCredentialSet = {
  kycLeaves: [
    "acme-payroll-us",
    "contoso-treasury",
    "globex-payroll",
    "worker-734-mx",
  ],
  sanctionsLeaves: [
    "blocked-person-1",
    "blocked-person-2",
    "blocked-person-3",
  ],
};

const defaultWitness = buildComplianceWitness({
  senderId: "acme-payroll-us",
  receiverId: "worker-734-mx",
  senderSalt: "11",
  receiverSalt: "12",
  nullifierSalt: "13",
  ...demoCredentialSet,
  amount: 42000,
  corridorLimit: 250000,
});

export const defaultRoots: ComplianceRoots = {
  kycRoot: defaultWitness.publicSignals.kycRoot,
  sanctionsRoot: defaultWitness.publicSignals.sanctionsRoot,
  kycEpoch: 42,
  sanctionsEpoch: 118,
};

export function selectCorridor(code: CorridorCode) {
  return corridors.find((corridor) => corridor.code === code) ?? corridors[0];
}

export function selectProofTier(input: PaymentInput) {
  const corridor = selectCorridor(input.corridor);
  if (input.amount > corridor.limit * 0.72) return Math.max(corridor.minTier, 3);
  return corridor.minTier;
}

export async function buildProofBundle(input: PaymentInput): Promise<ProofBundle> {
  const parsed = paymentSchema.parse(input);
  const proofTier = selectProofTier(parsed);
  const corridor = selectCorridor(parsed.corridor);
  const proofInput = {
    senderId: parsed.sender,
    receiverId: parsed.receiver,
    senderSalt: randomField(),
    receiverSalt: randomField(),
    nullifierSalt: await digestHex(
      `nullifier-window:${parsed.sender}:${parsed.corridor}:${dayWindow()}`,
    ),
    ...demoCredentialSet,
    amount: toMinorUnits(parsed.amount),
    corridorLimit: toMinorUnits(corridor.limit),
  };
  const { createComplianceProof, verifyComplianceProof } = await import(
    "@/lib/zk/compliance-proof"
  );
  const proof = await createComplianceProof(proofInput);
  const expectedWitness = buildComplianceWitness(proofInput);
  const verified = await verifyComplianceProof({
    payload: proof,
    expectedSignals: expectedWitness.publicSignals,
  });
  if (!verified) {
    throw new Error("Generated compliance proof did not verify.");
  }

  const senderCommitment = proof.publicSignals.senderCommitment;
  const receiverCommitment = proof.publicSignals.receiverCommitment;
  const nullifier = proof.publicSignals.nullifier;
  const proofHash = await digestHex(JSON.stringify(proof.proof));
  const proofInputsHash = await digestHex(
    publicSignalsToInputs(proof.publicSignals).join(":"),
  );
  const intentId = await digestHex(
    `intent:${nullifier}:${parsed.destination}:${parsed.amount}`,
  );

  return {
    proofTier,
    proofHash,
    nullifier,
    senderCommitment,
    receiverCommitment,
    intentId,
    proofInputsHash,
    roots: {
      kycRoot: proof.publicSignals.kycRoot,
      sanctionsRoot: proof.publicSignals.sanctionsRoot,
      kycEpoch: defaultRoots.kycEpoch,
      sanctionsEpoch: defaultRoots.sanctionsEpoch,
    },
    proof,
  };
}

export async function authorizePayment(
  input: PaymentInput,
): Promise<GatewayAuthorization> {
  const parsed = paymentSchema.parse(input);
  const corridor = selectCorridor(parsed.corridor);
  if (parsed.amount > corridor.limit) {
    throw new Error(`Amount exceeds ${corridor.code} corridor limit.`);
  }

  const proof = await buildProofBundle(parsed);
  await new Promise((resolve) => setTimeout(resolve, 650));

  return {
    status: "authorized",
    contract: "compliance_gateway",
    operation: "authorize_payment",
    corridor: parsed.corridor,
    amount: parsed.amount,
    settlement: corridor.settlement,
    proof,
  };
}

function dayWindow() {
  return new Date().toISOString().slice(0, 10);
}

function toMinorUnits(amount: number) {
  return Math.round(amount * 10_000_000);
}

async function digestHex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `0x${Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}
