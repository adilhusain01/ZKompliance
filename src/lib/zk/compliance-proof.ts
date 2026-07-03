import type {
  CompilationArtifacts,
  Proof,
  VerificationKey,
  ZoKratesProvider,
} from "zokrates-js";
import artifact from "@/lib/zk/compliance-proof-artifact.json";
import {
  buildComplianceWitness,
  COMPLIANCE_ZK_SCHEME,
  publicSignalsToInputs,
  toDecimalField,
  type ComplianceCredentialInput,
  type ComplianceProofPayload,
  type CompliancePublicSignals,
} from "@/lib/zk/compliance-proof-core";

type ComplianceProofArtifact = {
  program: number[];
  abi: CompilationArtifacts["abi"];
  provingKey: number[];
  verificationKey: VerificationKey;
};

const complianceProofArtifact = artifact as unknown as ComplianceProofArtifact;

let providerPromise: Promise<ZoKratesProvider> | undefined;
let artifactsCache: CompilationArtifacts | undefined;
let provingKeyCache: Uint8Array | undefined;

export async function createComplianceProof(
  input: ComplianceCredentialInput,
): Promise<ComplianceProofPayload> {
  const zokratesProvider = await getZoKratesProvider();
  const proofArtifacts = getProofArtifacts();
  const witness = buildComplianceWitness(input);
  const { witness: computedWitness } = zokratesProvider.computeWitness(
    proofArtifacts,
    [
      toDecimalField(witness.senderId),
      toDecimalField(witness.receiverId),
      toDecimalField(witness.senderSalt),
      toDecimalField(witness.receiverSalt),
      toDecimalField(witness.nullifierSalt),
      witness.kycLeaves.map(toDecimalField),
      witness.sanctionsLeaves.map(toDecimalField),
      toDecimalField(witness.publicSignals.kycRoot),
      toDecimalField(witness.publicSignals.sanctionsRoot),
      toDecimalField(witness.publicSignals.senderCommitment),
      toDecimalField(witness.publicSignals.receiverCommitment),
      toDecimalField(witness.publicSignals.nullifier),
      witness.publicSignals.amount.toString(),
      witness.publicSignals.corridorLimit.toString(),
    ],
  );
  const proof = zokratesProvider.generateProof(
    proofArtifacts.program,
    computedWitness,
    getProvingKey(),
  );

  return {
    scheme: COMPLIANCE_ZK_SCHEME,
    proof: proof as ComplianceProofPayload["proof"],
    publicSignals: witness.publicSignals,
  };
}

export async function verifyComplianceProof(params: {
  payload: ComplianceProofPayload;
  expectedSignals: CompliancePublicSignals;
}) {
  if (params.payload.scheme !== COMPLIANCE_ZK_SCHEME) return false;
  if (!signalsEqual(params.payload.publicSignals, params.expectedSignals)) return false;
  if (!proofInputsEqual(params.payload.proof, params.expectedSignals)) return false;

  const zokratesProvider = await getZoKratesProvider();
  return zokratesProvider.verify(
    complianceProofArtifact.verificationKey,
    params.payload.proof as Proof,
  );
}

export function getComplianceVerificationKey() {
  return complianceProofArtifact.verificationKey;
}

async function getZoKratesProvider() {
  providerPromise ??= import("zokrates-js").then((module) => module.initialize());
  return providerPromise;
}

function getProofArtifacts(): CompilationArtifacts {
  artifactsCache ??= {
    program: Uint8Array.from(complianceProofArtifact.program),
    abi: complianceProofArtifact.abi,
  };
  return artifactsCache;
}

function getProvingKey() {
  provingKeyCache ??= Uint8Array.from(complianceProofArtifact.provingKey);
  return provingKeyCache;
}

function signalsEqual(
  left: CompliancePublicSignals,
  right: CompliancePublicSignals,
) {
  return publicSignalsToInputs(left).join(":") === publicSignalsToInputs(right).join(":");
}

function proofInputsEqual(
  proof: ComplianceProofPayload["proof"],
  signals: CompliancePublicSignals,
) {
  return (
    proof.inputs.join(":").toLowerCase() ===
    publicSignalsToInputs(signals).join(":").toLowerCase()
  );
}
