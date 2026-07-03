export const COMPLIANCE_TREE_SIZE = 8;

export const COMPLIANCE_ZK_SCHEME = "zokrates-g16-bn128-compliance-v2";

export const COMPLIANCE_PROOF_SOURCE = `
from "hashes/poseidon/poseidon" import main as poseidon;

def main(
  private field senderId,
  private field receiverId,
  private field senderSalt,
  private field receiverSalt,
  private field nullifierSalt,
  private field[${COMPLIANCE_TREE_SIZE}] kycLeaves,
  private field[${COMPLIANCE_TREE_SIZE}] sanctionsLeaves,
  field kycRoot,
  field sanctionsRoot,
  field senderCommitment,
  field receiverCommitment,
  field nullifier,
  u64 amount,
  u64 corridorLimit
) -> bool {
  field mut computedKycRoot = 0;
  field mut computedSanctionsRoot = 0;
  bool mut kycIncluded = false;
  bool mut sanctionsClear = true;

  for u32 i in 0..${COMPLIANCE_TREE_SIZE} {
    computedKycRoot = poseidon([computedKycRoot, kycLeaves[i]]);
    computedSanctionsRoot = poseidon([computedSanctionsRoot, sanctionsLeaves[i]]);
    kycIncluded = kycIncluded || kycLeaves[i] == senderId;
    sanctionsClear = sanctionsClear && sanctionsLeaves[i] != senderId && sanctionsLeaves[i] != receiverId;
  }

  field expectedSenderCommitment = poseidon([senderId, senderSalt, kycRoot]);
  field expectedReceiverCommitment = poseidon([receiverId, receiverSalt, sanctionsRoot]);
  field expectedNullifier = poseidon([senderId, nullifierSalt, kycRoot, sanctionsRoot]);

  return computedKycRoot == kycRoot
    && computedSanctionsRoot == sanctionsRoot
    && kycIncluded
    && sanctionsClear
    && amount <= corridorLimit
    && expectedSenderCommitment == senderCommitment
    && expectedReceiverCommitment == receiverCommitment
    && expectedNullifier == nullifier;
}
`;
