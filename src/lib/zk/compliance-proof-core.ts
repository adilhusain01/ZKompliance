import {
  COMPLIANCE_TREE_SIZE,
  COMPLIANCE_ZK_SCHEME,
} from "@/lib/zk/compliance-proof-source";

const FIELD_PRIME =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const ROOT_FACTOR = 1315423911n;
const COMMIT_ID_FACTOR = 1000003n;
const COMMIT_SALT_FACTOR = 9176n;
const NULLIFIER_SALT_FACTOR = 31n;

export type CompliancePublicSignals = {
  kycRoot: string;
  sanctionsRoot: string;
  senderCommitment: string;
  receiverCommitment: string;
  nullifier: string;
  amount: number;
  corridorLimit: number;
};

export type ComplianceProofPayload = {
  scheme: typeof COMPLIANCE_ZK_SCHEME;
  proof: {
    scheme: string;
    curve: string;
    proof: object;
    inputs: string[];
  };
  publicSignals: CompliancePublicSignals;
};

export type ComplianceWitness = {
  senderId: string;
  receiverId: string;
  senderSalt: string;
  receiverSalt: string;
  nullifierSalt: string;
  kycLeaves: string[];
  sanctionsLeaves: string[];
  publicSignals: CompliancePublicSignals;
};

export type ComplianceCredentialInput = {
  senderId: string;
  receiverId: string;
  senderSalt: string;
  receiverSalt: string;
  nullifierSalt: string;
  kycLeaves: string[];
  sanctionsLeaves: string[];
  amount: number;
  corridorLimit: number;
};

export { COMPLIANCE_TREE_SIZE, COMPLIANCE_ZK_SCHEME };

export function buildComplianceWitness(
  input: ComplianceCredentialInput,
): ComplianceWitness {
  if (!Number.isInteger(input.amount) || input.amount < 0) {
    throw new Error("Amount must be a non-negative integer minor-unit value.");
  }
  if (!Number.isInteger(input.corridorLimit) || input.corridorLimit < 0) {
    throw new Error("Corridor limit must be a non-negative integer minor-unit value.");
  }

  const senderId = identityField(input.senderId);
  const receiverId = identityField(input.receiverId);
  const senderSalt = normalizeField(input.senderSalt);
  const receiverSalt = normalizeField(input.receiverSalt);
  const nullifierSalt = normalizeField(input.nullifierSalt);
  const kycLeaves = padLeaves(input.kycLeaves.map(identityField));
  const sanctionsLeaves = padLeaves(input.sanctionsLeaves.map(identityField));
  const kycRoot = computeListRoot(kycLeaves);
  const sanctionsRoot = computeListRoot(sanctionsLeaves);
  const senderCommitment = computeCommitment(senderId, senderSalt, kycRoot);
  const receiverCommitment = computeCommitment(
    receiverId,
    receiverSalt,
    sanctionsRoot,
  );
  const nullifier = computeNullifier(
    senderId,
    nullifierSalt,
    kycRoot,
    sanctionsRoot,
  );

  return {
    senderId,
    receiverId,
    senderSalt,
    receiverSalt,
    nullifierSalt,
    kycLeaves,
    sanctionsLeaves,
    publicSignals: {
      kycRoot,
      sanctionsRoot,
      senderCommitment,
      receiverCommitment,
      nullifier,
      amount: input.amount,
      corridorLimit: input.corridorLimit,
    },
  };
}

export function publicSignalsToInputs(signals: CompliancePublicSignals) {
  return [
    signals.kycRoot,
    signals.sanctionsRoot,
    signals.senderCommitment,
    signals.receiverCommitment,
    signals.nullifier,
    signals.amount,
    signals.corridorLimit,
    1,
  ].map(toPaddedHex);
}

export function identityField(value: string) {
  let hash = 0n;
  for (const char of value.trim().toLowerCase()) {
    hash = toFieldBigInt(hash * 257n + BigInt(char.charCodeAt(0)));
  }
  return toFieldHex(hash);
}

export function normalizeField(value: string | number | bigint) {
  return toFieldHex(normalizeFieldBigInt(value));
}

export function normalizeFieldBigInt(value: string | number | bigint) {
  if (typeof value === "bigint") return toFieldBigInt(value);
  if (typeof value === "number") return toFieldBigInt(BigInt(value));
  return toFieldBigInt(value.startsWith("0x") ? BigInt(value) : BigInt(value));
}

export function toDecimalField(value: string | number | bigint) {
  return normalizeFieldBigInt(value).toString();
}

export function randomField() {
  const bytes = new Uint8Array(31);
  globalThis.crypto.getRandomValues(bytes);
  let value = 0n;
  for (const byte of bytes) {
    value = (value << 8n) + BigInt(byte);
  }
  return toFieldHex(value);
}

function padLeaves(leaves: string[]) {
  if (leaves.length > COMPLIANCE_TREE_SIZE) {
    throw new Error(`Compliance circuit supports ${COMPLIANCE_TREE_SIZE} leaves.`);
  }

  return Array.from({ length: COMPLIANCE_TREE_SIZE }, (_, index) =>
    leaves[index] ? normalizeField(leaves[index]) : normalizeField(0),
  );
}

function computeListRoot(leaves: string[]) {
  const root = leaves.reduce(
    (hash, leaf) => toFieldBigInt(hash * ROOT_FACTOR + normalizeFieldBigInt(leaf)),
    0n,
  );
  return toFieldHex(root);
}

function computeCommitment(id: string, salt: string, root: string) {
  return toFieldHex(
    normalizeFieldBigInt(id) * COMMIT_ID_FACTOR +
      normalizeFieldBigInt(salt) * COMMIT_SALT_FACTOR +
      normalizeFieldBigInt(root),
  );
}

function computeNullifier(
  senderId: string,
  nullifierSalt: string,
  kycRoot: string,
  sanctionsRoot: string,
) {
  return toFieldHex(
    normalizeFieldBigInt(senderId) * COMMIT_ID_FACTOR +
      normalizeFieldBigInt(nullifierSalt) * NULLIFIER_SALT_FACTOR +
      normalizeFieldBigInt(kycRoot) +
      normalizeFieldBigInt(sanctionsRoot),
  );
}

function toFieldBigInt(value: bigint) {
  const normalized = value % FIELD_PRIME;
  return normalized >= 0n ? normalized : normalized + FIELD_PRIME;
}

function toFieldHex(value: bigint) {
  return `0x${toFieldBigInt(value).toString(16).padStart(64, "0")}`;
}

function toPaddedHex(value: string | number | bigint) {
  return toFieldHex(normalizeFieldBigInt(value));
}
