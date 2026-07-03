import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}




export type DataKey = {tag: "Admin", values: void} | {tag: "Issuer", values: readonly [string]} | {tag: "IssuerThreshold", values: void} | {tag: "Root", values: readonly [RootKind]} | {tag: "RootProposal", values: readonly [Buffer]} | {tag: "Corridor", values: readonly [string]} | {tag: "Nullifier", values: readonly [Buffer]} | {tag: "Intent", values: readonly [Buffer]};


export interface Corridor {
  active: boolean;
  asset: string;
  code: string;
  limit: i128;
  min_proof_tier: u32;
}

export type RootKind = {tag: "Kyc", values: void} | {tag: "Sanctions", values: void};


export interface RootRecord {
  epoch: u32;
  root: Buffer;
  updated_by: string;
}




export interface Groth16Proof {
  a: Buffer;
  b: Buffer;
  c: Buffer;
  inputs: Array<Buffer>;
}


export interface RootProposal {
  approvals: Array<string>;
  epoch: u32;
  executed: boolean;
  kind: RootKind;
  root: Buffer;
}


export interface PaymentIntent {
  amount: i128;
  corridor: string;
  destination: string;
  kyc_root: Buffer;
  proof_hash: Buffer;
  proof_inputs_hash: Buffer;
  proof_tier: u32;
  receiver_commitment: Buffer;
  sanctions_root: Buffer;
  sender_commitment: Buffer;
  settled: boolean;
  settlement_tx: Option<Buffer>;
}


export interface PaymentRequest {
  amount: i128;
  corridor: string;
  destination: string;
  intent_id: Buffer;
  nullifier: Buffer;
  proof_hash: Buffer;
  proof_inputs_hash: Buffer;
  proof_tier: u32;
  receiver_commitment: Buffer;
  sender_commitment: Buffer;
  zk_proof: Groth16Proof;
}



export interface CorridorSetData {
  active: boolean;
  code: string;
  limit: i128;
  min_proof_tier: u32;
}


export interface RootRotatedData {
  epoch: u32;
  issuer: string;
  kind: RootKind;
  root: Buffer;
}



export interface PaymentSettledData {
  intent_id: Buffer;
  settlement_tx: Buffer;
}


export interface PaymentAuthorizedData {
  amount: i128;
  corridor: string;
  intent_id: Buffer;
  proof_tier: u32;
}

