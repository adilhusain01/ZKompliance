#![no_std]

use soroban_sdk::{
    contract, contractevent, contractimpl, contracttype, token, Address, BytesN, Env, Symbol, Vec,
};

mod verifier;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RootKind {
    Kyc,
    Sanctions,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RootRecord {
    pub root: BytesN<32>,
    pub epoch: u32,
    pub updated_by: Address,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Corridor {
    pub code: Symbol,
    pub asset: Symbol,
    pub limit: i128,
    pub min_proof_tier: u32,
    pub active: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PaymentIntent {
    pub corridor: Symbol,
    pub sender_commitment: BytesN<32>,
    pub receiver_commitment: BytesN<32>,
    pub destination: Address,
    pub amount: i128,
    pub proof_hash: BytesN<32>,
    pub proof_inputs_hash: BytesN<32>,
    pub proof_tier: u32,
    pub kyc_root: BytesN<32>,
    pub sanctions_root: BytesN<32>,
    pub settled: bool,
    pub settlement_tx: Option<BytesN<32>>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PaymentRequest {
    pub intent_id: BytesN<32>,
    pub nullifier: BytesN<32>,
    pub corridor: Symbol,
    pub sender_commitment: BytesN<32>,
    pub receiver_commitment: BytesN<32>,
    pub destination: Address,
    pub amount: i128,
    pub proof_hash: BytesN<32>,
    pub proof_inputs_hash: BytesN<32>,
    pub proof_tier: u32,
    pub zk_proof: Groth16Proof,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Groth16Proof {
    pub a: BytesN<64>,
    pub b: BytesN<128>,
    pub c: BytesN<64>,
    pub inputs: Vec<BytesN<32>>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RootProposal {
    pub kind: RootKind,
    pub root: BytesN<32>,
    pub epoch: u32,
    pub approvals: Vec<Address>,
    pub executed: bool,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Issuer(Address),
    IssuerThreshold,
    Root(RootKind),
    RootProposal(BytesN<32>),
    Corridor(Symbol),
    Nullifier(BytesN<32>),
    Intent(BytesN<32>),
}

#[contractevent(topics = ["root", "rotate"], data_format = "single-value")]
pub struct RootRotated {
    pub data: RootRotatedData,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RootRotatedData {
    pub kind: RootKind,
    pub root: BytesN<32>,
    pub epoch: u32,
    pub issuer: Address,
}

#[contractevent(topics = ["route", "set"], data_format = "single-value")]
pub struct CorridorSet {
    pub data: CorridorSetData,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CorridorSetData {
    pub code: Symbol,
    pub limit: i128,
    pub min_proof_tier: u32,
    pub active: bool,
}

#[contractevent(topics = ["payment", "auth"], data_format = "single-value")]
pub struct PaymentAuthorized {
    pub data: PaymentAuthorizedData,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PaymentAuthorizedData {
    pub intent_id: BytesN<32>,
    pub corridor: Symbol,
    pub amount: i128,
    pub proof_tier: u32,
}

#[contractevent(topics = ["payment", "settle"], data_format = "single-value")]
pub struct PaymentSettled {
    pub data: PaymentSettledData,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PaymentSettledData {
    pub intent_id: BytesN<32>,
    pub settlement_tx: BytesN<32>,
}

#[contract]
pub struct ComplianceGateway;

#[contractimpl]
impl ComplianceGateway {
    pub fn init(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn rotate_root(
        env: Env,
        kind: RootKind,
        root: BytesN<32>,
        epoch: u32,
        issuer: Address,
    ) -> RootRecord {
        require_admin(&env);
        let record = RootRecord {
            root: root.clone(),
            epoch,
            updated_by: issuer.clone(),
        };
        env.storage()
            .persistent()
            .set(&DataKey::Root(kind.clone()), &record);
        RootRotated { data: RootRotatedData {
            kind,
            root,
            epoch,
            issuer,
        }}
        .publish(&env);
        record
    }

    pub fn set_issuer(env: Env, issuer: Address, active: bool) {
        require_admin(&env);
        env.storage()
            .persistent()
            .set(&DataKey::Issuer(issuer.clone()), &active);
    }

    pub fn set_issuer_threshold(env: Env, threshold: u32) {
        require_admin(&env);
        if threshold == 0 {
            panic!("threshold must be positive");
        }
        env.storage()
            .persistent()
            .set(&DataKey::IssuerThreshold, &threshold);
    }

    pub fn propose_root(
        env: Env,
        proposal_id: BytesN<32>,
        kind: RootKind,
        root: BytesN<32>,
        epoch: u32,
        issuer: Address,
    ) -> RootProposal {
        require_issuer(&env, &issuer);
        let key = DataKey::RootProposal(proposal_id);
        if env.storage().persistent().has(&key) {
            panic!("proposal already exists");
        }

        let mut approvals = Vec::new(&env);
        approvals.push_back(issuer);
        let mut proposal = RootProposal {
            kind,
            root,
            epoch,
            approvals,
            executed: false,
        };

        if approval_count(&proposal) >= issuer_threshold(&env) {
            execute_root_proposal(&env, &mut proposal);
        }
        env.storage().persistent().set(&key, &proposal);
        proposal
    }

    pub fn approve_root(env: Env, proposal_id: BytesN<32>, issuer: Address) -> RootProposal {
        require_issuer(&env, &issuer);
        let key = DataKey::RootProposal(proposal_id);
        let mut proposal: RootProposal = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic!("proposal not found"));
        if proposal.executed {
            panic!("proposal already executed");
        }
        if has_approval(&proposal, &issuer) {
            panic!("issuer already approved");
        }

        proposal.approvals.push_back(issuer);
        if approval_count(&proposal) >= issuer_threshold(&env) {
            execute_root_proposal(&env, &mut proposal);
        }
        env.storage().persistent().set(&key, &proposal);
        proposal
    }

    pub fn set_corridor(
        env: Env,
        code: Symbol,
        asset: Symbol,
        limit: i128,
        min_proof_tier: u32,
        active: bool,
    ) -> Corridor {
        require_admin(&env);
        if limit <= 0 {
            panic!("limit must be positive");
        }

        let corridor = Corridor {
            code: code.clone(),
            asset,
            limit,
            min_proof_tier,
            active,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Corridor(code.clone()), &corridor);
        CorridorSet { data: CorridorSetData {
            code,
            limit,
            min_proof_tier,
            active,
        }}
        .publish(&env);
        corridor
    }

    pub fn authorize_payment(env: Env, request: PaymentRequest) -> PaymentIntent {
        authorize_request(&env, request)
    }

    pub fn authorize_and_transfer(
        env: Env,
        request: PaymentRequest,
        asset_contract: Address,
        source: Address,
    ) -> PaymentIntent {
        source.require_auth();
        let mut intent = authorize_request(&env, request.clone());
        let token = token::Client::new(&env, &asset_contract);
        token.transfer(&source, &request.destination, &request.amount);

        intent.settled = true;
        intent.settlement_tx = Some(request.intent_id.clone());
        env.storage()
            .persistent()
            .set(&DataKey::Intent(request.intent_id.clone()), &intent);
        PaymentSettled { data: PaymentSettledData {
            intent_id: request.intent_id,
            settlement_tx: intent.settlement_tx.clone().unwrap(),
        }}
        .publish(&env);
        intent
    }

    pub fn record_settlement(env: Env, intent_id: BytesN<32>, settlement_tx: BytesN<32>) -> PaymentIntent {
        require_admin(&env);
        let key = DataKey::Intent(intent_id.clone());
        let mut intent: PaymentIntent = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic!("intent not found"));
        if intent.settled {
            panic!("intent already settled");
        }
        intent.settled = true;
        intent.settlement_tx = Some(settlement_tx.clone());
        env.storage().persistent().set(&key, &intent);
        PaymentSettled { data: PaymentSettledData {
            intent_id,
            settlement_tx,
        }}
        .publish(&env);
        intent
    }

    pub fn get_admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic!("not initialized"))
    }

    pub fn get_root(env: Env, kind: RootKind) -> Option<RootRecord> {
        env.storage().persistent().get(&DataKey::Root(kind))
    }

    pub fn get_corridor(env: Env, code: Symbol) -> Option<Corridor> {
        env.storage().persistent().get(&DataKey::Corridor(code))
    }

    pub fn get_intent(env: Env, intent_id: BytesN<32>) -> Option<PaymentIntent> {
        env.storage().persistent().get(&DataKey::Intent(intent_id))
    }

    pub fn is_nullifier_used(env: Env, nullifier: BytesN<32>) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::Nullifier(nullifier))
    }
}

fn authorize_request(env: &Env, request: PaymentRequest) -> PaymentIntent {
        let corridor = get_corridor_or_panic(&env, request.corridor.clone());
        if !corridor.active {
            panic!("corridor inactive");
        }
        if request.amount <= 0 || request.amount > corridor.limit {
            panic!("amount outside corridor limit");
        }
        if request.proof_tier < corridor.min_proof_tier {
            panic!("proof tier too low");
        }

        let nullifier_key = DataKey::Nullifier(request.nullifier.clone());
        if env.storage().persistent().has(&nullifier_key) {
            panic!("nullifier already used");
        }
        let intent_key = DataKey::Intent(request.intent_id.clone());
        if env.storage().persistent().has(&intent_key) {
            panic!("intent already exists");
        }

        let kyc_root = get_root_or_panic(&env, RootKind::Kyc).root;
        let sanctions_root = get_root_or_panic(&env, RootKind::Sanctions).root;
        verify_request_proof(env, &request, &corridor, &kyc_root, &sanctions_root);

        let intent = PaymentIntent {
            corridor: request.corridor,
            sender_commitment: request.sender_commitment,
            receiver_commitment: request.receiver_commitment,
            destination: request.destination,
            amount: request.amount,
            proof_hash: request.proof_hash,
            proof_inputs_hash: request.proof_inputs_hash,
            proof_tier: request.proof_tier,
            kyc_root,
            sanctions_root,
            settled: false,
            settlement_tx: None,
        };

        env.storage().persistent().set(&nullifier_key, &true);
        env.storage().persistent().set(&intent_key, &intent);
        PaymentAuthorized { data: PaymentAuthorizedData {
            intent_id: request.intent_id,
            corridor: intent.corridor.clone(),
            amount: intent.amount,
            proof_tier: intent.proof_tier,
        }}
        .publish(env);
        intent
}

fn require_admin(env: &Env) -> Address {
    let admin: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .unwrap_or_else(|| panic!("not initialized"));
    admin.require_auth();
    admin
}

fn require_issuer(env: &Env, issuer: &Address) {
    issuer.require_auth();
    let active: bool = env
        .storage()
        .persistent()
        .get(&DataKey::Issuer(issuer.clone()))
        .unwrap_or(false);
    if !active {
        panic!("issuer not active");
    }
}

fn issuer_threshold(env: &Env) -> u32 {
    env.storage()
        .persistent()
        .get(&DataKey::IssuerThreshold)
        .unwrap_or(1)
}

fn approval_count(proposal: &RootProposal) -> u32 {
    proposal.approvals.len()
}

fn has_approval(proposal: &RootProposal, issuer: &Address) -> bool {
    for approval in proposal.approvals.iter() {
        if approval == *issuer {
            return true;
        }
    }
    false
}

fn execute_root_proposal(env: &Env, proposal: &mut RootProposal) {
    let updater = proposal
        .approvals
        .first()
        .unwrap_or_else(|| panic!("proposal has no approvals"));
    let record = RootRecord {
        root: proposal.root.clone(),
        epoch: proposal.epoch,
        updated_by: updater,
    };
    env.storage()
        .persistent()
        .set(&DataKey::Root(proposal.kind.clone()), &record);
    RootRotated { data: RootRotatedData {
        kind: proposal.kind.clone(),
        root: proposal.root.clone(),
        epoch: proposal.epoch,
        issuer: record.updated_by,
    }}
    .publish(env);
    proposal.executed = true;
}

fn get_root_or_panic(env: &Env, kind: RootKind) -> RootRecord {
    env.storage()
        .persistent()
        .get(&DataKey::Root(kind))
        .unwrap_or_else(|| panic!("root not configured"))
}

fn get_corridor_or_panic(env: &Env, code: Symbol) -> Corridor {
    env.storage()
        .persistent()
        .get(&DataKey::Corridor(code))
        .unwrap_or_else(|| panic!("corridor not configured"))
}

fn verify_request_proof(
    env: &Env,
    request: &PaymentRequest,
    corridor: &Corridor,
    kyc_root: &BytesN<32>,
    sanctions_root: &BytesN<32>,
) {
    if request.zk_proof.inputs.len() != verifier::PUBLIC_INPUT_COUNT {
        panic!("invalid proof inputs");
    }
    assert_input(&request.zk_proof, 0, kyc_root);
    assert_input(&request.zk_proof, 1, sanctions_root);
    assert_input(&request.zk_proof, 2, &request.sender_commitment);
    assert_input(&request.zk_proof, 3, &request.receiver_commitment);
    assert_input(&request.zk_proof, 4, &request.nullifier);
    assert_input(&request.zk_proof, 5, &i128_to_field_bytes(env, request.amount));
    assert_input(&request.zk_proof, 6, &i128_to_field_bytes(env, corridor.limit));
    assert_input(&request.zk_proof, 7, &u32_to_field_bytes(env, 1));

    if !verifier::verify_compliance_proof(env, &request.zk_proof) {
        panic!("proof verification failed");
    }
}

fn assert_input(proof: &Groth16Proof, index: u32, expected: &BytesN<32>) {
    let actual = proof.inputs.get(index).unwrap();
    if actual != *expected {
        panic!("proof input mismatch");
    }
}

fn i128_to_field_bytes(env: &Env, value: i128) -> BytesN<32> {
    if value < 0 {
        panic!("negative field value");
    }
    let mut bytes = [0u8; 32];
    let value_bytes = value.to_be_bytes();
    bytes[16..].copy_from_slice(&value_bytes);
    BytesN::from_array(env, &bytes)
}

fn u32_to_field_bytes(env: &Env, value: u32) -> BytesN<32> {
    let mut bytes = [0u8; 32];
    bytes[28..].copy_from_slice(&value.to_be_bytes());
    BytesN::from_array(env, &bytes)
}

#[cfg(test)]
mod proof_fixture;

mod test;
