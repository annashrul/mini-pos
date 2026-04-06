"use client";

import { useState } from "react";
import type { Branch, CartItem, ProductSearchResult } from "@/types";
import type { ReceiptConfig } from "@/lib/receipt-config";
import type {
  DetectedCustomer,
  HeldTransaction,
  PaymentEntry,
  PaymentMethodType,
  PosConfig,
  PosHistoryItem,
  PosProductCacheEntry,
  ShiftSummary,
  TebusMurahOption,
} from "../types";

export function usePosPageStates(initCache?: PosProductCacheEntry) {
  const [isDesktop, setIsDesktop] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(740);
  const [centerPanelWidth, setCenterPanelWidth] = useState(0);
  const [isResizingLeftPanel, setIsResizingLeftPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [heldTransactions, setHeldTransactions] = useState<HeldTransaction[]>([]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [discountFixed, setDiscountFixed] = useState(0);
  const [historyData, setHistoryData] = useState<PosHistoryItem[]>([]);
  const [historyDetailId, setHistoryDetailId] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [voidingId, setVoidingId] = useState("");
  const [voidReason, setVoidReason] = useState("");
  const [taxPercent, setTaxPercent] = useState(11);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>("CASH");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentEntries, setPaymentEntries] = useState<PaymentEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [selectedRegister, setSelectedRegister] = useState("");
  const [openingCash, setOpeningCash] = useState("0");
  const [startingShift, setStartingShift] = useState(false);
  const [activeShift, setActiveShift] = useState<{ id: string; openingCash: number; openedAt: string | Date } | null>(null);
  const [closingCash, setClosingCash] = useState("");
  const [closingNotes, setClosingNotes] = useState("");
  const [shiftSummary, setShiftSummary] = useState<ShiftSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [posConfig, setPosConfig] = useState<PosConfig | null>(null);
  const [closingShiftLoading, setClosingShiftLoading] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [browseItems, setBrowseItems] = useState<ProductSearchResult[]>(initCache?.items ?? []);
  const [browsePage, setBrowsePage] = useState(initCache?.page ?? 1);
  const [browseHasMore, setBrowseHasMore] = useState(initCache?.hasMore ?? true);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [selectedTables, setSelectedTables] = useState<{ id: string; number: number; name: string | null; capacity: number }[]>([]);
  const [tables, setTables] = useState<{ id: string; number: number; name: string | null; capacity: number; status: string; section: string | null }[]>([]);
  const [leftPanelTab, setLeftPanelTab] = useState<"products" | "bundles" | "tables">("products");
  const [bundles, setBundles] = useState<any[]>([]);
  const [detectedCustomer, setDetectedCustomer] = useState<DetectedCustomer | null>(null);
  const [appliedPromos, setAppliedPromos] = useState<{ promoId: string; promoName: string; type: string; discountAmount: number; appliedTo: string }[]>([]);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherDiscount, setVoucherDiscount] = useState(0);
  const [voucherApplied, setVoucherApplied] = useState("");
  const [voucherPromoId, setVoucherPromoId] = useState("");
  const [tebusMurahOptions, setTebusMurahOptions] = useState<TebusMurahOption[]>([]);
  const [receiptConfig, setReceiptConfig] = useState<ReceiptConfig | null>(null);
  const [redeemPointsInput, setRedeemPointsInput] = useState(0);
  const [redeemDiscount, setRedeemDiscount] = useState(0);
  const [pointsEarnedResult, setPointsEarnedResult] = useState(0);
  const [posActionAccess, setPosActionAccess] = useState<Record<string, boolean> | null>(null);
  const [productTab] = useState<"favorites" | "category">("category");
  const [mobileView, setMobileView] = useState<"products" | "cart" | "payment">("products");
  const [productSyncing, setProductSyncing] = useState(false);

  return {
    isDesktop, setIsDesktop,
    leftPanelWidth, setLeftPanelWidth,
    centerPanelWidth, setCenterPanelWidth,
    isResizingLeftPanel, setIsResizingLeftPanel,
    searchQuery, setSearchQuery,
    searchResults, setSearchResults,
    cart, setCart,
    heldTransactions, setHeldTransactions,
    discountPercent, setDiscountPercent,
    discountType, setDiscountType,
    discountFixed, setDiscountFixed,
    historyData, setHistoryData,
    historyDetailId, setHistoryDetailId,
    historyLoading, setHistoryLoading,
    voidingId, setVoidingId,
    voidReason, setVoidReason,
    taxPercent, setTaxPercent,
    paymentMethod, setPaymentMethod,
    paymentAmount, setPaymentAmount,
    paymentEntries, setPaymentEntries,
    loading, setLoading,
    success, setSuccess,
    searching, setSearching,
    categories, setCategories,
    branches, setBranches,
    selectedBranchId, setSelectedBranchId,
    selectedRegister, setSelectedRegister,
    openingCash, setOpeningCash,
    startingShift, setStartingShift,
    activeShift, setActiveShift,
    closingCash, setClosingCash,
    closingNotes, setClosingNotes,
    shiftSummary, setShiftSummary,
    summaryLoading, setSummaryLoading,
    posConfig, setPosConfig,
    closingShiftLoading, setClosingShiftLoading,
    sessionStarted, setSessionStarted,
    selectedCategory, setSelectedCategory,
    browseItems, setBrowseItems,
    browsePage, setBrowsePage,
    browseHasMore, setBrowseHasMore,
    browseLoading, setBrowseLoading,
    customerName, setCustomerName,
    customerPhone, setCustomerPhone,
    detectedCustomer, setDetectedCustomer,
    appliedPromos, setAppliedPromos,
    promoDiscount, setPromoDiscount,
    voucherCode, setVoucherCode,
    voucherDiscount, setVoucherDiscount,
    voucherApplied, setVoucherApplied,
    voucherPromoId, setVoucherPromoId,
    tebusMurahOptions, setTebusMurahOptions,
    receiptConfig, setReceiptConfig,
    redeemPointsInput, setRedeemPointsInput,
    redeemDiscount, setRedeemDiscount,
    pointsEarnedResult, setPointsEarnedResult,
    posActionAccess, setPosActionAccess,
    productTab,
    mobileView, setMobileView,
    productSyncing, setProductSyncing,
    selectedTables, setSelectedTables,
    tables, setTables,
    leftPanelTab, setLeftPanelTab,
    bundles, setBundles,
  };
}
