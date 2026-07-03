"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { signTransaction as freighterSignTransaction } from "@stellar/freighter-api";
import {
  ArrowRight,
  BadgeCheck,
  Ban,
  CheckCircle2,
  CircleDollarSign,
  Database,
  Fingerprint,
  Gauge,
  ExternalLink,
  KeyRound,
  Landmark,
  Loader2,
  Network,
  Play,
  RefreshCcw,
  RotateCw,
  Route,
  Send,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  authorizePayment,
  corridors,
  proofTiers,
  selectCorridor,
  selectProofTier,
  type CorridorCode,
} from "@/lib/compliance/protocol";
import { useComplianceStore } from "@/lib/compliance/store";
import {
  buildGatewayAuthorization,
  buildGatewayAtomicTransfer,
  buildRootRotation,
  bufferToHex,
  connectFreighterWallet,
  readGatewayIntent,
  readGatewaySnapshot,
  readNullifierStatus,
  STELLAR_TESTNET,
} from "@/lib/stellar/gateway";

const gatewayContractId =
  process.env.NEXT_PUBLIC_COMPLIANCE_GATEWAY_CONTRACT_ID ?? "";
const nativeSacContractId = process.env.NEXT_PUBLIC_STELLAR_NATIVE_SAC_ID ?? "";

