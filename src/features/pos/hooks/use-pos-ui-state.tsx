"use client";

import { createContext, useContext, useMemo, useState } from "react";

type PosUiStateContextValue = {
  showHistoryDialog: boolean;
  setShowHistoryDialog: React.Dispatch<React.SetStateAction<boolean>>;
  showVoidDialog: boolean;
  setShowVoidDialog: React.Dispatch<React.SetStateAction<boolean>>;
  showSearchDialog: boolean;
  setShowSearchDialog: React.Dispatch<React.SetStateAction<boolean>>;
  showHeldDialog: boolean;
  setShowHeldDialog: React.Dispatch<React.SetStateAction<boolean>>;
  showDiscountDialog: boolean;
  setShowDiscountDialog: React.Dispatch<React.SetStateAction<boolean>>;
  showShortcutsDialog: boolean;
  setShowShortcutsDialog: React.Dispatch<React.SetStateAction<boolean>>;
  showPaymentDialog: boolean;
  setShowPaymentDialog: React.Dispatch<React.SetStateAction<boolean>>;
  showClosingDialog: boolean;
  setShowClosingDialog: React.Dispatch<React.SetStateAction<boolean>>;
};

const PosUiStateContext = createContext<PosUiStateContextValue | null>(null);

export function PosUiStateProvider({ children }: { children: React.ReactNode }) {
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [showHeldDialog, setShowHeldDialog] = useState(false);
  const [showDiscountDialog, setShowDiscountDialog] = useState(false);
  const [showShortcutsDialog, setShowShortcutsDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showClosingDialog, setShowClosingDialog] = useState(false);

  const value = useMemo(
    () => ({
      showHistoryDialog,
      setShowHistoryDialog,
      showVoidDialog,
      setShowVoidDialog,
      showSearchDialog,
      setShowSearchDialog,
      showHeldDialog,
      setShowHeldDialog,
      showDiscountDialog,
      setShowDiscountDialog,
      showShortcutsDialog,
      setShowShortcutsDialog,
      showPaymentDialog,
      setShowPaymentDialog,
      showClosingDialog,
      setShowClosingDialog,
    }),
    [
      showHistoryDialog,
      showVoidDialog,
      showSearchDialog,
      showHeldDialog,
      showDiscountDialog,
      showShortcutsDialog,
      showPaymentDialog,
      showClosingDialog,
    ]
  );

  return <PosUiStateContext.Provider value={value}>{children}</PosUiStateContext.Provider>;
}

export function usePosUiState() {
  const context = useContext(PosUiStateContext);
  if (!context) throw new Error("usePosUiState must be used within PosUiStateProvider");
  return context;
}
