export const COMPLIANCE_TREE_SIZE = 8;

export const COMPLIANCE_ZK_SCHEME = "zokrates-g16-bn128-compliance-v1";

export const COMPLIANCE_PROOF_SOURCE = `
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
  u32 amount,
  u32 corridorLimit
) -> bool {
  field mut computedKycRoot = 0;
  field mut computedSanctionsRoot = 0;
  bool mut kycIncluded = false;
  bool mut sanctionsClear = true;

  for u32 i in 0..${COMPLIANCE_TREE_SIZE} {
    computedKycRoot = computedKycRoot * 1315423911 + kycLeaves[i];
    computedSanctionsRoot = computedSanctionsRoot * 1315423911 + sanctionsLeaves[i];
    kycIncluded = kycIncluded || kycLeaves[i] == senderId;
    sanctionsClear = sanctionsClear && sanctionsLeaves[i] != senderId && sanctionsLeaves[i] != receiverId;
  }

  field expectedSenderCommitment = senderId * 1000003 + senderSalt * 9176 + kycRoot;
  field expectedReceiverCommitment = receiverId * 1000003 + receiverSalt * 9176 + sanctionsRoot;
  field expectedNullifier = senderId * 1000003 + nullifierSalt * 31 + kycRoot + sanctionsRoot;

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