export function ComplianceConsole() {
  const input = useComplianceStore();
  const [walletAddress, setWalletAddress] = useState<string>();
  const [settlementMode, setSettlementMode] = useState<"authorize" | "transfer">(
    "authorize",
  );
  const [rotationKind, setRotationKind] = useState<"Kyc" | "Sanctions">("Kyc");
  const [rotationRoot, setRotationRoot] = useState("");
  const [rotationEpoch, setRotationEpoch] = useState(119);
  const corridor = selectCorridor(input.corridor);
  const selectedTier = selectProofTier(input);
  const limitUsed = Math.min(100, Math.round((input.amount / corridor.limit) * 100));
  const activeTier = proofTiers.find((tier) => tier.id === selectedTier) ?? proofTiers[1];

  const mutation = useMutation({
    mutationFn: authorizePayment,
  });
  const connectMutation = useMutation({
    mutationFn: connectFreighterWallet,
    onSuccess: (address) => {
      setWalletAddress(address);
      if (input.destination === "demo-recipient") {
        input.setDestination(address);
      }
    },
  });
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!gatewayContractId) {
        throw new Error("Set NEXT_PUBLIC_COMPLIANCE_GATEWAY_CONTRACT_ID first.");
      }
      if (!walletAddress) {
        throw new Error("Connect Freighter before submitting.");
      }
      if (!authorization) {
        throw new Error("Generate a verified authorization first.");
      }

      const destination =
        input.destination === "demo-recipient" ? walletAddress : input.destination;
      const assembled =
        settlementMode === "transfer"
          ? await buildGatewayAtomicTransfer({
              contractId: gatewayContractId,
              source: walletAddress,
              destination,
              assetContract: nativeSacContractId,
              authorization,
            })
          : await buildGatewayAuthorization({
              contractId: gatewayContractId,
              source: walletAddress,
              destination,
              authorization,
            });
      const sent = await assembled.signAndSend({
        signTransaction: signWithConnectedFreighter,
      });

      return {
        hash: sent.sendTransactionResponse?.hash,
        status:
          sent.getTransactionResponse?.status ??
          sent.sendTransactionResponse?.status ??
          "submitted",
      };
    },
  });

  const authorization = mutation.data;
  const liveCorridorCode = corridor.code.replace("-", "");
  const gatewayQuery = useQuery({
    queryKey: ["gateway-snapshot", gatewayContractId, liveCorridorCode],
    queryFn: () =>
      readGatewaySnapshot({
        contractId: gatewayContractId,
        corridorCode: liveCorridorCode,
      }),
    enabled: Boolean(gatewayContractId),
    refetchInterval: 30_000,
  });
  const nullifierQuery = useQuery({
    queryKey: [
      "gateway-nullifier",
      gatewayContractId,
      authorization?.proof.nullifier,
    ],
    queryFn: () =>
      readNullifierStatus({
        contractId: gatewayContractId,
        nullifier: authorization?.proof.nullifier,
      }),
    enabled: Boolean(gatewayContractId && authorization?.proof.nullifier),
  });
  const intentQuery = useQuery({
    queryKey: ["gateway-intent", gatewayContractId, authorization?.proof.intentId],
    queryFn: () =>
      readGatewayIntent({
        contractId: gatewayContractId,
        intentId: authorization?.proof.intentId,
      }),
    enabled: Boolean(gatewayContractId && authorization?.proof.intentId),
  });
  const rotateRootMutation = useMutation({
    mutationFn: async () => {
      if (!gatewayContractId) {
        throw new Error("Set NEXT_PUBLIC_COMPLIANCE_GATEWAY_CONTRACT_ID first.");
      }
      if (!walletAddress) {
        throw new Error("Connect Freighter before rotating roots.");
      }
      const assembled = await buildRootRotation({
        contractId: gatewayContractId,
        source: walletAddress,
        kind: rotationKind,
        root: rotationRoot,
        epoch: rotationEpoch,
      });
      const sent = await assembled.signAndSend({
        signTransaction: signWithConnectedFreighter,
      });
      await gatewayQuery.refetch();
      return {
        hash: sent.sendTransactionResponse?.hash,
        status:
          sent.getTransactionResponse?.status ??
          sent.sendTransactionResponse?.status ??
          "submitted",
      };
    },
  });
  const snapshot = gatewayQuery.data;
  const isOperator =
    Boolean(walletAddress && snapshot?.admin) && walletAddress === snapshot?.admin;
  const liveKycEpoch = snapshot?.kycRoot?.epoch ?? 42;
  const liveSanctionsEpoch = snapshot?.sanctionsRoot?.epoch ?? 118;
  const routeSegments = useMemo(
    () => [
      {
        label: "Sender agent",
        detail: input.sender,
        icon: Fingerprint,
      },
      {
        label: "Compliance gateway",
        detail: "Soroban contract",
        icon: ShieldCheck,
      },
      {
        label: corridor.anchor,
        detail: corridor.settlement,
        icon: Landmark,
      },
    ],
    [corridor.anchor, corridor.settlement, input.sender],
  );

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#f6f0dd_0%,#eef7f4_42%,#f9f7ef_100%)] text-foreground">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-black/15 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center border border-black bg-black text-white shadow-[4px_4px_0_#eab308]">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase leading-none tracking-normal sm:text-3xl">
                ZK Compliance Gateway
              </h1>
              <p className="mt-1 max-w-2xl text-sm font-medium text-muted-foreground">
                Autonomous corridor routing, private compliance proofs, and Stellar settlement intents.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs font-bold sm:flex">
            <StatusPill icon={Database} label="KYC root" value={`epoch ${liveKycEpoch}`} />
            <StatusPill icon={Ban} label="Sanctions root" value={`epoch ${liveSanctionsEpoch}`} />
            <StatusPill icon={Network} label="Network" value="testnet" />
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)_360px] xl:items-start">
          <Card className="rounded-lg border-black/20 bg-card/95 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base uppercase">
                <Route className="size-4" />
                Payment intent
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label>Corridor</Label>
                <Select
                  value={input.corridor}
                  onValueChange={(value) => input.setCorridor(value as CorridorCode)}
                >
                  <SelectTrigger className="h-11 rounded-md border-black/20 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {corridors.map((item) => (
                      <SelectItem key={item.code} value={item.code}>
                        {item.code} / {item.anchor}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <Label>Amount</Label>
                  <span className="font-mono text-sm font-bold">
                    {input.amount.toLocaleString()} {corridor.asset}
                  </span>
                </div>
                <Slider
                  value={[input.amount]}
                  min={25}
                  max={corridor.limit}
                  step={25}
                  onValueChange={(value) => {
                    const amount = Array.isArray(value) ? value[0] : value;
                    input.setAmount(amount ?? input.amount);
                  }}
                />
                <Progress value={limitUsed} className="h-2" />
                <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
                  <span>0</span>
                  <span>limit {corridor.limit.toLocaleString()}</span>
                </div>
              </div>

              <div className="grid gap-3">
                <Field label="Sender private id">
                  <Input
                    value={input.sender}
                    onChange={(event) => input.setSender(event.target.value)}
                    className="h-11 rounded-md border-black/20 bg-white font-mono text-sm"
                  />
                </Field>
                <Field label="Receiver private id">
                  <Input
                    value={input.receiver}
                    onChange={(event) => input.setReceiver(event.target.value)}
                    className="h-11 rounded-md border-black/20 bg-white font-mono text-sm"
                  />
                </Field>
                <Field label="Destination account">
                  <Input
                    value={input.destination}
                    onChange={(event) => input.setDestination(event.target.value)}
                    className="h-11 rounded-md border-black/20 bg-white font-mono text-sm"
                  />
                </Field>
              </div>

              <Button
                className="h-12 rounded-md bg-black text-white hover:bg-black/85"
                disabled={mutation.isPending}
                onClick={() =>
                  mutation.mutate({
                    corridor: input.corridor,
                    amount: input.amount,
                    sender: input.sender,
                    receiver: input.receiver,
                    destination: input.destination,
                  })
                }
              >
                {mutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Play className="size-4" />
                )}
                Generate proof and authorize
              </Button>
            </CardContent>
          </Card>

          <section className="grid gap-4">
            <Card className="overflow-hidden rounded-lg border-black/20 bg-[#10120f] text-white shadow-none">
              <CardContent className="p-0">
                <div className="relative min-h-[420px] p-5 sm:p-6">
                  <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:34px_34px]" />
                  <div className="relative flex flex-col gap-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <Badge className="rounded-md border-white/20 bg-[#eab308] text-black hover:bg-[#eab308]">
                          Autonomous hot path
                        </Badge>
                        <h2 className="mt-3 max-w-2xl text-4xl font-black uppercase leading-[0.95] tracking-normal sm:text-5xl">
                          Proof verifies before value moves.
                        </h2>
                      </div>
                      <Tooltip>
                        <TooltipTrigger className="grid size-12 place-items-center border border-white/20 bg-white/10">
                          <KeyRound className="size-5" />
                        </TooltipTrigger>
                        <TooltipContent>Nullifier prevents replay inside the active window.</TooltipContent>
                      </Tooltip>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-3">
                      {routeSegments.map((segment, index) => (
                        <div
                          key={segment.label}
                          className="min-h-36 border border-white/15 bg-white/[0.06] p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <segment.icon className="size-5 text-[#eab308]" />
                            <span className="font-mono text-xs text-white/45">
                              0{index + 1}
                            </span>
                          </div>
                          <p className="mt-7 text-lg font-black uppercase">
                            {segment.label}
                          </p>
                          <p className="mt-1 line-clamp-2 text-sm font-medium text-white/58">
                            {segment.detail}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="relative overflow-hidden border border-white/15 bg-black/30 p-4">
                      <div className="proof-scan absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-transparent via-[#2dd4bf]/35 to-transparent" />
                      <div className="relative grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
                        <ProofNode label="KYC membership" icon={BadgeCheck} active />
                        <ArrowRight className="hidden size-5 text-white/40 sm:block" />
                        <ProofNode label="Sanctions non-membership" icon={Ban} active />
                        <ArrowRight className="hidden size-5 text-white/40 sm:block" />
                        <ProofNode label="Amount range" icon={Gauge} active />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-3">
              {proofTiers.map((tier) => (
                <Card
                  key={tier.id}
                  className={`rounded-lg border-black/20 shadow-none ${
                    tier.id === selectedTier ? "bg-[#fff4bf]" : "bg-card/90"
                  }`}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between gap-3 text-sm uppercase">
                      {tier.name}
                      {tier.id === selectedTier ? (
                        <Badge className="rounded-md bg-black text-white">selected</Badge>
                      ) : null}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 text-sm text-muted-foreground">
                    <p>{tier.description}</p>
                    <div className="flex items-center justify-between font-mono text-xs">
                      <span>{tier.cost}</span>
                      <span>{tier.latency}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <Card className="rounded-lg border-black/20 bg-card/95 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base uppercase">
                <Database className="size-4" />
                Gateway state
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <StateRow label="Asset pair" value={`${corridor.asset} to ${corridor.localAsset}`} />
              <StateRow label="Anchor route" value={corridor.anchor} />
              <StateRow label="Fee estimate" value={`${corridor.feeBps} bps`} />
              <StateRow label="Required tier" value={`Tier ${corridor.minTier}`} />
              <Separator />
              <StateRow label="Selected tier" value={`Tier ${activeTier.id}: ${activeTier.name}`} />
              <StateRow label="Settlement op" value={formatSettlement(corridor.settlement)} />
              <StateRow
                label="Contract call"
                value={
                  settlementMode === "transfer"
                    ? "authorize_and_transfer"
                    : "authorize_payment"
                }
              />
              <StateRow
                label="Contract"
                value={gatewayContractId ? shortKey(gatewayContractId) : "not configured"}
              />
              <StateRow
                label="Wallet"
                value={walletAddress ? shortKey(walletAddress) : "not connected"}
              />
              <StateRow
                label="SAC asset"
                value={
                  settlementMode === "transfer"
                    ? nativeSacContractId
                      ? `native ${shortKey(nativeSacContractId)}`
                      : "not configured"
                    : "not used"
                }
              />
              <StateRow
                label="Admin"
                value={snapshot?.admin ? shortKey(snapshot.admin) : gatewayQuery.isPending ? "loading" : "unavailable"}
              />
              <StateRow
                label="KYC root"
                value={shortHex(bufferToHex(snapshot?.kycRoot?.root))}
              />
              <StateRow
                label="Sanctions"
                value={shortHex(bufferToHex(snapshot?.sanctionsRoot?.root))}
              />
              <StateRow
                label="Nullifier"
                value={
                  authorization
                    ? nullifierQuery.isPending
                      ? "checking"
                      : nullifierQuery.data
                        ? "used"
                        : "unused"
                    : "pending"
                }
              />
              <StateRow
                label="Intent"
                value={
                  authorization
                    ? intentQuery.isPending
                      ? "checking"
                      : intentQuery.data
                        ? "recorded"
                        : "not recorded"
                    : "pending"
                }
              />

              <div className="grid gap-2">
                <Select
                  value={settlementMode}
                  onValueChange={(value) =>
                    setSettlementMode(value as "authorize" | "transfer")
                  }
                >
                  <SelectTrigger className="h-11 rounded-md border-black/20 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="min-w-64">
                    <SelectItem value="authorize">Authorize only</SelectItem>
                    <SelectItem value="transfer">Atomic native SAC transfer</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  className="h-11 rounded-md border-black/20 bg-white"
                  disabled={gatewayQuery.isFetching || !gatewayContractId}
                  onClick={() => gatewayQuery.refetch()}
                >
                  {gatewayQuery.isFetching ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RotateCw className="size-4" />
                  )}
                  Refresh contract state
                </Button>
                <Button
                  variant="outline"
                  className="h-11 rounded-md border-black/20 bg-white"
                  disabled={connectMutation.isPending}
                  onClick={() => connectMutation.mutate()}
                >
                  {connectMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <WalletCards className="size-4" />
                  )}
                  {walletAddress ? "Freighter connected" : "Connect Freighter"}
                </Button>
                <Button
                  className="h-11 rounded-md bg-black text-white hover:bg-black/85"
                  disabled={
                    submitMutation.isPending ||
                    !authorization ||
                    !walletAddress ||
                    !gatewayContractId ||
                    (settlementMode === "transfer" && !nativeSacContractId)
                  }
                  onClick={() => submitMutation.mutate()}
                >
                  {submitMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  Submit to Soroban
                </Button>
              </div>

              <div className="rounded-md border border-black/15 bg-white/70 p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-black uppercase">Issuer console</p>
                  <Badge
                    className={`rounded-md ${
                      isOperator ? "bg-[#2dd4bf] text-black" : "bg-black text-white"
                    }`}
                  >
                    {isOperator ? "admin wallet" : "watch mode"}
                  </Badge>
                </div>
                <div className="grid gap-3">
                  <Select
                    value={rotationKind}
                    onValueChange={(value) =>
                      setRotationKind(value as "Kyc" | "Sanctions")
                    }
                  >
                    <SelectTrigger className="h-10 rounded-md border-black/20 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Kyc">KYC root</SelectItem>
                      <SelectItem value="Sanctions">Sanctions root</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={rotationRoot}
                    onChange={(event) => setRotationRoot(event.target.value)}
                    placeholder="0x..."
                    className="h-10 rounded-md border-black/20 bg-white font-mono text-xs"
                  />
                  <Input
                    value={rotationEpoch}
                    type="number"
                    min={1}
                    onChange={(event) =>
                      setRotationEpoch(Number(event.target.value) || 1)
                    }
                    className="h-10 rounded-md border-black/20 bg-white font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    className="h-10 rounded-md border-black/20 bg-white"
                    disabled={
                      rotateRootMutation.isPending ||
                      !walletAddress ||
                      !rotationRoot ||
                      rotationRoot.replace(/^0x/, "").length !== 64
                    }
                    onClick={() => rotateRootMutation.mutate()}
                  >
                    {rotateRootMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <RefreshCcw className="size-4" />
                    )}
                    Rotate root
                  </Button>
                </div>
              </div>

              <div className="rounded-md border border-black/15 bg-black p-3 text-white">
                <div className="flex items-center gap-2 text-sm font-bold uppercase">
                  {mutation.isPending || submitMutation.isPending ? (
                    <RefreshCcw className="size-4 animate-spin text-[#eab308]" />
                  ) : submitMutation.data?.hash ? (
                    <ExternalLink className="size-4 text-[#2dd4bf]" />
                  ) : authorization ? (
                    <CheckCircle2 className="size-4 text-[#2dd4bf]" />
                  ) : (
                    <CircleDollarSign className="size-4 text-[#eab308]" />
                  )}
                  {rotateRootMutation.isPending
                    ? "Rotating compliance root"
                    : submitMutation.isPending
                    ? settlementMode === "transfer"
                      ? "Submitting atomic transfer"
                      : "Submitting transaction"
                    : mutation.isPending
                      ? "Preparing proof"
                      : submitMutation.data?.hash
                        ? "Gateway transaction sent"
                        : authorization
                          ? "Payment authorized"
                          : "Awaiting intent"}
                </div>
                <div className="mt-3 grid gap-2 font-mono text-[11px] text-white/60">
                  <HashLine label="intent" value={authorization?.proof.intentId} />
                  <HashLine label="nullifier" value={authorization?.proof.nullifier} />
                  <HashLine label="proof" value={authorization?.proof.proofHash} />
                  <HashLine label="tx" value={submitMutation.data?.hash} />
                  <HashLine label="root tx" value={rotateRootMutation.data?.hash} />
                </div>
                {submitMutation.data?.hash ? (
                  <a
                    className="mt-3 inline-flex text-xs font-bold text-[#2dd4bf] underline-offset-4 hover:underline"
                    href={`https://stellar.expert/explorer/testnet/tx/${submitMutation.data.hash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View on Stellar Expert
                  </a>
                ) : null}
              </div>

              {mutation.error ||
              connectMutation.error ||
              submitMutation.error ||
              rotateRootMutation.error ||
              gatewayQuery.error ? (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm font-semibold text-destructive">
                  {rotateRootMutation.error instanceof Error
                    ? rotateRootMutation.error.message
                    : gatewayQuery.error instanceof Error
                      ? gatewayQuery.error.message
                      : submitMutation.error instanceof Error
                    ? submitMutation.error.message
                    : connectMutation.error instanceof Error
                      ? connectMutation.error.message
                      : mutation.error instanceof Error
                    ? mutation.error.message
                    : "Authorization failed."}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

function StatusPill({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Database;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 border border-black/15 bg-white/60 px-3 py-2">
      <Icon className="size-4" />
      <span className="hidden text-muted-foreground sm:inline">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ProofNode({
  icon: Icon,
  label,
  active,
}: {
  icon: typeof BadgeCheck;
  label: string;
  active: boolean;
}) {
  return (
    <div className="flex min-h-16 items-center gap-3 border border-white/15 bg-white/[0.05] p-3">
      <div
        className={`grid size-9 place-items-center border ${
          active ? "border-[#2dd4bf] bg-[#2dd4bf] text-black" : "border-white/20"
        }`}
      >
        <Icon className="size-4" />
      </div>
      <p className="text-sm font-black uppercase leading-tight">{label}</p>
    </div>
  );
}

function StateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[112px_minmax(0,1fr)] items-start gap-4 text-sm">
      <span className="font-medium text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-right font-mono font-semibold">
        {value}
      </span>
    </div>
  );
}

function HashLine({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid grid-cols-[70px_minmax(0,1fr)] gap-2">
      <span className="text-white/38">{label}</span>
      <span className="truncate">{value ?? "pending"}</span>
    </div>
  );
}

function shortKey(value: string) {
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function shortHex(value?: string) {
  if (!value) return "unavailable";
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function formatSettlement(value: string) {
  return value.replaceAll("_", " ");
}

async function signWithConnectedFreighter(
  xdr: string,
  opts?: {
    address?: string;
    networkPassphrase?: string;
  },
) {
  const signed = await freighterSignTransaction(xdr, {
    address: opts?.address,
    networkPassphrase: opts?.networkPassphrase ?? STELLAR_TESTNET.networkPassphrase,
  });
  if (signed.error) throw new Error(signed.error.message);
  return {
    signedTxXdr: signed.signedTxXdr,
    signerAddress: signed.signerAddress,
  };
}
