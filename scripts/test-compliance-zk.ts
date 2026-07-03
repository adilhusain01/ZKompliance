import assert from "node:assert/strict";
import {
  buildComplianceWitness,
  randomField,
} from "../src/lib/zk/compliance-proof-core";
import {
  createComplianceProof,
  verifyComplianceProof,
} from "../src/lib/zk/compliance-proof";

async function main() {
  const input = {
    senderId: "acme-payroll-us",
    receiverId: "worker-734-mx",
    senderSalt: randomField(),
    receiverSalt: randomField(),
    nullifierSalt: randomField(),
    kycLeaves: [
      "alice",
      "acme-payroll-us",
      "contoso-treasury",
      "globex-payroll",
    ],
    sanctionsLeaves: ["blocked-person-1", "blocked-person-2"],
    amount: 42_0000000,
    corridorLimit: 250_0000000,
  };

  const witness = buildComplianceWitness(input);
  const proof = await createComplianceProof(input);

  assert.equal(
    await verifyComplianceProof({
      payload: proof,
      expectedSignals: witness.publicSignals,
    }),
    true,
    "valid compliance proof should verify",
  );

  assert.equal(
    await verifyComplianceProof({
      payload: proof,
      expectedSignals: {
        ...witness.publicSignals,
        amount: witness.publicSignals.amount + 1,
      },
    }),
    false,
    "tampered amount should fail",
  );

  const overLimitProof = await createComplianceProof({
    ...input,
    amount: input.corridorLimit + 1,
  });
  assert.equal(
    await verifyComplianceProof({
      payload: overLimitProof,
      expectedSignals: overLimitProof.publicSignals,
    }),
    false,
    "over-limit proof should fail because circuit returns false",
  );

  const sanctionedProof = await createComplianceProof({
    ...input,
    sanctionsLeaves: ["blocked-person-1", input.senderId],
  });
  assert.equal(
    await verifyComplianceProof({
      payload: sanctionedProof,
      expectedSignals: sanctionedProof.publicSignals,
    }),
    false,
    "sanctioned sender proof should fail because circuit returns false",
  );

  const notKycProof = await createComplianceProof({
    ...input,
    kycLeaves: ["alice", "contoso-treasury"],
  });
  assert.equal(
    await verifyComplianceProof({
      payload: notKycProof,
      expectedSignals: notKycProof.publicSignals,
    }),
    false,
    "sender missing from KYC tree should fail because circuit returns false",
  );

  console.log("Compliance ZK proof tests passed.");
}

void main();
