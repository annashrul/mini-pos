"use client";

import { createContext, useContext } from "react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { PosSessionSetupValues } from "../types";

export type PosReadyScreenContextValue = {
    activeBranchName: string;
    setupRegister: UseFormRegister<PosSessionSetupValues>;
    setupErrors: FieldErrors<PosSessionSetupValues>;
    setSelectedRegister: (value: string) => void;
    activeShift: { id: string; openingCash: number; openedAt: string | Date } | null;
    openingCash: string;
    setOpeningCash: (value: string) => void;
    onBack: () => void;
    onStartSession: () => void;
    startingShift: boolean;
};

export type PosSuccessScreenContextValue = {
    success: string;
    grandTotal: number;
    paymentMethod: string;
    changeAmount: number;
    pointsEarnedResult: number;
    onPrint: () => void;
    onNewTransaction: () => void;
};

type PosScreenContextValue = PosReadyScreenContextValue | PosSuccessScreenContextValue;

const PosScreenContext = createContext<PosScreenContextValue | null>(null);

export function PosScreenProvider({ value, children }: { value: PosScreenContextValue; children: React.ReactNode }) {
    return <PosScreenContext.Provider value={value}>{children}</PosScreenContext.Provider>;
}

export function usePosScreenContext<T extends PosScreenContextValue>() {
    const context = useContext(PosScreenContext);
    if (!context) throw new Error("usePosScreenContext must be used within PosScreenProvider");
    return context as T;
}
