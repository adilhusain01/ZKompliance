import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type G1Point = [string, string];
type G2Point = [[string, string], [string, string]];

type VerificationKey = {
  alpha: G1Point;
  beta: G2Point;
  gamma: G2Point;
  delta: G2Point;
  gamma_abc: G1Point[];
};

type ComplianceArtifact = {
  verificationKey: VerificationKey;
};

const artifactPath = resolve("src/lib/zk/compliance-proof-artifact.json");
const outputPath = resolve(
  "contracts/contracts/compliance_gateway/src/verifier.rs",
);

function strip(hex: string) {
  return hex.replace(/^0x/, "").padStart(64, "0");
}

function bytes(hex: string) {
  const normalized = strip(hex);
  return Array.from({ length: normalized.length / 2 }, (_, index) =>
    `0x${normalized.slice(index * 2, index * 2 + 2)}`,
  ).join(", ");
}

function g1(point: G1Point) {
  return `[${bytes(point[0])}, ${bytes(point[1])}]`;
}

function g2(point: G2Point) {
  return `[${bytes(point[0][1])}, ${bytes(point[0][0])}, ${bytes(point[1][1])}, ${bytes(point[1][0])}]`;
}

async function main() {
  const artifact = JSON.parse(
    await readFile(artifactPath, "utf8"),
  ) as ComplianceArtifact;
  const vk = artifact.verificationKey;
  const publicInputCount = vk.gamma_abc.length - 1;
  const gammaAbcConstants = vk.gamma_abc
    .map((point, index) => `const GAMMA_ABC_${index}: [u8; 64] = ${g1(point)};`)
    .join("\n");
  const gammaAbcRefs = Array.from(
    { length: vk.gamma_abc.length },
    (_, index) => `&GAMMA_ABC_${index}`,
  );

  const rust = `use soroban_sdk::{crypto::bn254::{Bn254Fr, Bn254G1Affine, Bn254G2Affine}, BytesN, Env, Vec};

use crate::Groth16Proof;

pub const PUBLIC_INPUT_COUNT: u32 = ${publicInputCount};

const ALPHA: [u8; 64] = ${g1(vk.alpha)};
const BETA: [u8; 128] = ${g2(vk.beta)};
const GAMMA: [u8; 128] = ${g2(vk.gamma)};
const DELTA: [u8; 128] = ${g2(vk.delta)};
${gammaAbcConstants}

const GAMMA_ABC: [&[u8; 64]; ${vk.gamma_abc.length}] = [
    ${gammaAbcRefs.join(", ")},
];

pub fn verify_compliance_proof(env: &Env, proof: &Groth16Proof) -> bool {
    if proof.inputs.len() != PUBLIC_INPUT_COUNT {
        return false;
    }

    let bn254 = env.crypto().bn254();
    let mut vk_x = g1(env, GAMMA_ABC[0]);
    let mut index = 0;
    while index < PUBLIC_INPUT_COUNT {
        let input = proof.inputs.get(index).unwrap();
        let scalar = Bn254Fr::from_bytes(input);
        let point = g1(env, GAMMA_ABC[(index + 1) as usize]);
        let weighted = bn254.g1_mul(&point, &scalar);
        vk_x = bn254.g1_add(&vk_x, &weighted);
        index += 1;
    }

    let mut g1_points = Vec::new(env);
    g1_points.push_back(Bn254G1Affine::from_bytes(proof.a.clone()));
    g1_points.push_back(-vk_x);
    g1_points.push_back(-Bn254G1Affine::from_bytes(proof.c.clone()));
    g1_points.push_back(-g1(env, &ALPHA));

    let mut g2_points = Vec::new(env);
    g2_points.push_back(Bn254G2Affine::from_bytes(proof.b.clone()));
    g2_points.push_back(g2(env, &GAMMA));
    g2_points.push_back(g2(env, &DELTA));
    g2_points.push_back(g2(env, &BETA));

    bn254.pairing_check(g1_points, g2_points)
}

fn g1(env: &Env, bytes: &[u8; 64]) -> Bn254G1Affine {
    Bn254G1Affine::from_bytes(BytesN::from_array(env, bytes))
}

fn g2(env: &Env, bytes: &[u8; 128]) -> Bn254G2Affine {
    Bn254G2Affine::from_bytes(BytesN::from_array(env, bytes))
}
`;

  await writeFile(outputPath, rust);
  console.log(`Generated Soroban verifier at ${outputPath}`);
}

void main();
