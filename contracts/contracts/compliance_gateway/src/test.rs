#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{symbol_short, token, Address, BytesN, Env};

fn hash(env: &Env, seed: u8) -> BytesN<32> {
    BytesN::from_array(env, &[seed; 32])
}

fn client(env: &Env) -> (Address, ComplianceGatewayClient<'_>) {
    env.mock_all_auths();
    let admin = Address::generate(env);
    let contract_id = env.register(ComplianceGateway, ());
    let client = ComplianceGatewayClient::new(env, &contract_id);
    client.init(&admin);
    (admin, client)
}

fn configure_gateway(env: &Env, client: &ComplianceGatewayClient<'_>, admin: &Address) {
    client.rotate_root(&RootKind::Kyc, &hash(env, 11), &1, admin);
    client.rotate_root(&RootKind::Sanctions, &hash(env, 12), &1, admin);
    client.set_corridor(
        &symbol_short!("USDCMXN"),
        &symbol_short!("USDC"),
        &500_0000000,
        &2,
        &true,
    );
}

fn payment_request(env: &Env, destination: Address) -> PaymentRequest {
    PaymentRequest {
        intent_id: hash(env, 1),
        nullifier: hash(env, 2),
        corridor: symbol_short!("USDCMXN"),
        sender_commitment: hash(env, 3),
        receiver_commitment: hash(env, 4),
        destination,
        amount: 125_0000000,
        proof_hash: hash(env, 5),
        proof_inputs_hash: hash(env, 6),
        proof_tier: 2,
    }
}

#[test]
fn authorizes_payment_and_records_settlement() {
    let env = Env::default();
    let (admin, client) = client(&env);
    configure_gateway(&env, &client, &admin);

    let request = payment_request(&env, Address::generate(&env));
    let intent = client.authorize_payment(&request);

    assert_eq!(intent.amount, request.amount);
    assert_eq!(intent.kyc_root, hash(&env, 11));
    assert_eq!(intent.sanctions_root, hash(&env, 12));
    assert!(!intent.settled);
    assert!(client.is_nullifier_used(&request.nullifier));

    let settled = client.record_settlement(&request.intent_id, &hash(&env, 9));
    assert!(settled.settled);
    assert_eq!(settled.settlement_tx, Some(hash(&env, 9)));
}

#[test]
fn authorizes_and_transfers_token_atomically() {
    let env = Env::default();
    let (admin, client) = client(&env);
    configure_gateway(&env, &client, &admin);

    let source = Address::generate(&env);
    let destination = Address::generate(&env);
    let asset = env.register_stellar_asset_contract_v2(admin);
    let token_admin = token::StellarAssetClient::new(&env, &asset.address());
    let token_client = token::Client::new(&env, &asset.address());
    token_admin.mint(&source, &1_000_0000000);

    let request = payment_request(&env, destination.clone());
    let intent = client.authorize_and_transfer(&request, &asset.address(), &source);

    assert!(intent.settled);
    assert_eq!(token_client.balance(&source), 875_0000000);
    assert_eq!(token_client.balance(&destination), request.amount);
    assert!(client.is_nullifier_used(&request.nullifier));
}

#[test]
#[should_panic]
fn rejects_replayed_nullifier() {
    let env = Env::default();
    let (admin, client) = client(&env);
    configure_gateway(&env, &client, &admin);

    let mut second = payment_request(&env, Address::generate(&env));
    client.authorize_payment(&second);
    second.intent_id = hash(&env, 8);
    client.authorize_payment(&second);
}

#[test]
#[should_panic]
fn rejects_low_tier_proofs() {
    let env = Env::default();
    let (admin, client) = client(&env);
    configure_gateway(&env, &client, &admin);

    let mut request = payment_request(&env, Address::generate(&env));
    request.proof_tier = 1;
    client.authorize_payment(&request);
}

#[test]
#[should_panic]
fn rejects_over_limit_amounts() {
    let env = Env::default();
    let (admin, client) = client(&env);
    configure_gateway(&env, &client, &admin);

    let mut request = payment_request(&env, Address::generate(&env));
    request.amount = 501_0000000;
    client.authorize_payment(&request);
}

#[test]
fn rotates_roots_after_issuer_quorum() {
    let env = Env::default();
    let (_, client) = client(&env);
    let issuer_a = Address::generate(&env);
    let issuer_b = Address::generate(&env);
    let proposal_id = hash(&env, 88);

    client.set_issuer(&issuer_a, &true);
    client.set_issuer(&issuer_b, &true);
    client.set_issuer_threshold(&2);

    let pending = client.propose_root(
        &proposal_id,
        &RootKind::Kyc,
        &hash(&env, 21),
        &9,
        &issuer_a,
    );
    assert!(!pending.executed);
    assert!(client.get_root(&RootKind::Kyc).is_none());

    let executed = client.approve_root(&proposal_id, &issuer_b);
    assert!(executed.executed);

    let root = client.get_root(&RootKind::Kyc).unwrap();
    assert_eq!(root.root, hash(&env, 21));
    assert_eq!(root.epoch, 9);
}
