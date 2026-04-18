"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { posService } from "@/features/pos";
import { getSidebarMenuAccess } from "@/features/access-control";
import { getShiftSummary } from "@/server/actions/shifts";
import { cn, formatCurrency } from "@/lib/utils";
import { printThermalReceipt } from "@/lib/thermal-receipt";
import { addOfflineTransaction } from "@/lib/offline-queue";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useBranch } from "@/components/providers/branch-provider";
import { useConfigRealtime } from "@/hooks/use-config-socket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import {
    Pause, WifiOff, Wifi, RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import type { ProductSearchResult } from "@/types";
import { PosDialogsProvider, PosPanelsProvider, PosScreenProvider, PosUiStateProvider, usePosPageStates, usePosSessionSetupForm, usePosUiState } from "../hooks";
import {
    type PaymentMethodType,
    type PosProductCacheEntry,
    type RawPosProduct,
} from "../types";
import {
    POS_PRODUCT_CACHE_KEY,
    POS_TERMINAL_KEY,
    STORAGE_KEY,
    getPosCategoryCacheKey,
    readPosProductCache,
    toProductSearchResult,
    writePosProductCache,
} from "../utils";
import { logPosActivity } from "@/server/actions/pos-activity";
import { PlanProvider } from "@/components/providers/plan-provider";
import { usePlanAccess } from "@/hooks/use-plan-access";
import { DiscountDialog, ShortcutsDialog, VoidDialog } from "./pos-page-dialogs";
import { POSPageMainDialogs } from "./pos-page-main-dialogs";
import { POSPagePanels } from "./pos-page-panels";
import { PosReadySection } from "./pos-ready-section";
import { PosSuccessSection } from "./pos-success-section";
const {
    searchProducts,
    findByBarcode,
    browseProducts,
    getAllCategories,
    getAllBranches,
    createTransaction,
    getActiveShift,
    hasClosedShiftToday,
    openShift,
    closeShift,
    calculateAutoPromo,
    getTebusMurahOptions,
    validateVoucher,
    findCustomerByPhone,
    redeemPoints,
    getReceiptConfig,
    getPosConfig,
} = posService;

export default function POSPage() {
    return (
        <PlanProvider>
            <PosUiStateProvider>
                <POSPageContent />
            </PosUiStateProvider>
        </PlanProvider>
    );
}

