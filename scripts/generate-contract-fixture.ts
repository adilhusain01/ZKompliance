import { writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createComplianceProof } from "../src/lib/zk/compliance-proof";

function strip(hex: string) {
  return hex.replace(/^0x/, "").padStart(64, "0");
}

function bytes(hex: string) {
  const normalized = strip(hex);
  return Array.from({ length: normalized.length / 2 }, (_, index) =>
    `0x${normalized.slice(index * 2, index * 2 + 2)}`,
  ).join(", ");
}

function g1(point: string[]) {
  return `[${bytes(point[0])}, ${bytes(point[1])}]`;
}

function g2(point: string[][]) {
  return `[${bytes(point[0][1])}, ${bytes(point[0][0])}, ${bytes(point[1][1])}, ${bytes(point[1][0])}]`;
}

async function main() {
  const proof = await createComplianceProof({
    senderId: "acme-payroll-us",
    receiverId: "worker-734-mx",
    senderSalt: "11",
    receiverSalt: "12",
    nullifierSalt: "13",
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
    amount: 1_250_0000000,
    corridorLimit: 5_000_0000000,
  });

  const proofObject = proof.proof.proof as {
    a: string[];
    b: string[][];
    c: string[];
  };
  const publicInputs = proof.proof.inputs.map(strip);
  const proofHash = createHash("sha256")
    .update(JSON.stringify(proof.proof))
    .digest("hex");
  const proofInputsHash = createHash("sha256")
    .update(proof.proof.inputs.join(":"))
    .digest("hex");

  const rust = `use soroban_sdk::{BytesN, Env, Vec};

use super::{Groth16Proof, PaymentRequest};

const PROOF_A: [u8; 64] = ${g1(proofObject.a)};
const PROOF_B: [u8; 128] = ${g2(proofObject.b)};
const PROOF_C: [u8; 64] = ${g1(proofObject.c)};
const PUBLIC_INPUTS: [[u8; 32]; 8] = [
${publicInputs.map((input) => `    [${bytes(input)}]`).join(",\n")},
];
const PROOF_HASH: [u8; 32] = [${bytes(proofHash)}];
const PROOF_INPUTS_HASH: [u8; 32] = [${bytes(proofInputsHash)}];

pub fn valid_proof(env: &Env) -> Groth16Proof {
    let mut inputs = Vec::new(env);
    for input in PUBLIC_INPUTS {
        inputs.push_back(BytesN::from_array(env, &input));
    }
    Groth16Proof {
        a: BytesN::from_array(env, &PROOF_A),
        b: BytesN::from_array(env, &PROOF_B),
        c: BytesN::from_array(env, &PROOF_C),
        inputs,
    }
}

pub fn valid_request(env: &Env, destination: soroban_sdk::Address) -> PaymentRequest {
    PaymentRequest {
        intent_id: BytesN::from_array(env, &[1; 32]),
        nullifier: BytesN::from_array(env, &PUBLIC_INPUTS[4]),
        corridor: soroban_sdk::symbol_short!("USDCMXN"),
        sender_commitment: BytesN::from_array(env, &PUBLIC_INPUTS[2]),
        receiver_commitment: BytesN::from_array(env, &PUBLIC_INPUTS[3]),
        destination,
        amount: 1_250_0000000,
        proof_hash: BytesN::from_array(env, &PROOF_HASH),
        proof_inputs_hash: BytesN::from_array(env, &PROOF_INPUTS_HASH),
        proof_tier: 2,
        zk_proof: valid_proof(env),
    }
}

pub fn kyc_root(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &PUBLIC_INPUTS[0])
}

pub fn sanctions_root(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &PUBLIC_INPUTS[1])
}
`;

  await writeFile(
    "contracts/contracts/compliance_gateway/src/proof_fixture.rs",
    rust,
  );
  console.log("Generated Soroban proof fixture.");
}

void main();
