"use client";

import { create } from "zustand";
import type { CorridorCode, PaymentInput } from "@/lib/compliance/protocol";

type ComplianceState = PaymentInput & {
  setCorridor: (corridor: CorridorCode) => void;
  setAmount: (amount: number) => void;
  setSender: (sender: string) => void;
  setReceiver: (receiver: string) => void;
  setDestination: (destination: string) => void;
};

export const useComplianceStore = create<ComplianceState>((set) => ({
  corridor: "USDC-MXN",
  amount: 420,
  sender: "acme-payroll-us",
  receiver: "worker-734-mx",
  destination: "demo-recipient",
  setCorridor: (corridor) => set({ corridor }),
  setAmount: (amount) => set({ amount }),
  setSender: (sender) => set({ sender }),
  setReceiver: (receiver) => set({ receiver }),
  setDestination: (destination) => set({ destination }),
}));
