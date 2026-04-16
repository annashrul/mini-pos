"use client";

import { createContext, useContext } from "react";
import type { HeldTransaction, PaymentEntry, PaymentMethodType, PosHistoryItem, ShiftSummary } from "../types";

export type PosDialogsContextValue = {
    showSearchDialog: boolean;
    setShowSearchDialog: (v: boolean) => void;
    searchProducts: (q: string, branchId?: string) => Promise<unknown[]>;
    activeBranchId: string;
    setSearchResults: (v: import("@/types").ProductSearchResult[]) => void;
    searchResults: import("@/types").ProductSearchResult[];
    addToCart: (p: import("@/types").ProductSearchResult) => void;
    showClosingDialog: boolean;
    setShowClosingDialog: (v: boolean) => void;
    activeBranchName: string;
    selectedRegister: string;
    activeShift: { id: string; openingCash: number; openedAt: string | Date } | null;
    summaryLoading: boolean;
    shiftSummary: ShiftSummary | null;
    closingCash: string;
    setClosingCash: (v: string) => void;
    closingNotes: string;
    setClosingNotes: (v: string) => void;
    handleCloseShift: () => void;
    closingShiftLoading: boolean;
    showHeldDialog: boolean;
    setShowHeldDialog: (v: boolean) => void;
    heldTransactions: HeldTransaction[];
    resumeTransaction: (id: number) => void;
    setHeldTransactions: React.Dispatch<React.SetStateAction<HeldTransaction[]>>;
    showHistoryDialog: boolean;
    setShowHistoryDialog: (v: boolean) => void;
    historyDetail: PosHistoryItem | null;
    setHistoryDetailId: (id: string | null) => void;
    historyLoading: boolean;
    historyData: PosHistoryItem[];
    reprintReceipt: (tx: PosHistoryItem) => void;
    canPosAction: (action: string) => boolean;
    setVoidingId: (id: string) => void;
    setShowVoidDialog: (v: boolean) => void;
    showPaymentDialog: boolean;
    setShowPaymentDialog: (v: boolean) => void;
    dynamicQuickAmounts: number[];
    payment: number;
    setPaymentAmount: (v: string) => void;
    handleCalculatorInput: (key: string) => void;
    paymentEntries: PaymentEntry[];
    setPaymentEntries: React.Dispatch<React.SetStateAction<PaymentEntry[]>>;
    remainingToPay: number;
    paymentMethod: PaymentMethodType;
    setPaymentMethod: (m: PaymentMethodType) => void;
    grandTotal: number;
    paidFromEntries: number;
    totalPaid: number;
    changeAmount: number;
    loading: boolean;
    handlePayment: () => void;
    terminConfig: { downPayment: number; installmentCount: number; interval: "WEEKLY" | "MONTHLY" } | null;
    setTerminConfig: (v: { downPayment: number; installmentCount: number; interval: "WEEKLY" | "MONTHLY" } | null) => void;
    showDiscountDialog: boolean;
    setShowDiscountDialog: (v: boolean) => void;
    discountType: "percent" | "amount";
    setDiscountType: (value: "percent" | "amount") => void;
    discountPercent: number;
    setDiscountPercent: (value: number) => void;
    discountFixed: number;
    setDiscountFixed: (value: number) => void;
    subtotal: number;
    showVoidDialog: boolean;
    voidReason: string;
    setVoidReason: (reason: string) => void;
    handleVoid: () => void;
    showShortcutsDialog: boolean;
    setShowShortcutsDialog: (v: boolean) => void;
};

const PosDialogsContext = createContext<PosDialogsContextValue | null>(null);

export function PosDialogsProvider({ value, children }: { value: PosDialogsContextValue; children: React.ReactNode }) {
    return <PosDialogsContext.Provider value={value}>{children}</PosDialogsContext.Provider>;
}

export function usePosDialogsContext() {
    const context = useContext(PosDialogsContext);
    if (!context) throw new Error("usePosDialogsContext must be used within PosDialogsProvider");
    return context;
}