function POSPageContent() {
    const router = useRouter();
    const { data: session } = useSession();
    const { selectedBranchId: sidebarBranchId, setSelectedBranchId: setSidebarBranchId } = useBranch();
    const userBranchId = (session?.user as { branchId?: string | null } | undefined)?.branchId ?? null;
    const panelsContainerRef = useRef<HTMLDivElement>(null);
    const centerPanelRef = useRef<HTMLDivElement>(null);
    const barcodeInputRef = useRef<HTMLInputElement>(null);
    const { isOnline } = useOnlineStatus();
    const { pendingCount, syncing, syncAll, refreshCount } = useOfflineSync(isOnline);
    const {
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
        showHoldInputDialog,
        setShowHoldInputDialog,
        holdInputLabel,
        setHoldInputLabel,
    } = usePosUiState();
    const {
        register: setupRegister,
        handleSubmit: handleSetupSubmit,
        setValue: setSetupValue,
        formState: { errors: setupErrors },
    } = usePosSessionSetupForm();
    // Infinite scroll product panel with persistent cache
    const productScrollRef = useRef<HTMLDivElement>(null);
    const productSentinelRef = useRef<HTMLDivElement>(null);
    // Load initial state from sessionStorage
    const productCacheRef = useRef<Map<string, PosProductCacheEntry>>(readPosProductCache(POS_PRODUCT_CACHE_KEY));

    const persistCache = () => {
        writePosProductCache(POS_PRODUCT_CACHE_KEY, productCacheRef.current);
    };

    // Restore current category from cache on mount
    const initCache = productCacheRef.current.get(getPosCategoryCacheKey(""));
    const {
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
        terminConfig, setTerminConfig,
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
        closedToday, setClosedToday,
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
    } = usePosPageStates(initCache);
    const initialScrollRestored = useRef(false);
    const activeBranchId = selectedBranchId || userBranchId || "";
    const activeBranchName = branches.find((branch) => branch.id === selectedBranchId)?.name || "Belum dipilih";
    const isPosReady = Boolean(activeShift && selectedBranchId && selectedRegister.trim() && sessionStarted);

    const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
    const manualDiscount = discountType === "percent" ? Math.round(subtotal * (discountPercent / 100)) : discountFixed;
    const discountAmount = manualDiscount + promoDiscount + voucherDiscount + redeemDiscount;
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = Math.round(afterDiscount * (taxPercent / 100));
    const grandTotal = afterDiscount + taxAmount;
    const payment = Number(paymentAmount) || 0;
    const paidFromEntries = paymentEntries.reduce((s, e) => s + e.amount, 0);
    const remainingToPay = grandTotal - paidFromEntries;
    const totalPaid = paidFromEntries + (paymentEntries.length > 0 ? payment : payment);
    const changeAmount = totalPaid - grandTotal;
    const negativeMarginItems = cart.filter((item) => item.unitPrice <= item.purchasePrice);
    const lowStockItems = cart.filter((item) => item.quantity >= item.maxStock - 2);
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const promoMeta = useMemo(() => {
        const byItem: Record<string, { names: string[]; discount: number }> = {};
        const cartPromos: { promoId: string; promoName: string; type: string; discountAmount: number; appliedTo: string }[] = [];
        const freeQtyByItem: Record<string, number> = {};
        appliedPromos.forEach((promo) => {
            if (promo.appliedTo === "cart") {
                cartPromos.push(promo);
                return;
            }
            const current = byItem[promo.appliedTo] ?? { names: [], discount: 0 };
            current.names.push(promo.promoName);
            current.discount += promo.discountAmount;
            byItem[promo.appliedTo] = current;
            if (promo.type === "BUY_X_GET_Y" || promo.type === "BUNDLE") {
                const item = cart.find((cartItem) => cartItem.productId === promo.appliedTo);
                if (item && item.unitPrice > 0) {
                    const freeQty = Math.max(0, Math.round(promo.discountAmount / item.unitPrice));
                    if (freeQty > 0) {
                        freeQtyByItem[promo.appliedTo] = (freeQtyByItem[promo.appliedTo] ?? 0) + freeQty;
                    }
                }
            }
        });
        return { byItem, cartPromos, freeQtyByItem };
    }, [appliedPromos, cart]);
    const getLeftPanelBounds = useCallback(() => {
        const totalWidth = panelsContainerRef.current?.clientWidth ?? 1400;
        const rightPanelWidth = 340;
        const minLeft = 420;
        const minCenter = 420;
        const maxLeft = Math.max(minLeft, totalWidth - rightPanelWidth - minCenter);
        return { minLeft, maxLeft };
    }, []);
    const productGridCols = useMemo(() => {
        if (!isDesktop) return 3;
        const nextCols = Math.floor((leftPanelWidth - 36) / 172);
        return Math.max(2, Math.min(7, nextCols));
    }, [isDesktop, leftPanelWidth]);
    const isCompactCart = isDesktop && centerPanelWidth > 0 && centerPanelWidth < 620;
    const startResizeLeftPanel = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        if (!isDesktop) return;
        event.preventDefault();
        const startX = event.clientX;
        const startWidth = leftPanelWidth;
        setIsResizingLeftPanel(true);
        const onMouseMove = (moveEvent: MouseEvent) => {
            const delta = moveEvent.clientX - startX;
            const nextWidth = startWidth + delta;
            const { minLeft, maxLeft } = getLeftPanelBounds();
            setLeftPanelWidth(Math.min(maxLeft, Math.max(minLeft, nextWidth)));
        };
        const onMouseUp = () => {
            setIsResizingLeftPanel(false);
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
    }, [getLeftPanelBounds, isDesktop, leftPanelWidth]);
    const quickStep =
        grandTotal <= 10000 ? 1000 :
            grandTotal <= 100000 ? 5000 :
                grandTotal <= 500000 ? 10000 :
                    grandTotal <= 2000000 ? 50000 : 100000;
    const roundToStep = (amount: number) => Math.ceil(amount / quickStep) * quickStep;
    const dynamicQuickAmounts = Array.from(new Set([
        grandTotal,
        roundToStep(grandTotal),
        roundToStep(grandTotal + quickStep),
        roundToStep(grandTotal + quickStep * 3),
    ])).filter((amount) => amount > 0);
    const { canAction: canPlanAction } = usePlanAccess();
    const canPosAction = useCallback((actionKey: string) => {
        const roleAllowed = posActionAccess?.[actionKey] ?? true;
        if (!roleAllowed) return false;
        return canPlanAction("pos", actionKey);
    }, [posActionAccess, canPlanAction]);

    // Load shift summary when closing dialog opens
    useEffect(() => {
        if (!showClosingDialog || !activeShift || !summaryLoading) return;
        let active = true;
        getShiftSummary(activeShift.id)
            .then((summary) => { if (active) { setShiftSummary(summary); setSummaryLoading(false); } })
            .catch(() => { if (active) { toast.error("Gagal memuat ringkasan shift"); setSummaryLoading(false); } });
        return () => { active = false; };
    }, [showClosingDialog, activeShift, summaryLoading]);

    useEffect(() => {
        let active = true;
        const run = async () => {
            const result = await getSidebarMenuAccess();
            if (!active) return;
            const role = result.role;
            const posMenu = result.menus.find((menu) => menu.key === "pos");
            if (!posMenu) return;
            const nextAccess = Object.fromEntries(
                posMenu.actions.map((action) => [action.key, Boolean(action.permissions?.[role])])
            );
            setPosActionAccess(nextAccess);
        };
        run().catch(() => undefined);
        return () => { active = false; };
    }, []);

    // Effects
    useEffect(() => {
        const run = async () => {
            if (cart.length === 0) { setAppliedPromos([]); setPromoDiscount(0); setTebusMurahOptions([]); return; }
            const regularItems = cart.filter((c) => !c.tebusPromoId);
            const regularSubtotal = regularItems.reduce((sum, item) => sum + item.subtotal, 0);
            const items = regularItems.map((c) => ({
                productId: c.productId,
                productName: c.productName,
                ...(c.categoryId ? { categoryId: c.categoryId } : {}),
                quantity: c.quantity,
                unitPrice: c.unitPrice,
                subtotal: c.subtotal
            }));
            const [result, tebusOptions] = await Promise.all([
                calculateAutoPromo(items, regularSubtotal),
                getTebusMurahOptions(
                    items,
                    regularSubtotal,
                    cart
                        .filter((c) => c.tebusPromoId)
                        .map((c) => ({ promoId: c.tebusPromoId as string, quantity: c.quantity }))
                ),
            ]);
            setAppliedPromos(result.promos); setPromoDiscount(result.totalDiscount);
            setTebusMurahOptions(tebusOptions);
        };
        run();
    }, [cart, getTebusMurahOptions]);

    useEffect(() => { if (cart.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(cart)); else localStorage.removeItem(STORAGE_KEY); }, [cart]);

    // Handlers
    const handleCustomerPhoneChange = async (phone: string) => { setCustomerPhone(phone); if (phone.length >= 4) { const c = await findCustomerByPhone(phone); if (c) { setDetectedCustomer(c); if (!customerName.trim()) setCustomerName(c.name); toast.success(`Member: ${c.name}`); } else if (phone.length >= 10 && customerName.trim()) { try { const { quickRegisterCustomer } = await import("@/server/actions/customers"); const newCustomer = await quickRegisterCustomer(customerName.trim(), phone); if (newCustomer) { setDetectedCustomer(newCustomer); logPosActivity({ action: "QUICK_REGISTER", entity: "Customer", entityId: newCustomer.id, details: { name: newCustomer.name, phone }, branchId: activeBranchId || undefined }); toast.success(`Member baru terdaftar: ${newCustomer.name}`); } } catch { /* silent */ } } else { setDetectedCustomer(null); } } else { setDetectedCustomer(null); } };
    const handleApplyVoucher = async () => {
        if (!canPosAction("voucher")) { toast.error("Tidak punya akses voucher"); return; }
        if (!voucherCode) return;
        const r = await validateVoucher(voucherCode, subtotal);
        if (r.error) { setVoucherPromoId(""); toast.error(r.error); } else { setVoucherDiscount(r.discount!); setVoucherApplied(r.promoName!); setVoucherPromoId(r.promoId!); logPosActivity({ action: "APPLY_VOUCHER", entity: "Promotion", entityId: r.promoId!, details: { voucherCode, discount: r.discount!, promoName: r.promoName! }, branchId: activeBranchId || undefined }); toast.success(`Voucher: -${formatCurrency(r.discount!)}`); }
    };

    const handleRedeemPoints = async () => {
        if (!canPosAction("redeem_points")) { toast.error("Tidak punya akses redeem poin"); return; }
        if (!detectedCustomer || redeemPointsInput <= 0) return;
        const r = await redeemPoints(detectedCustomer.id, redeemPointsInput);
        if (r.error) { toast.error(r.error); return; }
        setRedeemDiscount(r.discountValue!);
        logPosActivity({ action: "REDEEM_POINTS", entity: "Points", details: { customerId: detectedCustomer.id, customerName: detectedCustomer.name, points: redeemPointsInput, discountValue: r.discountValue! }, branchId: activeBranchId || undefined });
        toast.success(`${redeemPointsInput} poin ditukar = diskon ${formatCurrency(r.discountValue!)}`);
    };

    const shouldValidateStock = posConfig?.validateStock !== false;

    // --- Multi-unit selection state ---
    const [unitSelectorProduct, setUnitSelectorProduct] = useState<ProductSearchResult | null>(null);

    const addToCartWithUnit = useCallback((product: ProductSearchResult, unitOverride?: { unitName: string; conversionQty: number; sellingPrice: number; purchasePrice: number }) => {
        const unitName = unitOverride?.unitName ?? product.matchedUnit?.name ?? product.unit;
        const conversionQty = unitOverride?.conversionQty ?? product.matchedUnit?.conversionQty ?? 1;
        const unitPrice = unitOverride?.sellingPrice ?? (product.matchedUnit?.sellingPrice ?? product.sellingPrice);
        const pPrice = unitOverride?.purchasePrice ?? product.purchasePrice;
        const lineId = conversionQty > 1 ? `${product.id}__unit__${unitName}` : product.id;
        const maxStockInUnit = shouldValidateStock ? Math.floor(product.stock / conversionQty) : 999999;

        setCart((prev) => {
            const existing = prev.find((i) => (i.lineId ?? i.productId) === lineId && !i.tebusPromoId);
            if (existing) {
                const newQty = existing.quantity + 1;
                const newBaseQty = newQty * (existing.conversionQty ?? 1);
                if (shouldValidateStock && newBaseQty > product.stock) { toast.error("Stok tidak cukup"); return prev; }
                return prev.map((i) => (i.lineId ?? i.productId) === lineId ? { ...i, quantity: newQty, subtotal: newQty * i.unitPrice - i.discount } : i);
            }
            if (shouldValidateStock && product.stock <= product.minStock) toast.warning(`Stok ${product.name} menipis!`);
            if (unitPrice <= pPrice) toast.warning(`Margin negatif: ${product.name}`);
            return [...prev, {
                lineId,
                productId: product.id,
                ...(product.categoryId ? { categoryId: product.categoryId } : {}),
                productName: product.name,
                productCode: product.code,
                quantity: 1,
                unitPrice,
                purchasePrice: pPrice,
                discount: 0,
                subtotal: unitPrice,
                maxStock: maxStockInUnit,
                unitName,
                conversionQty,
            }];
        });
        setSearchQuery(""); setSearchResults([]); barcodeInputRef.current?.focus();
    }, [shouldValidateStock]);

    const addToCart = useCallback((product: ProductSearchResult) => {
        // If product was scanned with a matched unit barcode, add directly with that unit
        if (product.matchedUnit) {
            addToCartWithUnit(product);
            return;
        }
        // If product has multiple units, show unit selector
        if (product.units && product.units.length > 0) {
            setUnitSelectorProduct(product);
            return;
        }
        // No extra units, add directly with base unit
        addToCartWithUnit(product);
    }, [addToCartWithUnit]);
    const handleAddTebusMurah = useCallback((option: {
        promoId: string;
        promoName: string;
        tebusPrice: number;
        remainingQty: number;
        product: { id: string; name: string; code: string; sellingPrice: number; stock: number; minStock: number };
    }) => {
        if (option.remainingQty <= 0) { toast.error("Kuota tebus murah habis"); return; }
        setCart((prev) => {
            const lineId = `${option.product.id}__tebus__${option.promoId}`;
            const existing = prev.find((item) => (item.lineId ?? item.productId) === lineId);
            if (existing) {
                if (existing.quantity >= option.remainingQty) return prev;
                return prev.map((item) => (item.lineId ?? item.productId) === lineId
                    ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.unitPrice - item.discount }
                    : item);
            }
            return [...prev, {
                lineId,
                productId: option.product.id,
                productName: option.product.name,
                productCode: option.product.code,
                quantity: 1,
                unitPrice: option.tebusPrice,
                purchasePrice: option.product.sellingPrice,
                discount: 0,
                subtotal: option.tebusPrice,
                maxStock: option.product.stock,
                tebusPromoId: option.promoId,
                tebusPromoName: option.promoName,
            }];
        });
    }, []);

    const handleBarcodeInput = useCallback(async (value: string) => {
        setSearchQuery(value); if (value.length < 1) { setSearchResults([]); return; }
        if (/^\d{8,}$/.test(value)) {
            const p = await findByBarcode(value, activeBranchId);
            if (p) {
                const result = toProductSearchResult(p as RawPosProduct);
                // If findByBarcode matched a unit barcode, it returns matchedUnit
                if (result.matchedUnit) {
                    addToCartWithUnit(result);
                } else {
                    addToCart(result);
                }
                setSearchQuery(""); setSearchResults([]); return;
            }
        }
        setSearching(true); const r = await searchProducts(value, activeBranchId); setSearchResults(r.map((item) => toProductSearchResult(item as RawPosProduct))); setSearching(false);
    }, [activeBranchId, addToCart, addToCartWithUnit]);

    const updateQuantity = (id: string, d: number) => { setCart((prev) => prev.map((i) => { if ((i.lineId ?? i.productId) !== id) return i; const n = i.quantity + d; if (n <= 0) return i; if (shouldValidateStock && n > i.maxStock) { toast.error("Stok tidak cukup"); return i; } return { ...i, quantity: n, subtotal: n * i.unitPrice - i.discount }; })); };
    const setItemQuantity = (id: string, qty: number) => { if (qty < 1) return; setCart((prev) => prev.map((i) => { if ((i.lineId ?? i.productId) !== id) return i; if (shouldValidateStock && qty > i.maxStock) { toast.error("Stok tidak cukup"); return i; } return { ...i, quantity: qty, subtotal: qty * i.unitPrice - i.discount }; })); };
    const handleUnitSelect = useCallback((unitName: string, conversionQty: number, sellingPrice: number, purchasePrice: number) => {
        if (!unitSelectorProduct) return;
        addToCartWithUnit(unitSelectorProduct, { unitName, conversionQty, sellingPrice, purchasePrice });
        setUnitSelectorProduct(null);
    }, [unitSelectorProduct, addToCartWithUnit]);
    const removeItem = (id: string) => setCart((prev) => prev.filter((i) => (i.lineId ?? i.productId) !== id));
    const addBundleToCart = useCallback((bundle: any) => {
        if (!bundle.items || bundle.items.length === 0) return;
        // Bundle masuk sebagai 1 item di cart
        // Komponen disimpan di bundleItems untuk pengurangan stok di backend
        const bundleMaxStock = shouldValidateStock
            ? Math.min(
                ...bundle.items.map((item: any) => {
                    const productStock = Number(item.product?.stock ?? 0);
                    const req = Number(item.quantity ?? 1);
                    if (req <= 0) return 0;
                    return Math.floor(productStock / req);
                }),
            )
            : 999999;
        const bundlePurchasePrice = bundle.items.reduce((sum: number, item: any) => {
            const p = Number(item.product?.purchasePrice ?? 0);
            const q = Number(item.quantity ?? 0);
            return sum + p * q;
        }, 0);
        const bundleItem = {
            productId: `bundle:${bundle.id}`,
            productName: bundle.name,
            productCode: bundle.code,
            quantity: 1,
            unitPrice: bundle.sellingPrice,
            purchasePrice: bundlePurchasePrice,
            discount: bundle.totalBasePrice - bundle.sellingPrice,
            subtotal: bundle.sellingPrice,
            maxStock: bundleMaxStock,
            // Data komponen untuk backend
            bundleId: bundle.id,
            bundleItems: bundle.items.map((item: any) => ({
                productId: item.product.id,
                productName: item.product.name,
                productCode: item.product.code,
                quantity: item.quantity,
                unitPrice: item.product.sellingPrice,
                purchasePrice: item.product.purchasePrice,
            })),
        };
        setCart((prev) => [...prev, bundleItem]);
        toast.success(`Paket "${bundle.name}" ditambahkan`);
    }, [setCart, shouldValidateStock]);
    const holdTransaction = useCallback((label?: string) => {
        if (!canPosAction("hold")) { toast.error("Tidak punya akses hold transaksi"); return; }
        if (cart.length === 0) { toast.error("Keranjang kosong"); return; }
        const holdLabel = label?.trim() || customerName.trim() || `Hold ${new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`;
        setHeldTransactions((p) => [...p, { id: Date.now(), cart: [...cart], time: new Date().toLocaleTimeString("id-ID"), label: holdLabel }]);
        logPosActivity({ action: "HOLD", entity: "Transaction", details: { label: holdLabel, itemCount: cart.length, total: cart.reduce((s, i) => s + i.subtotal, 0) }, branchId: activeBranchId || undefined });
        setCart([]);
        localStorage.removeItem(STORAGE_KEY);
        toast.success(`Ditahan: ${holdLabel}`);
    }, [canPosAction, cart, customerName, activeBranchId]);
    const resumeTransaction = (id: number) => { const h = heldTransactions.find((x) => x.id === id); if (!h) return; if (cart.length > 0) holdTransaction(); setCart(h.cart); setHeldTransactions((p) => p.filter((x) => x.id !== id)); setShowHeldDialog(false); logPosActivity({ action: "RESUME", entity: "Transaction", details: { itemCount: h.cart.length }, branchId: activeBranchId || undefined }); toast.success("Dilanjutkan"); };
    const openPaymentDialog = useCallback(() => {
        if (!canPosAction("create")) { toast.error("Tidak punya akses pembayaran"); return; }
        if (cart.length === 0) { toast.error("Keranjang kosong"); return; }
        // Check if customer is required — name OR registered member
        if (posConfig?.requireCustomer && !customerName.trim() && !detectedCustomer) {
            toast.error("Nama customer wajib diisi sebelum pembayaran");
            return;
        }
        if (paymentMethod === "CASH" && !paymentAmount) setPaymentAmount(String(grandTotal));
        if (paymentMethod !== "CASH") setPaymentAmount(String(grandTotal));
        setShowPaymentDialog(true);
    }, [canPosAction, cart.length, grandTotal, paymentAmount, paymentMethod, posConfig?.requireCustomer, detectedCustomer, customerName]);
    const handleCalculatorInput = (key: string) => {
        if (key === "CLEAR") { setPaymentAmount(""); return; }
        if (key === "BACKSPACE") { setPaymentAmount((prev) => prev.slice(0, -1)); return; }
        setPaymentAmount((prev) => {
            const next = `${prev}${key}`.replace(/^0+(?=\d)/, "");
            return next;
        });
    };

    const handlePayment = async () => {
        if (!canPosAction("create")) { toast.error("Tidak punya akses pembayaran"); return; }
        if (cart.length === 0) { toast.error("Keranjang kosong"); return; }
        if (posConfig?.requireCustomer && !customerName.trim() && !detectedCustomer) { toast.error("Nama customer wajib diisi"); return; }
        // TERMIN requires customer
        const hasTermin = paymentMethod === "TERMIN" || paymentEntries.some((e) => e.method === "TERMIN");
        if (hasTermin && !detectedCustomer) { toast.error("Pembayaran termin memerlukan data customer yang terdaftar"); return; }
        // Build final payments list (merge same methods)
        const mergedMap = new Map<PaymentMethodType, number>();
        for (const e of paymentEntries) mergedMap.set(e.method, (mergedMap.get(e.method) ?? 0) + e.amount);
        if (payment > 0) mergedMap.set(paymentMethod, (mergedMap.get(paymentMethod) ?? 0) + payment);
        const finalPayments = Array.from(mergedMap.entries()).map(([method, amount]) => ({ method, amount }));
        const finalTotalPaid = finalPayments.reduce((s, e) => s + e.amount, 0);
        if (finalTotalPaid < grandTotal) { toast.error("Total pembayaran kurang"); return; }
        const finalChange = finalTotalPaid - grandTotal;

        setLoading(true);
        const pn = appliedPromos.map((p) => p.promoName);
        cart.forEach((item) => { if (item.tebusPromoName) pn.push(item.tebusPromoName); });
        if (voucherApplied) pn.push(voucherApplied);
        const tebusPromoIds = cart.map((item) => item.tebusPromoId).filter((id): id is string => Boolean(id));
        const payload = {
            items: cart.map((item) => ({
                productId: item.productId,
                ...(item.categoryId ? { categoryId: item.categoryId } : {}),
                productName: item.productName,
                productCode: item.productCode,
                ...(item.lineId ? { lineId: item.lineId } : {}),
                ...(item.tebusPromoId ? { tebusPromoId: item.tebusPromoId } : {}),
                ...(item.tebusPromoName ? { tebusPromoName: item.tebusPromoName } : {}),
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discount: item.discount,
                subtotal: item.subtotal,
                ...(item.unitName ? { unitName: item.unitName } : {}),
                ...(item.conversionQty && item.conversionQty > 1 ? { conversionQty: item.conversionQty, baseQty: item.quantity * item.conversionQty } : {}),
                ...(item.bundleId ? { bundleId: item.bundleId } : {}),
                ...(item.bundleItems ? { bundleItems: item.bundleItems } : {}),
            })),
            subtotal,
            discountAmount,
            taxAmount,
            grandTotal,
            paymentMethod: finalPayments[0]?.method ?? paymentMethod,
            paymentAmount: finalTotalPaid,
            changeAmount: finalChange,
            payments: finalPayments,
            ...(detectedCustomer?.id ? { customerId: detectedCustomer.id } : {}),
            ...(activeBranchId ? { branchId: activeBranchId } : {}),
            ...(selectedTables.length > 0
                ? { notes: `Meja: ${selectedTables.map((t) => t.number).join("+")}${customerName.trim() ? ` - Atas nama: ${customerName.trim()}` : ""}` }
                : customerName.trim() ? { notes: `Atas nama: ${customerName.trim()}` } : {}),
            ...(pn.length > 0 ? { promoApplied: Array.from(new Set(pn)).join(", ") } : {}),
            ...(appliedPromos.length > 0 || voucherPromoId || tebusPromoIds.length > 0 ? { promoIds: Array.from(new Set([...appliedPromos.map((p) => p.promoId), ...(voucherPromoId ? [voucherPromoId] : []), ...tebusPromoIds])) } : {}),
            ...(redeemDiscount > 0 ? { redeemPoints: redeemPointsInput } : {}),
            ...(hasTermin && terminConfig ? { terminConfig } : {}),
        };

        if (!isOnline) {
            // Offline mode: save to IndexedDB queue
            try {
                const offlineId = await addOfflineTransaction(payload);
                setLoading(false);
                setShowPaymentDialog(false);
                setSuccess(`OFFLINE-${offlineId.slice(-8).toUpperCase()}`);
                setPointsEarnedResult(0);
                localStorage.removeItem(STORAGE_KEY);
                refreshCount();
                toast.info("Transaksi disimpan offline, akan disinkronkan saat online");
            } catch {
                setLoading(false);
                toast.error("Gagal menyimpan transaksi offline");
            }
            return;
        }

        const r = await createTransaction(payload);
        setLoading(false);
        if (r.error) {
            toast.error(r.error);
        } else {
            setShowPaymentDialog(false);
            setSuccess(r.invoiceNumber!);
            setPointsEarnedResult(r.pointsEarned || 0);
            localStorage.removeItem(STORAGE_KEY);
            // Refresh product list to update stock after checkout
            loadProducts("all", selectedCategory || undefined, 1, true);
            // Mark selected tables as OCCUPIED
            if (selectedTables.length > 0) {
                import("@/server/actions/tables").then(({ occupyTable }) => {
                    Promise.all(selectedTables.map((t) => occupyTable(t.id))).then(() => {
                        // Reload tables to reflect new status
                        import("@/server/actions/tables").then(({ getTables }) => {
                            getTables(activeBranchId || undefined).then((t) => setTables(t as typeof tables)).catch(() => { });
                        });
                    });
                }).catch(() => { });
            }
        }
    };

    const resetPOS = useCallback(() => { logPosActivity({ action: "CLEAR_CART", entity: "Transaction", branchId: activeBranchId || undefined }); setCart([]); setDiscountPercent(0); setDiscountFixed(0); setDiscountType("percent"); setPaymentAmount(""); setPaymentEntries([]); setSuccess(null); setSearchQuery(""); setSearchResults([]); setCustomerName(""); setCustomerPhone(""); setDetectedCustomer(null); setAppliedPromos([]); setPromoDiscount(0); setVoucherCode(""); setVoucherDiscount(0); setVoucherApplied(""); setVoucherPromoId(""); setTebusMurahOptions([]); setRedeemPointsInput(0); setRedeemDiscount(0); setPointsEarnedResult(0); setSelectedTables([]); setLeftPanelTab("products"); localStorage.removeItem(STORAGE_KEY); barcodeInputRef.current?.focus(); }, [activeBranchId]);

    // Transaction history for current cashier only
    const loadHistory = useCallback(async () => {
        if (!canPosAction("history")) { toast.error("Tidak punya akses riwayat transaksi"); return; }
        setHistoryLoading(true);
        try {
            const { getTransactions } = await import("@/server/actions/transactions");
            const result = await getTransactions({ limit: 20, ...(session?.user?.id ? { userId: session.user.id } : {}) });
            setHistoryData(result.transactions.map((tx: Record<string, unknown>) => ({
                id: tx.id as string,
                invoiceNumber: tx.invoiceNumber as string,
                grandTotal: tx.grandTotal as number,
                subtotal: tx.subtotal as number,
                discountAmount: (tx.discountAmount as number) || 0,
                taxAmount: (tx.taxAmount as number) || 0,
                paymentAmount: tx.paymentAmount as number,
                changeAmount: (tx.changeAmount as number) || 0,
                status: tx.status as string,
                paymentMethod: tx.paymentMethod as string,
                createdAt: tx.createdAt as string | Date,
                user: tx.user as { name: string },
                payments: (tx.payments as { method: string; amount: number }[]) || [],
                items: ((tx.items as Record<string, unknown>[]) || []).map((i) => ({
                    productName: i.productName as string,
                    quantity: i.quantity as number,
                    unitPrice: i.unitPrice as number,
                    subtotal: i.subtotal as number,
                    ...(i.unitName ? { unitName: i.unitName as string } : {}),
                    ...(i.conversionQty ? { conversionQty: i.conversionQty as number } : {}),
                })),
            })));
        } catch { /* */ }
        setHistoryLoading(false);
        setShowHistoryDialog(true);
    }, [canPosAction]);

    const historyDetail = historyDetailId ? (historyData.find((tx) => tx.id === historyDetailId) ?? null) : null;

    const reprintReceipt = (tx: (typeof historyData)[number]) => {
        if (!canPosAction("reprint")) { toast.error("Tidak punya akses reprint"); return; }
        logPosActivity({ action: "REPRINT", entity: "Transaction", entityId: tx.id, details: { invoiceNumber: tx.invoiceNumber, grandTotal: tx.grandTotal }, branchId: activeBranchId || undefined });
        const payments = tx.payments && tx.payments.length > 1 ? tx.payments.map((p) => ({ method: p.method, amount: p.amount })) : undefined;
        printThermalReceipt({
            invoiceNumber: tx.invoiceNumber,
            date: new Date(tx.createdAt).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
            cashier: tx.user.name,
            items: tx.items.map((i) => ({ name: i.productName, qty: i.quantity, price: i.unitPrice, subtotal: i.subtotal, ...(i.unitName ? { unitName: i.unitName } : {}), ...(i.conversionQty ? { conversionQty: i.conversionQty } : {}) })),
            subtotal: tx.subtotal,
            discount: tx.discountAmount,
            tax: tx.taxAmount,
            grandTotal: tx.grandTotal,
            paymentMethod: tx.paymentMethod,
            paymentAmount: tx.paymentAmount,
            change: tx.changeAmount,
            payments,
            ...(receiptConfig?.storeName ? { storeName: receiptConfig.storeName } : {}),
            ...(receiptConfig?.storeAddress ? { storeAddress: receiptConfig.storeAddress } : {}),
            ...(receiptConfig?.storePhone ? { storePhone: receiptConfig.storePhone } : {}),
            ...(receiptConfig?.footerText ? { footerText: receiptConfig.footerText } : {}),
        });
    };

    const handleVoid = async () => {
        if (!canPosAction("void")) { toast.error("Tidak punya akses void transaksi"); return; }
        if (!voidingId || !voidReason.trim()) { toast.error("Alasan void wajib diisi"); return; }
        try {
            const { voidTransaction } = await import("@/server/actions/transactions");
            const result = await voidTransaction(voidingId, voidReason);
            if (result.error) { toast.error(result.error); return; }
            toast.success("Transaksi berhasil di-void");
            setShowVoidDialog(false);
            setVoidingId(""); setVoidReason("");
            loadHistory(); // refresh
        } catch { toast.error("Gagal void transaksi"); }
    };

    // Save current scroll position + data to cache before switching category
    const saveCategoryCache = () => {
        const cacheKey = selectedCategory || "__all__";
        productCacheRef.current.set(cacheKey, {
            items: browseItems,
            page: browsePage,
            hasMore: browseHasMore,
            scrollTop: productScrollRef.current?.scrollTop ?? 0,
        });
        persistCache();
    };

    // Restore from cache if available, returns true if restored
    const restoreCategoryCache = (catId?: string): boolean => {
        const cacheKey = catId || "__all__";
        const cached = productCacheRef.current.get(cacheKey);
        if (cached && cached.items.length > 0) {
            setBrowseItems(cached.items);
            setBrowsePage(cached.page);
            setBrowseHasMore(cached.hasMore);
            // Restore scroll position after render
            requestAnimationFrame(() => {
                if (productScrollRef.current) {
                    productScrollRef.current.scrollTop = cached.scrollTop;
                }
            });
            return true;
        }
        return false;
    };

    const loadProducts = useCallback(async (_mode?: string, catId?: string, page = 1, reset = true, branchId?: string) => {
        if (browseLoading) return;
        setBrowseLoading(true);
        try {
            const result = await browseProducts({
                mode: catId ? "category" : "all",
                page,
                perPage: 20,
                branchId: branchId ?? activeBranchId,
                ...(catId ? { categoryId: catId } : {}),
            });
            const newItems = result.products.map((item) => toProductSearchResult(item as RawPosProduct));
            if (reset) {
                setBrowseItems(newItems);
            } else {
                setBrowseItems((prev) => {
                    const merged = [...prev, ...newItems];
                    return merged;
                });
            }
            setBrowsePage(page);
            setBrowseHasMore(result.hasMore);

            // Update cache for current category
            const cacheKey = catId || "__all__";
            setBrowseItems((current) => {
                productCacheRef.current.set(cacheKey, {
                    items: current,
                    page,
                    hasMore: result.hasMore,
                    scrollTop: productScrollRef.current?.scrollTop ?? 0,
                });
                persistCache();
                // Also save to IndexedDB for offline
                import("@/lib/offline-product-cache").then(({ setCacheData }) => {
                    setCacheData(`pos-browse-${cacheKey}`, { items: current, page, hasMore: result.hasMore }).catch(() => {});
                }).catch(() => {});
                return current;
            });
        } catch {
            // Offline fallback: load from IndexedDB cache
            try {
                const offCacheKey = catId || "__all__";
                const { getCacheData } = await import("@/lib/offline-product-cache");
                const cached = await getCacheData<{ items: ProductSearchResult[]; page: number; hasMore: boolean }>(`pos-browse-${offCacheKey}`);
                if (cached) {
                    setBrowseItems(cached.items);
                    setBrowsePage(cached.page);
                    setBrowseHasMore(false); // Don't try to load more pages offline
                }
            } catch { /**/ }
        }
        setBrowseLoading(false);
    }, [activeBranchId, browseLoading]);

    const syncProducts = async () => {
        setProductSyncing(true);
        try {
            // Clear all caches
            productCacheRef.current.clear();
            try { sessionStorage.removeItem(POS_PRODUCT_CACHE_KEY); } catch { /* */ }
            // Reload from server
            await loadProducts("all", selectedCategory || undefined, 1, true);
            toast.success("Data produk berhasil disinkronkan");
        } catch {
            toast.error("Gagal menyinkronkan data produk");
        }
        setProductSyncing(false);
    };

    // Restore scroll position from cache on mount
    useEffect(() => {
        if (initCache && initCache.scrollTop > 0 && !initialScrollRestored.current) {
            initialScrollRestored.current = true;
            requestAnimationFrame(() => {
                if (productScrollRef.current) {
                    productScrollRef.current.scrollTop = initCache.scrollTop;
                }
            });
        }
    }, [initCache]);

    useEffect(() => {
        const initialize = async () => {
          // Restore local state immediately (no server call)
          const savedTerminal = localStorage.getItem(POS_TERMINAL_KEY);
          let savedRegister = "";
          if (savedTerminal) {
              try {
                  const parsed = JSON.parse(savedTerminal) as { branchId?: string; register?: string };
                  if (parsed.register) {
                      savedRegister = parsed.register;
                      setSelectedRegister(parsed.register);
                      setSetupValue("register", parsed.register, { shouldValidate: true });
                  }
              } catch { }
          }
          const savedCart = localStorage.getItem(STORAGE_KEY);
          if (savedCart) { try { const p = JSON.parse(savedCart); if (Array.isArray(p) && p.length > 0) { setCart(p); toast.info("Draft dipulihkan"); } } catch { /**/ } }

          try {
            // Critical data — load in parallel, needed before UI is usable
            const [categoryData, branchData, shiftData, posCfg, alreadyClosed] = await Promise.all([
                getAllCategories(),
                getAllBranches(),
                getActiveShift(),
                getPosConfig(),
                hasClosedShiftToday(),
            ]);
            const activeBranches = branchData.filter((branch) => branch.isActive);
            const mappedCategories = categoryData.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }));
            setCategories(mappedCategories);
            setBranches(activeBranches);
            setPosConfig(posCfg);
            setClosedToday(alreadyClosed);
            if (posCfg.defaultTaxPercent !== undefined) setTaxPercent(posCfg.defaultTaxPercent);
            if (shiftData) {
                setActiveShift({ id: shiftData.id, openingCash: shiftData.openingCash, openedAt: shiftData.openedAt });
            }

            // Setup branch/session
            if (sidebarBranchId && activeBranches.some((branch) => branch.id === sidebarBranchId)) {
                setSelectedBranchId(sidebarBranchId);
                setSetupValue("branchId", sidebarBranchId, { shouldValidate: true });
                if (savedRegister) setSessionStarted(true);
            } else {
                setSelectedBranchId("");
                setSetupValue("branchId", "", { shouldValidate: true });
                setSessionStarted(false);
            }
            barcodeInputRef.current?.focus();

            // Non-critical data — load in background AFTER UI is rendered
            const bid = activeBranchId || sidebarBranchId || undefined;
            getReceiptConfig().then((cfg) => setReceiptConfig(cfg)).catch(() => {});
            if (posCfg.businessMode === "restaurant" || posCfg.businessMode === "cafe") {
                import("@/server/actions/tables").then(({ getTables }) => {
                    getTables(bid).then((t) => setTables(t as typeof tables)).catch(() => {});
                }).catch(() => {});
            }
            import("@/server/actions/bundles").then(({ getActiveBundles }) => {
                getActiveBundles(bid).then((b) => setBundles(b as any)).catch(() => {});
            }).catch(() => {});
            import("@/lib/offline-product-cache").then(({ setCacheData }) => {
                setCacheData("pos-categories", mappedCategories).catch(() => {});
                setCacheData("pos-config", posCfg).catch(() => {});
                setCacheData("pos-branches", activeBranches).catch(() => {});
            }).catch(() => {});
          } catch {
            // Offline fallback
            try {
                const { getCacheData } = await import("@/lib/offline-product-cache");
                const [cachedCategories, cachedConfig, cachedBranches] = await Promise.all([
                    getCacheData<{ id: string; name: string }[]>("pos-categories"),
                    getCacheData<typeof posConfig>("pos-config"),
                    getCacheData<typeof branches>("pos-branches"),
                ]);
                if (cachedCategories) setCategories(cachedCategories);
                if (cachedConfig) { setPosConfig(cachedConfig as any); if ((cachedConfig as any)?.defaultTaxPercent !== undefined) setTaxPercent((cachedConfig as any).defaultTaxPercent); }
                if (cachedBranches) setBranches(cachedBranches as any);
                toast.info("Mode offline — menggunakan data cache", { duration: 3000 });
            } catch {
                toast.error("Gagal memuat data. Periksa koneksi internet.");
            }
          }
        };
        initialize();
    }, [setSetupValue, sidebarBranchId, userBranchId]);

    useEffect(() => {
        if (!sidebarBranchId) return;
        if (selectedBranchId === sidebarBranchId) return;
        setSelectedBranchId(sidebarBranchId);
        setSetupValue("branchId", sidebarBranchId, { shouldValidate: true });
    }, [selectedBranchId, setSetupValue, sidebarBranchId]);

    useEffect(() => {
        const syncViewportMode = () => setIsDesktop(window.innerWidth >= 1024);
        syncViewportMode();
        window.addEventListener("resize", syncViewportMode);
        return () => window.removeEventListener("resize", syncViewportMode);
    }, []);

    useEffect(() => {
        if (!isDesktop) return;
        const { minLeft, maxLeft } = getLeftPanelBounds();
        setLeftPanelWidth((prev) => Math.min(maxLeft, Math.max(minLeft, prev)));
    }, [getLeftPanelBounds, isDesktop]);

    useEffect(() => {
        if (!centerPanelRef.current) return;
        const observer = new ResizeObserver((entries) => {
            const width = entries[0]?.contentRect.width ?? 0;
            setCenterPanelWidth(width);
        });
        observer.observe(centerPanelRef.current);
        return () => observer.disconnect();
    }, []);

    // Realtime config sync — reload POS/Receipt config when changed from settings page
    const reloadConfig = useCallback(async () => {
        try {
            const bid = activeBranchId || undefined;
            const [posCfg, receiptCfg] = await Promise.all([
                getPosConfig(bid),
                getReceiptConfig(bid),
            ]);
            setPosConfig(posCfg);
            setReceiptConfig(receiptCfg);
            if (posCfg.defaultTaxPercent !== undefined) setTaxPercent(posCfg.defaultTaxPercent);
            // Load tables when restaurant/cafe mode
            if (posCfg.businessMode === "restaurant" || posCfg.businessMode === "cafe") {
                import("@/server/actions/tables").then(({ getTables }) => {
                    getTables(bid).then((t) => setTables(t as typeof tables)).catch(() => {});
                }).catch(() => {});
            } else {
                setTables([]);
            }
            toast.info("Konfigurasi POS diperbarui", { duration: 2000 });
        } catch { /* silent */ }
    }, [activeBranchId]); // removed `tables` dep — not needed, causes unnecessary re-creates
    useConfigRealtime(reloadConfig, activeBranchId || undefined);

    // Load tables when posConfig changes to restaurant/cafe mode
    useEffect(() => {
        if (posConfig?.showTableNumber && tables.length === 0) {
            import("@/server/actions/tables").then(({ getTables }) => {
                getTables(activeBranchId || undefined).then((t) => setTables(t as typeof tables)).catch(() => { });
            }).catch(() => { });
        }
    }, [posConfig?.showTableNumber, activeBranchId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Infinite scroll observer
    useEffect(() => {
        const sentinel = productSentinelRef.current;
        const scrollRoot = productScrollRef.current;
        if (!sentinel || !scrollRoot || !browseHasMore || browseLoading) return;
        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (entry && entry.isIntersecting) {
                    loadProducts(productTab, selectedCategory || undefined, browsePage + 1, false);
                }
            },
            { root: scrollRoot, rootMargin: "100px", threshold: 0.1 }
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [browseHasMore, browseLoading, browsePage, loadProducts, productTab, selectedCategory]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                if (e.key === "Escape") { (e.target as HTMLElement).blur(); barcodeInputRef.current?.focus(); return; }
                if (!e.key?.startsWith("F")) return;

            }
            switch (e.key) {
                case "F1": e.preventDefault(); setShowSearchDialog(true); break;
                case "F2": e.preventDefault(); if (!canPosAction("hold")) { toast.error("Fitur Hold memerlukan upgrade plan"); return; } if (cart.length === 0) { toast.error("Keranjang kosong"); } else { setHoldInputLabel(customerName.trim()); setShowHoldInputDialog(true); } break;
                case "F3": e.preventDefault(); openPaymentDialog(); break;
                case "F4": e.preventDefault(); resetPOS(); break;
                case "F5": e.preventDefault(); if (!canPosAction("discount")) { toast.error("Fitur Diskon memerlukan upgrade plan"); return; } setShowDiscountDialog(true); break;
                case "F6": e.preventDefault(); if (!canPosAction("history")) { toast.error("Fitur Riwayat memerlukan upgrade plan"); return; } loadHistory(); break;
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [canPosAction, holdTransaction, loadHistory, openPaymentDialog, resetPOS]);

    const handleCategoryClick = (catId: string) => {
        saveCategoryCache();
        setSelectedCategory(catId);
        if (!restoreCategoryCache(catId)) {
            loadProducts("category", catId, 1, true);
        }
    };

    const handleStartSession = () => {
        void handleSetupSubmit(async (values) => {
            const branchId = values.branchId;
            const register = values.register.trim();
            const openingValue = Number(values.openingCash || 0);
            setSelectedBranchId(branchId);
            setSidebarBranchId(branchId);
            setSelectedRegister(register);
            if (!activeShift) {
                setStartingShift(true);
                const formData = new FormData();
                formData.set("openingCash", String(openingValue));
                formData.set("branchId", branchId);
                const result = await openShift(formData);
                setStartingShift(false);
                if (result.error) {
                    const latestShift = await getActiveShift();
                    if (latestShift) {
                        setActiveShift({ id: latestShift.id, openingCash: latestShift.openingCash, openedAt: latestShift.openedAt });
                        toast.warning("Shift aktif ditemukan, melanjutkan sesi yang sudah terbuka");
                    } else {
                        toast.error(result.error);
                        return;
                    }
                }
                const shiftData = await getActiveShift();
                if (shiftData && !activeShift) {
                    setActiveShift({ id: shiftData.id, openingCash: shiftData.openingCash, openedAt: shiftData.openedAt });
                }
                if (!result.error) {
                    toast.success("Shift kasir dibuka");
                }
            }
            localStorage.setItem(POS_TERMINAL_KEY, JSON.stringify({ branchId, register }));
            setSelectedCategory("");
            if (!restoreCategoryCache()) {
                await loadProducts("all", undefined, 1, true, branchId);
            }
            setSessionStarted(true);
            barcodeInputRef.current?.focus();
        }, (formErrors) => {
            const firstError = formErrors.branchId?.message || formErrors.register?.message || formErrors.openingCash?.message;
            if (firstError) {
                toast.error(firstError);
            }
        })();
    };

    const handleCloseShift = async () => {
        if (!activeShift) return;
        const closing = Number(closingCash);
        if (Number.isNaN(closing) || closing < 0) {
            toast.error("Nominal closing tidak valid");
            return;
        }
        setClosingShiftLoading(true);
        const formData = new FormData();
        formData.set("closingCash", String(closing));
        formData.set("notes", closingNotes);
        const result = await closeShift(activeShift.id, formData);
        setClosingShiftLoading(false);
        if (result.error) {
            toast.error(result.error);
            return;
        }
        setShowClosingDialog(false);
        setActiveShift(null);
        localStorage.removeItem(POS_TERMINAL_KEY);
        setSessionStarted(false);
        resetPOS();
        toast.success("Shift berhasil ditutup");
    };

    const handlePrintSuccess = useCallback(() => {
        if (!success) return;
        const pn = appliedPromos.map((p) => p.promoName);
        if (voucherApplied) pn.push(voucherApplied);
        printThermalReceipt({
            invoiceNumber: success,
            date: new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
            cashier: "Kasir",
            items: cart.map((c) => ({ name: c.conversionQty && c.conversionQty > 1 ? `${c.productName} (${c.unitName})` : c.productName, qty: c.quantity, price: c.unitPrice, subtotal: c.subtotal })),
            subtotal,
            discount: discountAmount,
            tax: taxAmount,
            grandTotal,
            paymentMethod,
            paymentAmount: totalPaid,
            change: changeAmount > 0 ? changeAmount : 0,
            payments: (() => {
                if (paymentEntries.length === 0 && !payment) return undefined;
                const map = new Map<string, number>();
                for (const e of paymentEntries) map.set(e.method, (map.get(e.method) ?? 0) + e.amount);
                if (payment > 0) map.set(paymentMethod, (map.get(paymentMethod) ?? 0) + payment);
                if (map.size <= 1) return undefined;
                return Array.from(map.entries()).map(([method, amount]) => ({ method, amount }));
            })(),
            ...(detectedCustomer?.name ? { customer: detectedCustomer.name } : {}),
            ...(detectedCustomer?.memberLevel ? { memberLevel: detectedCustomer.memberLevel } : {}),
            ...(pn.length > 0 ? { promos: pn } : {}),
            ...(receiptConfig?.storeName ? { storeName: receiptConfig.storeName } : {}),
            ...(receiptConfig?.storeAddress ? { storeAddress: receiptConfig.storeAddress } : {}),
            ...(receiptConfig?.storePhone ? { storePhone: receiptConfig.storePhone } : {}),
            ...(receiptConfig?.headerText ? { headerText: receiptConfig.headerText } : {}),
            ...(receiptConfig?.footerText ? { footerText: receiptConfig.footerText } : {}),
            ...(receiptConfig?.thankYouMessage ? { thankYouMessage: receiptConfig.thankYouMessage } : {}),
            ...(receiptConfig ? {
                showPointInfo: receiptConfig.showPointInfo,
                showCashierName: receiptConfig.showCashierName,
                showDateTime: receiptConfig.showDateTime,
                showPaymentMethod: receiptConfig.showPaymentMethod,
                paperWidth: receiptConfig.paperWidth,
            } : {}),
        });
    }, [appliedPromos, cart, changeAmount, detectedCustomer?.memberLevel, detectedCustomer?.name, discountAmount, grandTotal, payment, paymentEntries, paymentMethod, receiptConfig, subtotal, success, taxAmount, totalPaid, voucherApplied]);


    if (!isPosReady) {
        return (
            <PosScreenProvider value={{
                activeBranchName,
                setupRegister,
                setupErrors,
                setSelectedRegister,
                activeShift,
                closedToday,
                openingCash,
                setOpeningCash,
                onBack: () => router.push("/dashboard"),
                onStartSession: handleStartSession,
                startingShift,
            }}>
                <PosReadySection />
            </PosScreenProvider>
        );
    }

    if (success) {
        return (
            <PosScreenProvider value={{
                success,
                grandTotal,
                paymentMethod,
                changeAmount,
                pointsEarnedResult,
                onPrint: handlePrintSuccess,
                onNewTransaction: resetPOS,
            }}>
                <PosSuccessSection />
            </PosScreenProvider>
        );
    }

    // ====== MAIN 3-PANEL LAYOUT ======
    return (
        <div className="flex flex-col h-screen overflow-hidden relative">

            {/* Offline / Sync Banner */}
            {(!isOnline || pendingCount > 0) && (
                <div className={cn(
                    "shrink-0 px-4 py-2 flex items-center justify-between text-xs font-medium z-30",
                    !isOnline ? "bg-orange-50 text-orange-700 border-b border-orange-200" : "bg-blue-50 text-blue-700 border-b border-blue-200"
                )}>
                    <div className="flex items-center gap-2">
                        {!isOnline ? (
                            <><WifiOff className="w-3.5 h-3.5" /> Mode Offline — transaksi disimpan lokal</>
                        ) : (
                            <><Wifi className="w-3.5 h-3.5" /> {pendingCount} transaksi offline menunggu sinkronisasi</>
                        )}
                    </div>
                    {isOnline && pendingCount > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-[10px] rounded-md px-2 border-blue-300 text-blue-700 hover:bg-blue-100"
                            onClick={syncAll}
                            disabled={syncing}
                        >
                            <RefreshCw className={cn("w-3 h-3 mr-1", syncing && "animate-spin")} />
                            {syncing ? "Menyinkronkan..." : "Sinkronkan"}
                        </Button>
                    )}
                </div>
            )}

            <PosPanelsProvider value={{
                panelsContainerRef,
                centerPanelRef,
                productScrollRef,
                productSentinelRef,
                barcodeInputRef,
                isDesktop,
                leftPanelWidth,
                isResizingLeftPanel,
                mobileView,
                setMobileView,
                isOnline,
                activeBranchName,
                selectedRegister,
                activeShift,
                setShiftSummary,
                setClosingCash,
                setClosingNotes,
                setSummaryLoading,
                setShowClosingDialog,
                syncProducts,
                productSyncing,
                setShowShortcutsDialog,
                goDashboard: () => router.push("/dashboard"),
                saveCategoryCache,
                setSelectedCategory,
                restoreCategoryCache,
                loadProducts,
                categories,
                selectedCategory,
                handleCategoryClick,
                productGridCols,
                browseItems,
                addToCart,
                addToCartWithUnit,
                unitSelectorProduct,
                setUnitSelectorProduct,
                handleUnitSelect,
                browseHasMore,
                browseLoading,
                heldTransactions,
                setShowHeldDialog,
                holdTransaction: () => { if (cart.length === 0) { toast.error("Keranjang kosong"); return; } setHoldInputLabel(customerName.trim()); setShowHoldInputDialog(true); },
                canPosAction,
                setShowDiscountDialog,
                setShowSearchDialog,
                loadHistory,
                startResizeLeftPanel,
                searchQuery,
                handleBarcodeInput,
                searchResults,
                searching,
                negativeMarginItems,
                lowStockItems,
                cart,
                totalItems,
                promoMeta,
                isCompactCart,
                updateQuantity,
                setItemQuantity,
                removeItem,
                resetPOS,
                subtotal,
                discountPercent,
                setDiscountPercent,
                discountAmount,
                taxPercent,
                setTaxPercent,
                taxAmount,
                grandTotal,
                appliedPromos,
                tebusMurahOptions,
                handleAddTebusMurah,
                customerName,
                setCustomerName,
                customerPhone,
                handleCustomerPhoneChange,
                detectedCustomer,
                redeemPointsInput,
                setRedeemPointsInput,
                handleRedeemPoints,
                redeemDiscount,
                voucherCode,
                setVoucherCode,
                handleApplyVoucher,
                voucherApplied,
                voucherDiscount,
                loading,
                openPaymentDialog,
                requireCustomer: posConfig?.requireCustomer ?? false,
                businessMode: posConfig?.businessMode ?? "retail",
                selectedTables,
                toggleTable: (table: { id: string; number: number; name: string | null; capacity: number }) => {
                    setSelectedTables((prev) => {
                        const exists = prev.find((t) => t.id === table.id);
                        if (exists) return prev.filter((t) => t.id !== table.id);
                        return [...prev, table];
                    });
                },
                clearTables: () => setSelectedTables([]),
                totalTableCapacity: selectedTables.reduce((s, t) => s + t.capacity, 0),
                tables,
                handleReleaseTable: (tableId: string) => {
                    import("@/server/actions/tables").then(({ releaseTable }) => {
                        releaseTable(tableId).then(() => {
                            import("@/server/actions/tables").then(({ getTables }) => {
                                getTables(activeBranchId || undefined).then((t) => setTables(t as typeof tables)).catch(() => { });
                            });
                            toast.success("Meja dikosongkan");
                        });
                    }).catch(() => toast.error("Gagal mengosongkan meja"));
                },
                showTableNumber: (posConfig?.showTableNumber ?? false) && canPlanAction("pos", "table_select"),
                leftPanelTab,
                setLeftPanelTab,
                bundles,
                addBundleToCart,
                shouldValidateStock,
            }}>
                <POSPagePanels />
            </PosPanelsProvider>

            {/* ====== DIALOGS ====== */}
            <PosDialogsProvider value={{
                showSearchDialog,
                setShowSearchDialog,
                searchProducts,
                activeBranchId,
                setSearchResults,
                searchResults,
                addToCart,
                showClosingDialog,
                setShowClosingDialog,
                activeBranchName,
                selectedRegister,
                activeShift,
                summaryLoading,
                shiftSummary,
                closingCash,
                setClosingCash,
                closingNotes,
                setClosingNotes,
                handleCloseShift,
                closingShiftLoading,
                showHeldDialog,
                setShowHeldDialog,
                heldTransactions,
                resumeTransaction,
                setHeldTransactions,
                showHistoryDialog,
                setShowHistoryDialog,
                historyDetail,
                setHistoryDetailId,
                historyLoading,
                historyData,
                reprintReceipt,
                canPosAction,
                setVoidingId,
                setShowVoidDialog,
                showPaymentDialog,
                setShowPaymentDialog,
                dynamicQuickAmounts,
                payment,
                setPaymentAmount,
                handleCalculatorInput,
                paymentEntries,
                setPaymentEntries,
                remainingToPay,
                paymentMethod,
                setPaymentMethod,
                grandTotal,
                paidFromEntries,
                totalPaid,
                changeAmount,
                loading,
                handlePayment,
                terminConfig,
                setTerminConfig,
                showDiscountDialog,
                setShowDiscountDialog,
                discountType,
                setDiscountType,
                discountPercent,
                setDiscountPercent,
                discountFixed,
                setDiscountFixed,
                subtotal,
                showVoidDialog,
                voidReason,
                setVoidReason,
                handleVoid,
                showShortcutsDialog,
                setShowShortcutsDialog,
            }}>
                <POSPageMainDialogs />
                <DiscountDialog />
                <VoidDialog />
                <ShortcutsDialog />
                {/* Hold Input Dialog */}
                <Dialog open={showHoldInputDialog} onOpenChange={setShowHoldInputDialog}>
                    <DialogContent className="rounded-2xl max-w-xs p-0 overflow-hidden">
                        <div className="px-5 pt-5 pb-4 space-y-3">
                            <DialogHeader>
                                <DialogTitle className="text-base font-bold flex items-center gap-2">
                                    <Pause className="w-4 h-4 text-orange-500" /> Hold Transaksi
                                </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-muted-foreground">Atas nama</Label>
                                <Input
                                    value={holdInputLabel}
                                    onChange={(e) => setHoldInputLabel(e.target.value)}
                                    placeholder="Nama customer / keterangan"
                                    className="rounded-xl h-10"
                                    autoFocus
                                    onKeyDown={(e) => { if (e.key === "Enter") { holdTransaction(holdInputLabel); setShowHoldInputDialog(false); setHoldInputLabel(""); } }}
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowHoldInputDialog(false)}>Batal</Button>
                                <Button className="flex-1 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white" onClick={() => { holdTransaction(holdInputLabel); setShowHoldInputDialog(false); setHoldInputLabel(""); }}>Hold</Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </PosDialogsProvider>
        </div>
    );
}
