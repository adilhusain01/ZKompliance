import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { initialize } from "zokrates-js";

const sourcePath = resolve("src/lib/zk/compliance-proof-source.ts");
const outputPath = resolve("src/lib/zk/compliance-proof-artifact.json");

async function main() {
  const sourceFile = await readFile(sourcePath, "utf8");
  const treeSize = sourceFile.match(/export const COMPLIANCE_TREE_SIZE = (\d+);/)?.[1];
  const sourceTemplate = sourceFile.match(
    /export const COMPLIANCE_PROOF_SOURCE = `([\s\S]*?)`;/,
  )?.[1];

  if (!treeSize || !sourceTemplate) {
    throw new Error("Unable to read compliance proof circuit source.");
  }

  const source = sourceTemplate.replaceAll("${COMPLIANCE_TREE_SIZE}", treeSize);
  const zokratesProvider = await initialize();
  const artifacts = zokratesProvider.compile(source);
  const keypair = zokratesProvider.setup(artifacts.program);

  const payload = {
    generatedAt: new Date().toISOString(),
    constraintCount: artifacts.constraintCount,
    treeSize: Number(treeSize),
    source,
    program: Array.from(artifacts.program),
    abi: artifacts.abi,
    provingKey: Array.from(keypair.pk),
    verificationKey: keypair.vk,
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload)}\n`);

  console.log(
    `Generated compliance ZK artifact with ${artifacts.constraintCount} constraints at ${outputPath}`,
  );
}

void main();