export interface Client {
  /**
   * Construct and simulate a init transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  init: ({admin}: {admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_root transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_root: ({kind}: {kind: RootKind}, options?: MethodOptions) => Promise<AssembledTransaction<Option<RootRecord>>>

  /**
   * Construct and simulate a get_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_admin: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a is_issuer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  is_issuer: ({issuer}: {issuer: string}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a get_intent transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_intent: ({intent_id}: {intent_id: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Option<PaymentIntent>>>

  /**
   * Construct and simulate a set_issuer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_issuer: ({issuer, active}: {issuer: string, active: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a rotate_root transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  rotate_root: ({kind, root, epoch, issuer}: {kind: RootKind, root: Buffer, epoch: u32, issuer: string}, options?: MethodOptions) => Promise<AssembledTransaction<RootRecord>>

  /**
   * Construct and simulate a approve_root transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  approve_root: ({proposal_id, issuer}: {proposal_id: Buffer, issuer: string}, options?: MethodOptions) => Promise<AssembledTransaction<RootProposal>>

  /**
   * Construct and simulate a get_corridor transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_corridor: ({code}: {code: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<Corridor>>>

  /**
   * Construct and simulate a propose_root transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  propose_root: ({proposal_id, kind, root, epoch, issuer}: {proposal_id: Buffer, kind: RootKind, root: Buffer, epoch: u32, issuer: string}, options?: MethodOptions) => Promise<AssembledTransaction<RootProposal>>

  /**
   * Construct and simulate a set_corridor transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_corridor: ({code, asset, limit, min_proof_tier, active}: {code: string, asset: string, limit: i128, min_proof_tier: u32, active: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<Corridor>>

  /**
   * Construct and simulate a authorize_payment transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  authorize_payment: ({request}: {request: PaymentRequest}, options?: MethodOptions) => Promise<AssembledTransaction<PaymentIntent>>

  /**
   * Construct and simulate a get_root_proposal transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_root_proposal: ({proposal_id}: {proposal_id: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Option<RootProposal>>>

  /**
   * Construct and simulate a is_nullifier_used transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  is_nullifier_used: ({nullifier}: {nullifier: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a record_settlement transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  record_settlement: ({intent_id, settlement_tx}: {intent_id: Buffer, settlement_tx: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<PaymentIntent>>

  /**
   * Construct and simulate a get_issuer_threshold transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_issuer_threshold: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a set_issuer_threshold transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_issuer_threshold: ({threshold}: {threshold: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a authorize_and_transfer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  authorize_and_transfer: ({request, asset_contract, source}: {request: PaymentRequest, asset_contract: string, source: string}, options?: MethodOptions) => Promise<AssembledTransaction<PaymentIntent>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAACAAAAAAAAAAAAAAABUFkbWluAAAAAAAAAQAAAAAAAAAGSXNzdWVyAAAAAAABAAAAEwAAAAAAAAAAAAAAD0lzc3VlclRocmVzaG9sZAAAAAABAAAAAAAAAARSb290AAAAAQAAB9AAAAAIUm9vdEtpbmQAAAABAAAAAAAAAAxSb290UHJvcG9zYWwAAAABAAAD7gAAACAAAAABAAAAAAAAAAhDb3JyaWRvcgAAAAEAAAARAAAAAQAAAAAAAAAJTnVsbGlmaWVyAAAAAAAAAQAAA+4AAAAgAAAAAQAAAAAAAAAGSW50ZW50AAAAAAABAAAD7gAAACA=",
        "AAAAAQAAAAAAAAAAAAAACENvcnJpZG9yAAAABQAAAAAAAAAGYWN0aXZlAAAAAAABAAAAAAAAAAVhc3NldAAAAAAAABEAAAAAAAAABGNvZGUAAAARAAAAAAAAAAVsaW1pdAAAAAAAAAsAAAAAAAAADm1pbl9wcm9vZl90aWVyAAAAAAAE",
        "AAAAAgAAAAAAAAAAAAAACFJvb3RLaW5kAAAAAgAAAAAAAAAAAAAAA0t5YwAAAAAAAAAAAAAAAAlTYW5jdGlvbnMAAAA=",
        "AAAAAQAAAAAAAAAAAAAAClJvb3RSZWNvcmQAAAAAAAMAAAAAAAAABWVwb2NoAAAAAAAABAAAAAAAAAAEcm9vdAAAA+4AAAAgAAAAAAAAAAp1cGRhdGVkX2J5AAAAAAAT",
        "AAAABQAAAAAAAAAAAAAAC0NvcnJpZG9yU2V0AAAAAAIAAAAFcm91dGUAAAAAAAADc2V0AAAAAAEAAAAAAAAABGRhdGEAAAfQAAAAD0NvcnJpZG9yU2V0RGF0YQAAAAAAAAAAAA==",
        "AAAABQAAAAAAAAAAAAAAC1Jvb3RSb3RhdGVkAAAAAAIAAAAEcm9vdAAAAAZyb3RhdGUAAAAAAAEAAAAAAAAABGRhdGEAAAfQAAAAD1Jvb3RSb3RhdGVkRGF0YQAAAAAAAAAAAA==",
        "AAAAAQAAAAAAAAAAAAAADEdyb3RoMTZQcm9vZgAAAAQAAAAAAAAAAWEAAAAAAAPuAAAAQAAAAAAAAAABYgAAAAAAA+4AAACAAAAAAAAAAAFjAAAAAAAD7gAAAEAAAAAAAAAABmlucHV0cwAAAAAD6gAAA+4AAAAg",
        "AAAAAQAAAAAAAAAAAAAADFJvb3RQcm9wb3NhbAAAAAUAAAAAAAAACWFwcHJvdmFscwAAAAAAA+oAAAATAAAAAAAAAAVlcG9jaAAAAAAAAAQAAAAAAAAACGV4ZWN1dGVkAAAAAQAAAAAAAAAEa2luZAAAB9AAAAAIUm9vdEtpbmQAAAAAAAAABHJvb3QAAAPuAAAAIA==",
        "AAAAAQAAAAAAAAAAAAAADVBheW1lbnRJbnRlbnQAAAAAAAAMAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAACGNvcnJpZG9yAAAAEQAAAAAAAAALZGVzdGluYXRpb24AAAAAEwAAAAAAAAAIa3ljX3Jvb3QAAAPuAAAAIAAAAAAAAAAKcHJvb2ZfaGFzaAAAAAAD7gAAACAAAAAAAAAAEXByb29mX2lucHV0c19oYXNoAAAAAAAD7gAAACAAAAAAAAAACnByb29mX3RpZXIAAAAAAAQAAAAAAAAAE3JlY2VpdmVyX2NvbW1pdG1lbnQAAAAD7gAAACAAAAAAAAAADnNhbmN0aW9uc19yb290AAAAAAPuAAAAIAAAAAAAAAARc2VuZGVyX2NvbW1pdG1lbnQAAAAAAAPuAAAAIAAAAAAAAAAHc2V0dGxlZAAAAAABAAAAAAAAAA1zZXR0bGVtZW50X3R4AAAAAAAD6AAAA+4AAAAg",
        "AAAAAQAAAAAAAAAAAAAADlBheW1lbnRSZXF1ZXN0AAAAAAALAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAACGNvcnJpZG9yAAAAEQAAAAAAAAALZGVzdGluYXRpb24AAAAAEwAAAAAAAAAJaW50ZW50X2lkAAAAAAAD7gAAACAAAAAAAAAACW51bGxpZmllcgAAAAAAA+4AAAAgAAAAAAAAAApwcm9vZl9oYXNoAAAAAAPuAAAAIAAAAAAAAAARcHJvb2ZfaW5wdXRzX2hhc2gAAAAAAAPuAAAAIAAAAAAAAAAKcHJvb2ZfdGllcgAAAAAABAAAAAAAAAATcmVjZWl2ZXJfY29tbWl0bWVudAAAAAPuAAAAIAAAAAAAAAARc2VuZGVyX2NvbW1pdG1lbnQAAAAAAAPuAAAAIAAAAAAAAAAIemtfcHJvb2YAAAfQAAAADEdyb3RoMTZQcm9vZg==",
        "AAAAAAAAAAAAAAAEaW5pdAAAAAEAAAAAAAAABWFkbWluAAAAAAAAEwAAAAA=",
        "AAAABQAAAAAAAAAAAAAADlBheW1lbnRTZXR0bGVkAAAAAAACAAAAB3BheW1lbnQAAAAABnNldHRsZQAAAAAAAQAAAAAAAAAEZGF0YQAAB9AAAAASUGF5bWVudFNldHRsZWREYXRhAAAAAAAAAAAAAA==",
        "AAAAAQAAAAAAAAAAAAAAD0NvcnJpZG9yU2V0RGF0YQAAAAAEAAAAAAAAAAZhY3RpdmUAAAAAAAEAAAAAAAAABGNvZGUAAAARAAAAAAAAAAVsaW1pdAAAAAAAAAsAAAAAAAAADm1pbl9wcm9vZl90aWVyAAAAAAAE",
        "AAAAAQAAAAAAAAAAAAAAD1Jvb3RSb3RhdGVkRGF0YQAAAAAEAAAAAAAAAAVlcG9jaAAAAAAAAAQAAAAAAAAABmlzc3VlcgAAAAAAEwAAAAAAAAAEa2luZAAAB9AAAAAIUm9vdEtpbmQAAAAAAAAABHJvb3QAAAPuAAAAIA==",
        "AAAABQAAAAAAAAAAAAAAEVBheW1lbnRBdXRob3JpemVkAAAAAAAAAgAAAAdwYXltZW50AAAAAARhdXRoAAAAAQAAAAAAAAAEZGF0YQAAB9AAAAAVUGF5bWVudEF1dGhvcml6ZWREYXRhAAAAAAAAAAAAAAA=",
        "AAAAAQAAAAAAAAAAAAAAElBheW1lbnRTZXR0bGVkRGF0YQAAAAAAAgAAAAAAAAAJaW50ZW50X2lkAAAAAAAD7gAAACAAAAAAAAAADXNldHRsZW1lbnRfdHgAAAAAAAPuAAAAIA==",
        "AAAAAAAAAAAAAAAIZ2V0X3Jvb3QAAAABAAAAAAAAAARraW5kAAAH0AAAAAhSb290S2luZAAAAAEAAAPoAAAH0AAAAApSb290UmVjb3JkAAA=",
        "AAAAAAAAAAAAAAAJZ2V0X2FkbWluAAAAAAAAAAAAAAEAAAAT",
        "AAAAAAAAAAAAAAAJaXNfaXNzdWVyAAAAAAAAAQAAAAAAAAAGaXNzdWVyAAAAAAATAAAAAQAAAAE=",
        "AAAAAAAAAAAAAAAKZ2V0X2ludGVudAAAAAAAAQAAAAAAAAAJaW50ZW50X2lkAAAAAAAD7gAAACAAAAABAAAD6AAAB9AAAAANUGF5bWVudEludGVudAAAAA==",
        "AAAAAAAAAAAAAAAKc2V0X2lzc3VlcgAAAAAAAgAAAAAAAAAGaXNzdWVyAAAAAAATAAAAAAAAAAZhY3RpdmUAAAAAAAEAAAAA",
        "AAAAAQAAAAAAAAAAAAAAFVBheW1lbnRBdXRob3JpemVkRGF0YQAAAAAAAAQAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAIY29ycmlkb3IAAAARAAAAAAAAAAlpbnRlbnRfaWQAAAAAAAPuAAAAIAAAAAAAAAAKcHJvb2ZfdGllcgAAAAAABA==",
        "AAAAAAAAAAAAAAALcm90YXRlX3Jvb3QAAAAABAAAAAAAAAAEa2luZAAAB9AAAAAIUm9vdEtpbmQAAAAAAAAABHJvb3QAAAPuAAAAIAAAAAAAAAAFZXBvY2gAAAAAAAAEAAAAAAAAAAZpc3N1ZXIAAAAAABMAAAABAAAH0AAAAApSb290UmVjb3JkAAA=",
        "AAAAAAAAAAAAAAAMYXBwcm92ZV9yb290AAAAAgAAAAAAAAALcHJvcG9zYWxfaWQAAAAD7gAAACAAAAAAAAAABmlzc3VlcgAAAAAAEwAAAAEAAAfQAAAADFJvb3RQcm9wb3NhbA==",
        "AAAAAAAAAAAAAAAMZ2V0X2NvcnJpZG9yAAAAAQAAAAAAAAAEY29kZQAAABEAAAABAAAD6AAAB9AAAAAIQ29ycmlkb3I=",
        "AAAAAAAAAAAAAAAMcHJvcG9zZV9yb290AAAABQAAAAAAAAALcHJvcG9zYWxfaWQAAAAD7gAAACAAAAAAAAAABGtpbmQAAAfQAAAACFJvb3RLaW5kAAAAAAAAAARyb290AAAD7gAAACAAAAAAAAAABWVwb2NoAAAAAAAABAAAAAAAAAAGaXNzdWVyAAAAAAATAAAAAQAAB9AAAAAMUm9vdFByb3Bvc2Fs",
        "AAAAAAAAAAAAAAAMc2V0X2NvcnJpZG9yAAAABQAAAAAAAAAEY29kZQAAABEAAAAAAAAABWFzc2V0AAAAAAAAEQAAAAAAAAAFbGltaXQAAAAAAAALAAAAAAAAAA5taW5fcHJvb2ZfdGllcgAAAAAABAAAAAAAAAAGYWN0aXZlAAAAAAABAAAAAQAAB9AAAAAIQ29ycmlkb3I=",
        "AAAAAAAAAAAAAAARYXV0aG9yaXplX3BheW1lbnQAAAAAAAABAAAAAAAAAAdyZXF1ZXN0AAAAB9AAAAAOUGF5bWVudFJlcXVlc3QAAAAAAAEAAAfQAAAADVBheW1lbnRJbnRlbnQAAAA=",
        "AAAAAAAAAAAAAAARZ2V0X3Jvb3RfcHJvcG9zYWwAAAAAAAABAAAAAAAAAAtwcm9wb3NhbF9pZAAAAAPuAAAAIAAAAAEAAAPoAAAH0AAAAAxSb290UHJvcG9zYWw=",
        "AAAAAAAAAAAAAAARaXNfbnVsbGlmaWVyX3VzZWQAAAAAAAABAAAAAAAAAAludWxsaWZpZXIAAAAAAAPuAAAAIAAAAAEAAAAB",
        "AAAAAAAAAAAAAAARcmVjb3JkX3NldHRsZW1lbnQAAAAAAAACAAAAAAAAAAlpbnRlbnRfaWQAAAAAAAPuAAAAIAAAAAAAAAANc2V0dGxlbWVudF90eAAAAAAAA+4AAAAgAAAAAQAAB9AAAAANUGF5bWVudEludGVudAAAAA==",
        "AAAAAAAAAAAAAAAUZ2V0X2lzc3Vlcl90aHJlc2hvbGQAAAAAAAAAAQAAAAQ=",
        "AAAAAAAAAAAAAAAUc2V0X2lzc3Vlcl90aHJlc2hvbGQAAAABAAAAAAAAAAl0aHJlc2hvbGQAAAAAAAAEAAAAAA==",
        "AAAAAAAAAAAAAAAWYXV0aG9yaXplX2FuZF90cmFuc2ZlcgAAAAAAAwAAAAAAAAAHcmVxdWVzdAAAAAfQAAAADlBheW1lbnRSZXF1ZXN0AAAAAAAAAAAADmFzc2V0X2NvbnRyYWN0AAAAAAATAAAAAAAAAAZzb3VyY2UAAAAAABMAAAABAAAH0AAAAA1QYXltZW50SW50ZW50AAAA" ]),
      options
    )
  }
  public readonly fromJSON = {
    init: this.txFromJSON<null>,
        get_root: this.txFromJSON<Option<RootRecord>>,
        get_admin: this.txFromJSON<string>,
        is_issuer: this.txFromJSON<boolean>,
        get_intent: this.txFromJSON<Option<PaymentIntent>>,
        set_issuer: this.txFromJSON<null>,
        rotate_root: this.txFromJSON<RootRecord>,
        approve_root: this.txFromJSON<RootProposal>,
        get_corridor: this.txFromJSON<Option<Corridor>>,
        propose_root: this.txFromJSON<RootProposal>,
        set_corridor: this.txFromJSON<Corridor>,
        authorize_payment: this.txFromJSON<PaymentIntent>,
        get_root_proposal: this.txFromJSON<Option<RootProposal>>,
        is_nullifier_used: this.txFromJSON<boolean>,
        record_settlement: this.txFromJSON<PaymentIntent>,
        get_issuer_threshold: this.txFromJSON<u32>,
        set_issuer_threshold: this.txFromJSON<null>,
        authorize_and_transfer: this.txFromJSON<PaymentIntent>
  }
}