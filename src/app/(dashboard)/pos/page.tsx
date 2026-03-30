"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { posService } from "@/features/pos";
import { getShiftSummary } from "@/server/actions/shifts";
import { cn, formatCurrency } from "@/lib/utils";
import { printThermalReceipt } from "@/lib/thermal-receipt";
import { addOfflineTransaction } from "@/lib/offline-queue";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
} from "@/components/ui/dialog";
import {
    ScanBarcode, Plus, Minus, Trash2, ShoppingCart, CreditCard, Loader2,
    Check, Printer, Pause, AlertTriangle, Keyboard, Search,
    ArrowLeft, Store, LogOut, Package, Wallet, Tag, History,
    WifiOff, Wifi, RefreshCw, CloudOff,
} from "lucide-react";
import { toast } from "sonner";
import type { CartItem, ProductSearchResult, Branch } from "@/types";
import type { ReceiptConfig } from "@/lib/receipt-config";

type RawPosProduct = {
    id: string;
    code: string;
    name: string;
    sellingPrice: number;
    purchasePrice: number;
    stock: number;
    minStock: number;
    unit: string;
    imageUrl?: string | null;
    category?: { name: string } | null;
};

function toProductSearchResult(product: RawPosProduct): ProductSearchResult {
    return {
        id: product.id,
        code: product.code,
        name: product.name,
        sellingPrice: product.sellingPrice,
        purchasePrice: product.purchasePrice,
        stock: product.stock,
        minStock: product.minStock,
        unit: product.unit,
        imageUrl: product.imageUrl ?? null,
        category: { name: product.category?.name ?? "" },
    };
}

type PaymentMethodType = "CASH" | "TRANSFER" | "QRIS" | "EWALLET" | "DEBIT" | "CREDIT_CARD";
const STORAGE_KEY = "pos-draft-cart";
const POS_TERMINAL_KEY = "pos-terminal-session";
const PAYMENT_METHOD_OPTIONS: { value: PaymentMethodType; label: string }[] = [
    { value: "CASH", label: "Cash" },
    { value: "TRANSFER", label: "Transfer Bank" },
    { value: "QRIS", label: "QRIS" },
    { value: "EWALLET", label: "E-Wallet" },
    { value: "DEBIT", label: "Debit" },
    { value: "CREDIT_CARD", label: "Kartu Kredit" },
];
const {
    searchProducts,
    findByBarcode,
    browseProducts,
    getAllCategories,
    getAllBranches,
    createTransaction,
    getActiveShift,
    openShift,
    closeShift,
    calculateAutoPromo,
    validateVoucher,
    findCustomerByPhone,
    redeemPoints,
    getReceiptConfig,
} = posService;

const posSessionSetupSchema = z.object({
    branchId: z.string().min(1, "Pilih lokasi terlebih dahulu"),
    register: z.string().trim().min(1, "Isi nama kassa terlebih dahulu"),
    openingCash: z.string().refine(
        (value) => {
            const parsed = Number(value || 0);
            return !Number.isNaN(parsed) && parsed >= 0;
        },
        "Saldo awal tidak valid"
    ),
});
type PosSessionSetupValues = z.infer<typeof posSessionSetupSchema>;

export default function POSPage() {
    const router = useRouter();
    const { data: session } = useSession();
    const userBranchId = (session?.user as { branchId?: string | null } | undefined)?.branchId ?? null;
    const barcodeInputRef = useRef<HTMLInputElement>(null);
    const { isOnline } = useOnlineStatus();
    const { pendingCount, syncing, syncAll, refreshCount } = useOfflineSync(isOnline);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [heldTransactions, setHeldTransactions] = useState<{ id: number; cart: CartItem[]; time: string }[]>([]);
    const [discountPercent, setDiscountPercent] = useState(0);
    const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
    const [discountFixed, setDiscountFixed] = useState(0);
    const [showHistoryDialog, setShowHistoryDialog] = useState(false);
    const [historyData, setHistoryData] = useState<{ id: string; invoiceNumber: string; grandTotal: number; status: string; paymentMethod: string; createdAt: string | Date }[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [voidingId, setVoidingId] = useState("");
    const [voidReason, setVoidReason] = useState("");
    const [showVoidDialog, setShowVoidDialog] = useState(false);
    const [taxPercent, setTaxPercent] = useState(11);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>("CASH");
    const [paymentAmount, setPaymentAmount] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState<string | null>(null);
    const [searching, setSearching] = useState(false);
    const [showSearchDialog, setShowSearchDialog] = useState(false);
    const [showHeldDialog, setShowHeldDialog] = useState(false);
    const [showDiscountDialog, setShowDiscountDialog] = useState(false);
    const [showShortcutsDialog, setShowShortcutsDialog] = useState(false);
    const [showPaymentDialog, setShowPaymentDialog] = useState(false);
    const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState("");
    const [selectedRegister, setSelectedRegister] = useState("");
    const [openingCash, setOpeningCash] = useState("0");
    const [startingShift, setStartingShift] = useState(false);
    const [activeShift, setActiveShift] = useState<{ id: string; openingCash: number; openedAt: string | Date } | null>(null);
    const [showClosingDialog, setShowClosingDialog] = useState(false);
    const [closingCash, setClosingCash] = useState("");
    const [closingNotes, setClosingNotes] = useState("");
    const [shiftSummary, setShiftSummary] = useState<{
        openingCash: number; totalTransactions: number; totalSales: number;
        cashIn: number; cashOut: number; netCash: number; nonCashIn: number;
        expenseAmount: number; expectedCash: number; voidedCount: number;
    } | null>(null);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const {
        control: setupControl,
        register: setupRegister,
        handleSubmit: handleSetupSubmit,
        setValue: setSetupValue,
        formState: { errors: setupErrors },
    } = useForm<PosSessionSetupValues>({
        resolver: zodResolver(posSessionSetupSchema),
        defaultValues: {
            branchId: "",
            register: "",
            openingCash: "0",
        },
    });
    const [closingShiftLoading, setClosingShiftLoading] = useState(false);
    const [sessionStarted, setSessionStarted] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState("");
    // Infinite scroll product panel with persistent cache
    const productScrollRef = useRef<HTMLDivElement>(null);
    const productSentinelRef = useRef<HTMLDivElement>(null);
    const POS_PRODUCT_CACHE_KEY = "pos-product-cache";

    // Load initial state from sessionStorage
    const getPersistedCache = (): Map<string, { items: ProductSearchResult[]; page: number; hasMore: boolean; scrollTop: number }> => {
        try {
            const raw = sessionStorage.getItem(POS_PRODUCT_CACHE_KEY);
            if (raw) return new Map(JSON.parse(raw));
        } catch { /* */ }
        return new Map();
    };
    const productCacheRef = useRef(getPersistedCache());

    const persistCache = () => {
        try {
            sessionStorage.setItem(POS_PRODUCT_CACHE_KEY, JSON.stringify(Array.from(productCacheRef.current.entries())));
        } catch { /* */ }
    };

    // Restore current category from cache on mount
    const initCache = productCacheRef.current.get(selectedCategory || "__all__");
    const [browseItems, setBrowseItems] = useState<ProductSearchResult[]>(initCache?.items ?? []);
    const [browsePage, setBrowsePage] = useState(initCache?.page ?? 1);
    const [browseHasMore, setBrowseHasMore] = useState(initCache?.hasMore ?? true);
    const [browseLoading, setBrowseLoading] = useState(false);
    const initialScrollRestored = useRef(false);
    const [customerPhone, setCustomerPhone] = useState("");
    const [detectedCustomer, setDetectedCustomer] = useState<{ id: string; name: string; phone: string | null; memberLevel: string; points: number; totalSpending: number } | null>(null);
    const [appliedPromos, setAppliedPromos] = useState<{ promoId: string; promoName: string; type: string; discountAmount: number; appliedTo: string }[]>([]);
    const [promoDiscount, setPromoDiscount] = useState(0);
    const [voucherCode, setVoucherCode] = useState("");
    const [voucherDiscount, setVoucherDiscount] = useState(0);
    const [voucherApplied, setVoucherApplied] = useState("");
    const [receiptConfig, setReceiptConfig] = useState<ReceiptConfig | null>(null);
    // Redeem points
    const [redeemPointsInput, setRedeemPointsInput] = useState(0);
    const [redeemDiscount, setRedeemDiscount] = useState(0);
    const [pointsEarnedResult, setPointsEarnedResult] = useState(0);
    // Product panel - no tabs, just category filter
    const [productTab] = useState<"favorites" | "category">("category");
    // Mobile view state
    const [mobileView, setMobileView] = useState<"products" | "cart" | "payment">("products");
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
    const changeAmount = payment - grandTotal;
    const negativeMarginItems = cart.filter((item) => item.unitPrice <= item.purchasePrice);
    const lowStockItems = cart.filter((item) => item.quantity >= item.maxStock - 2);
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
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

    // Load shift summary when closing dialog opens
    useEffect(() => {
        if (!showClosingDialog || !activeShift || !summaryLoading) return;
        let active = true;
        getShiftSummary(activeShift.id)
            .then((summary) => { if (active) { setShiftSummary(summary); setSummaryLoading(false); } })
            .catch(() => { if (active) { toast.error("Gagal memuat ringkasan shift"); setSummaryLoading(false); } });
        return () => { active = false; };
    }, [showClosingDialog, activeShift, summaryLoading]);

    // Effects
    useEffect(() => {
        const run = async () => {
            if (cart.length === 0) { setAppliedPromos([]); setPromoDiscount(0); return; }
            const items = cart.map((c) => ({ productId: c.productId, productName: c.productName, quantity: c.quantity, unitPrice: c.unitPrice, subtotal: c.subtotal }));
            const result = await calculateAutoPromo(items, subtotal);
            setAppliedPromos(result.promos); setPromoDiscount(result.totalDiscount);
        };
        run();
    }, [cart, subtotal]);

    useEffect(() => { if (cart.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(cart)); else localStorage.removeItem(STORAGE_KEY); }, [cart]);

    // Handlers
    const handleCustomerPhoneChange = async (phone: string) => { setCustomerPhone(phone); if (phone.length >= 4) { const c = await findCustomerByPhone(phone); if (c) { setDetectedCustomer(c); toast.success(`Member: ${c.name}`); } else setDetectedCustomer(null); } else setDetectedCustomer(null); };
    const handleApplyVoucher = async () => { if (!voucherCode) return; const r = await validateVoucher(voucherCode, subtotal); if (r.error) toast.error(r.error); else { setVoucherDiscount(r.discount!); setVoucherApplied(r.promoName!); toast.success(`Voucher: -${formatCurrency(r.discount!)}`); } };

    const handleRedeemPoints = async () => {
        if (!detectedCustomer || redeemPointsInput <= 0) return;
        const r = await redeemPoints(detectedCustomer.id, redeemPointsInput);
        if (r.error) { toast.error(r.error); return; }
        setRedeemDiscount(r.discountValue!);
        toast.success(`${redeemPointsInput} poin ditukar = diskon ${formatCurrency(r.discountValue!)}`);
    };

    const addToCart = useCallback((product: ProductSearchResult) => {
        setCart((prev) => {
            const existing = prev.find((i) => i.productId === product.id);
            if (existing) { if (existing.quantity >= product.stock) { toast.error("Stok tidak cukup"); return prev; } return prev.map((i) => i.productId === product.id ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.unitPrice - i.discount } : i); }
            if (product.stock <= product.minStock) toast.warning(`Stok ${product.name} menipis!`);
            if (product.sellingPrice <= product.purchasePrice) toast.warning(`Margin negatif: ${product.name}`);
            return [...prev, { productId: product.id, productName: product.name, productCode: product.code, quantity: 1, unitPrice: product.sellingPrice, purchasePrice: product.purchasePrice, discount: 0, subtotal: product.sellingPrice, maxStock: product.stock }];
        });
        setSearchQuery(""); setSearchResults([]); barcodeInputRef.current?.focus();
    }, []);

    const handleBarcodeInput = useCallback(async (value: string) => {
        setSearchQuery(value); if (value.length < 1) { setSearchResults([]); return; }
        if (/^\d{8,}$/.test(value)) { const p = await findByBarcode(value, activeBranchId); if (p) { addToCart(toProductSearchResult(p as RawPosProduct)); setSearchQuery(""); setSearchResults([]); return; } }
        setSearching(true); const r = await searchProducts(value, activeBranchId); setSearchResults(r.map((item) => toProductSearchResult(item as RawPosProduct))); setSearching(false);
    }, [activeBranchId, addToCart]);

    const updateQuantity = (id: string, d: number) => { setCart((prev) => prev.map((i) => { if (i.productId !== id) return i; const n = i.quantity + d; if (n <= 0 || n > i.maxStock) { if (n > i.maxStock) toast.error("Stok tidak cukup"); return i; } return { ...i, quantity: n, subtotal: n * i.unitPrice - i.discount }; })); };
    const removeItem = (id: string) => setCart((prev) => prev.filter((i) => i.productId !== id));
    const holdTransaction = useCallback(() => { if (cart.length === 0) { toast.error("Keranjang kosong"); return; } setHeldTransactions((p) => [...p, { id: Date.now(), cart: [...cart], time: new Date().toLocaleTimeString("id-ID") }]); setCart([]); localStorage.removeItem(STORAGE_KEY); toast.success("Transaksi ditahan"); }, [cart]);
    const resumeTransaction = (id: number) => { const h = heldTransactions.find((x) => x.id === id); if (!h) return; if (cart.length > 0) holdTransaction(); setCart(h.cart); setHeldTransactions((p) => p.filter((x) => x.id !== id)); setShowHeldDialog(false); toast.success("Dilanjutkan"); };
    const openPaymentDialog = useCallback(() => {
        if (cart.length === 0) { toast.error("Keranjang kosong"); return; }
        if (paymentMethod === "CASH" && !paymentAmount) setPaymentAmount(String(grandTotal));
        if (paymentMethod !== "CASH") setPaymentAmount(String(grandTotal));
        setShowPaymentDialog(true);
    }, [cart.length, grandTotal, paymentAmount, paymentMethod]);
    const handleCalculatorInput = (key: string) => {
        if (key === "CLEAR") { setPaymentAmount(""); return; }
        if (key === "BACKSPACE") { setPaymentAmount((prev) => prev.slice(0, -1)); return; }
        setPaymentAmount((prev) => {
            const next = `${prev}${key}`.replace(/^0+(?=\d)/, "");
            return next;
        });
    };

    const handlePayment = async () => {
        if (cart.length === 0 || (paymentMethod === "CASH" && payment < grandTotal)) { toast.error(cart.length === 0 ? "Keranjang kosong" : "Pembayaran kurang"); return; }
        setLoading(true);
        const pn = appliedPromos.map((p) => p.promoName); if (voucherApplied) pn.push(voucherApplied);
        const payload = {
            items: cart.map((item) => ({ productId: item.productId, productName: item.productName, productCode: item.productCode, quantity: item.quantity, unitPrice: item.unitPrice, discount: item.discount, subtotal: item.subtotal })),
            subtotal,
            discountAmount,
            taxAmount,
            grandTotal,
            paymentMethod,
            paymentAmount: paymentMethod === "CASH" ? payment : grandTotal,
            changeAmount: paymentMethod === "CASH" ? changeAmount : 0,
            ...(detectedCustomer?.id ? { customerId: detectedCustomer.id } : {}),
            ...(pn.length > 0 ? { promoApplied: pn.join(", ") } : {}),
            ...(redeemDiscount > 0 ? { redeemPoints: redeemPointsInput } : {}),
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
        setLoading(false); if (r.error) toast.error(r.error); else { setShowPaymentDialog(false); setSuccess(r.invoiceNumber!); setPointsEarnedResult(r.pointsEarned || 0); localStorage.removeItem(STORAGE_KEY); }
    };

    const resetPOS = useCallback(() => { setCart([]); setDiscountPercent(0); setDiscountFixed(0); setDiscountType("percent"); setPaymentAmount(""); setSuccess(null); setSearchQuery(""); setSearchResults([]); setCustomerPhone(""); setDetectedCustomer(null); setAppliedPromos([]); setPromoDiscount(0); setVoucherCode(""); setVoucherDiscount(0); setVoucherApplied(""); setRedeemPointsInput(0); setRedeemDiscount(0); setPointsEarnedResult(0); localStorage.removeItem(STORAGE_KEY); barcodeInputRef.current?.focus(); }, []);

    // Transaction history for this shift
    const loadHistory = async () => {
        setHistoryLoading(true);
        try {
            const { getTransactions } = await import("@/server/actions/transactions");
            const result = await getTransactions({ limit: 20 });
            setHistoryData(result.transactions.map((tx: { id: string; invoiceNumber: string; grandTotal: number; status: string; paymentMethod: string; createdAt: string | Date }) => ({
                id: tx.id, invoiceNumber: tx.invoiceNumber, grandTotal: tx.grandTotal,
                status: tx.status, paymentMethod: tx.paymentMethod, createdAt: tx.createdAt,
            })));
        } catch { /* */ }
        setHistoryLoading(false);
        setShowHistoryDialog(true);
    };

    const handleVoid = async () => {
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
                return current;
            });
        } catch { /**/ }
        setBrowseLoading(false);
    }, [activeBranchId, browseLoading]);

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
            const [categoryData, branchData, shiftData, receiptCfg] = await Promise.all([
                getAllCategories(),
                getAllBranches(),
                getActiveShift(),
                getReceiptConfig(),
            ]);
            const activeBranches = branchData.filter((branch) => branch.isActive);
            setCategories(categoryData.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
            setBranches(activeBranches);
            setReceiptConfig(receiptCfg);
            if (shiftData) {
                setActiveShift({ id: shiftData.id, openingCash: shiftData.openingCash, openedAt: shiftData.openedAt });
            }
            const savedTerminal = localStorage.getItem(POS_TERMINAL_KEY);
            if (savedTerminal) {
                try {
                    const parsed = JSON.parse(savedTerminal) as { branchId?: string; register?: string };
                    if (parsed.branchId) setSelectedBranchId(parsed.branchId);
                    if (parsed.branchId) setSetupValue("branchId", parsed.branchId, { shouldValidate: true });
                    if (parsed.register) setSelectedRegister(parsed.register);
                    if (parsed.register) setSetupValue("register", parsed.register, { shouldValidate: true });
                    if (parsed.branchId && parsed.register) setSessionStarted(true);
                } catch { }
            } else if (userBranchId) {
                setSelectedBranchId(userBranchId);
                setSetupValue("branchId", userBranchId, { shouldValidate: true });
            } else if (activeBranches[0]) {
                setSelectedBranchId(activeBranches[0].id);
                setSetupValue("branchId", activeBranches[0].id, { shouldValidate: true });
            }
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) { try { const p = JSON.parse(saved); if (Array.isArray(p) && p.length > 0) { setCart(p); toast.info("Draft dipulihkan"); } } catch { /**/ } }
            barcodeInputRef.current?.focus();
        };
        initialize();
    }, [setSetupValue, userBranchId]);

    // Infinite scroll observer
    useEffect(() => {
        const sentinel = productSentinelRef.current;
        const scrollRoot = productScrollRef.current;
        if (!sentinel || !scrollRoot) return;
        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (entry && entry.isIntersecting && browseHasMore && !browseLoading) {
                    loadProducts(productTab, selectedCategory || undefined, browsePage + 1, false);
                }
            },
            { root: scrollRoot, threshold: 0.1 }
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [browseHasMore, browseLoading, browsePage, loadProducts, productTab, selectedCategory]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                if (e.key === "Escape") { (e.target as HTMLElement).blur(); barcodeInputRef.current?.focus(); return; }
                if (!e.key.startsWith("F")) return;
            }
            switch (e.key) {
                case "F1": e.preventDefault(); setShowSearchDialog(true); break;
                case "F2": e.preventDefault(); holdTransaction(); break;
                case "F3": e.preventDefault(); openPaymentDialog(); break;
                case "F4": e.preventDefault(); resetPOS(); break;
                case "F5": e.preventDefault(); setShowDiscountDialog(true); break;
                case "F6": e.preventDefault(); loadHistory(); break;
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [holdTransaction, openPaymentDialog, resetPOS]);

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
            setSelectedRegister(register);
            if (!activeShift) {
                setStartingShift(true);
                const formData = new FormData();
                formData.set("openingCash", String(openingValue));
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


    if (!isPosReady) {
        return (
            <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center p-6">
                <div className="w-full max-w-xl bg-white rounded-2xl border border-border/40 shadow-sm p-6 space-y-5">
                    <div className="space-y-1">
                        <h2 className="text-xl font-bold">Mulai Sesi Kasir</h2>
                        <p className="text-sm text-muted-foreground">Pilih lokasi dan kassa sebelum memulai transaksi.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Lokasi</Label>
                            <Controller
                                control={setupControl}
                                name="branchId"
                                render={({ field }) => (
                                    <Select
                                        {...(field.value ? { value: field.value } : {})}
                                        onValueChange={(value) => {
                                            field.onChange(value);
                                            setSelectedBranchId(value);
                                        }}
                                    >
                                        <SelectTrigger className="h-10 rounded-lg">
                                            <SelectValue placeholder="Pilih lokasi" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {branches.map((branch) => (
                                                <SelectItem key={branch.id} value={branch.id}>
                                                    {branch.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                            {setupErrors.branchId?.message && <p className="text-xs text-red-500">{setupErrors.branchId.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label>Kassa</Label>
                            <Input
                                {...setupRegister("register")}
                                onChange={(e) => {
                                    setupRegister("register").onChange(e);
                                    setSelectedRegister(e.target.value);
                                }}
                                placeholder="Contoh: Kassa 1"
                                className="rounded-lg"
                            />
                            {setupErrors.register?.message && <p className="text-xs text-red-500">{setupErrors.register.message}</p>}
                        </div>
                    </div>
                    {!activeShift && (
                        <div className="space-y-2">
                            <Label>Saldo Awal</Label>
                            <Input
                                type="number"
                                min={0}
                                {...setupRegister("openingCash")}
                                value={openingCash}
                                onChange={(e) => {
                                    setupRegister("openingCash").onChange(e);
                                    setOpeningCash(e.target.value);
                                }}
                                placeholder="0"
                                className="rounded-lg"
                            />
                            {setupErrors.openingCash?.message && <p className="text-xs text-red-500">{setupErrors.openingCash.message}</p>}
                        </div>
                    )}
                    {activeShift && (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                            Shift aktif ditemukan. Pilih lokasi dan kassa untuk melanjutkan transaksi.
                        </div>
                    )}
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => router.push("/dashboard")} className="rounded-lg">Kembali</Button>
                        <Button onClick={handleStartSession} className="rounded-lg" disabled={startingShift}>
                            {startingShift ? "Memproses..." : activeShift ? "Lanjutkan" : "Mulai Shift"}
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="flex items-center justify-center h-screen bg-[#F1F5F9]">
                <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-10 text-center space-y-6">
                    <div className={cn("w-20 h-20 rounded-full flex items-center justify-center mx-auto", success?.startsWith("OFFLINE-") ? "bg-orange-50" : "bg-emerald-50")}>
                        {success?.startsWith("OFFLINE-") ? <CloudOff className="w-10 h-10 text-orange-500" /> : <Check className="w-10 h-10 text-emerald-500" />}
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold">{success?.startsWith("OFFLINE-") ? "Tersimpan Offline" : "Transaksi Berhasil!"}</h2>
                        <p className="text-muted-foreground mt-1 font-mono text-sm">{success}</p>
                        {success?.startsWith("OFFLINE-") && <p className="text-xs text-orange-500 mt-1">Akan disinkronkan saat online</p>}
                    </div>
                    <div className="text-4xl font-bold text-primary tabular-nums">{formatCurrency(grandTotal)}</div>
                    {paymentMethod === "CASH" && changeAmount > 0 && (<div className="bg-amber-50 rounded-xl p-4"><p className="text-sm text-amber-600">Kembalian</p><p className="text-2xl font-bold text-amber-700 tabular-nums">{formatCurrency(changeAmount)}</p></div>)}
                    {pointsEarnedResult > 0 && (
                        <div className="bg-purple-50 rounded-xl p-3 flex items-center justify-center gap-2">
                            <span className="text-sm text-purple-600">Poin didapat:</span>
                            <span className="text-lg font-bold text-purple-700">+{pointsEarnedResult} poin</span>
                        </div>
                    )}
                    <div className="flex gap-3">
                        <Button variant="outline" className="flex-1 rounded-xl h-12" onClick={() => {
                            const pn = appliedPromos.map((p) => p.promoName); if (voucherApplied) pn.push(voucherApplied);
                            printThermalReceipt({
                                invoiceNumber: success!,
                                date: new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
                                cashier: "Kasir",
                                items: cart.map((c) => ({ name: c.productName, qty: c.quantity, price: c.unitPrice, subtotal: c.subtotal })),
                                subtotal,
                                discount: discountAmount,
                                tax: taxAmount,
                                grandTotal,
                                paymentMethod,
                                paymentAmount: paymentMethod === "CASH" ? payment : grandTotal,
                                change: paymentMethod === "CASH" ? changeAmount : 0,
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
                        }}><Printer className="w-4 h-4 mr-2" /> Cetak Struk</Button>
                        <Button className="flex-1 rounded-xl h-12 text-base" onClick={resetPOS}>Transaksi Baru</Button>
                    </div>
                </div>
            </div>
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

            <div className="flex flex-1 min-h-0 relative">

                {/* ============================================ */}
                {/* LEFT PANEL: Products */}
                {/* ============================================ */}
                <div className={cn(
                    "bg-white border-r border-border/40 flex flex-col shrink-0",
                    "w-full lg:w-[320px]",
                    "absolute inset-0 lg:relative lg:inset-auto",
                    "pb-16 lg:pb-0",
                    mobileView === "products" ? "z-10 flex" : "z-0 hidden lg:flex"
                )}>
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => router.push("/dashboard")}>
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                        <div className="text-center">
                            <div className="flex items-center justify-center gap-1.5">
                                <h2 className="font-bold text-sm text-foreground">POS Kasir</h2>
                                {!isOnline && <CloudOff className="w-3.5 h-3.5 text-orange-500" />}
                            </div>
                            <p className="text-[10px] text-muted-foreground">{activeBranchName} • {selectedRegister}</p>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => {
                                if (activeShift) {
                                    setShiftSummary(null);
                                    setClosingCash("");
                                    setClosingNotes("");
                                    setSummaryLoading(true);
                                    setShowClosingDialog(true);
                                }
                            }}>
                                <LogOut className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setShowShortcutsDialog(true)}>
                                <Keyboard className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Category filter chips - always visible */}
                    <div className="px-3 py-2 shrink-0 border-b border-border/20">
                        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                            <button onClick={() => { saveCategoryCache(); setSelectedCategory(""); if (!restoreCategoryCache()) loadProducts("all", undefined, 1, true); }}
                                className={`text-[11px] px-3 py-1.5 rounded-full transition-all border whitespace-nowrap shrink-0
                                ${!selectedCategory ? "bg-primary text-primary-foreground border-primary" : "border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}>
                                Semua
                            </button>
                            {categories.map((c) => (
                                <button key={c.id} onClick={() => handleCategoryClick(c.id)}
                                    className={`text-[11px] px-3 py-1.5 rounded-full transition-all border whitespace-nowrap shrink-0
                                    ${selectedCategory === c.id ? "bg-primary text-primary-foreground border-primary" : "border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}>
                                    {c.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Product Grid with Infinite Scroll */}
                    <div ref={productScrollRef} className="flex-1 overflow-y-auto px-3 pb-3">
                        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-2 gap-2 pt-2">
                            {browseItems.map((p) => (
                                <button key={p.id} onClick={() => addToCart(p as ProductSearchResult)}
                                    className="text-left rounded-xl border border-border/40 hover:border-primary/50 hover:shadow-sm transition-all group bg-white active:scale-[0.97] overflow-hidden">
                                    {p.imageUrl ? (
                                        <div className="relative aspect-square w-full bg-muted/10">
                                            <Image src={p.imageUrl} alt={p.name} fill className="object-cover" sizes="(max-width: 1024px) 33vw, 20vw" />
                                        </div>
                                    ) : (
                                        <div className="aspect-square w-full bg-muted/20 flex items-center justify-center">
                                            <span className="text-2xl font-bold text-muted-foreground/20">{p.name.charAt(0)}</span>
                                        </div>
                                    )}
                                    <div className="p-2.5">
                                        <p className="text-xs font-medium truncate group-hover:text-primary transition-colors leading-tight">{p.name}</p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">Stok: {p.stock}</p>
                                        <p className="text-sm text-primary font-bold mt-0.5 tabular-nums">{formatCurrency(p.sellingPrice)}</p>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Infinite scroll sentinel */}
                        {browseHasMore && (
                            <div ref={productSentinelRef} className="flex justify-center py-4">
                                {browseLoading && <Loader2 className="w-5 h-5 animate-spin text-primary/40" />}
                            </div>
                        )}

                        {browseItems.length === 0 && !browseLoading && (
                            <div className="py-10 text-center text-xs text-muted-foreground">
                                Tidak ada produk ditemukan
                            </div>
                        )}

                        {!browseHasMore && browseItems.length > 0 && (
                            <p className="text-center text-[10px] text-muted-foreground/50 py-3">Semua produk ditampilkan</p>
                        )}
                    </div>

                    {/* Shortcut Bar - desktop */}
                    <div className="px-3 py-2 border-t border-border/30 hidden lg:flex gap-1">
                        {[
                            { key: "F1", label: "Cari", action: () => setShowSearchDialog(true) },
                            { key: "F2", label: heldTransactions.length > 0 ? `Hold (${heldTransactions.length})` : "Hold", action: () => heldTransactions.length > 0 ? setShowHeldDialog(true) : holdTransaction() },
                            { key: "F5", label: "Diskon", action: () => setShowDiscountDialog(true) },
                            { key: "F6", label: "Riwayat", action: () => loadHistory() },
                        ].map((s) => (
                            <button key={s.key} onClick={s.action}
                                className="flex-1 text-[10px] font-medium text-muted-foreground hover:text-primary py-1.5 rounded-md hover:bg-accent transition-all">
                                <span className="font-mono text-[9px] bg-muted/80 px-1 py-0.5 rounded mr-1">{s.key}</span>{s.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ============================================ */}
                {/* CENTER PANEL: Search + Cart */}
                {/* ============================================ */}
                <div className={cn(
                    "flex-1 flex flex-col min-w-0 bg-[#F1F5F9]",
                    "w-full lg:w-auto",
                    "absolute inset-0 lg:relative lg:inset-auto",
                    "pb-16 lg:pb-0",
                    mobileView === "cart" ? "z-10 flex" : "z-0 hidden lg:flex"
                )}>

                    {/* Mobile header for cart panel */}
                    <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-border/40 lg:hidden">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setMobileView("products")}>
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                        <h2 className="font-bold text-sm">Keranjang</h2>
                        <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setShowDiscountDialog(true)}>
                                <Tag className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => loadHistory()}>
                                <History className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="px-5 py-3 bg-white border-b border-border/40">
                        <div className="relative">
                            <ScanBarcode className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/50" />
                            <Input
                                ref={barcodeInputRef}
                                placeholder="Scan barcode atau ketik nama produk..."
                                value={searchQuery}
                                onChange={(e) => handleBarcodeInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && searchResults.length > 0) {
                                        const first = searchResults[0];
                                        if (first) addToCart(first);
                                    }
                                }}
                                className="pl-12 h-11 lg:h-12 rounded-xl text-base border-2 border-border/50 focus:border-primary/50 bg-muted/20"
                                autoFocus
                            />
                            {searching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-primary/40" />}
                        </div>

                        {/* Search Results */}
                        {searchResults.length > 0 && (
                            <div className="mt-2 border border-border/50 rounded-xl overflow-hidden max-h-[240px] overflow-y-auto bg-white divide-y divide-border/20">
                                {searchResults.map((p) => (
                                    <button key={p.id} onClick={() => addToCart(p)}
                                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/40 transition-colors text-left">
                                        <div><p className="font-medium text-sm">{p.name}</p><p className="text-xs text-muted-foreground">{p.code} &middot; {p.category.name} &middot; Stok: {p.stock}</p></div>
                                        <p className="font-bold text-primary tabular-nums">{formatCurrency(p.sellingPrice)}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Warnings */}
                    {(negativeMarginItems.length > 0 || lowStockItems.length > 0) && (
                        <div className="px-5 py-1.5 flex gap-2">
                            {negativeMarginItems.length > 0 && <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 rounded-md text-[11px] text-red-500"><AlertTriangle className="w-3 h-3" />Margin negatif: {negativeMarginItems.map((i) => i.productName).join(", ")}</div>}
                            {lowStockItems.length > 0 && <div className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 rounded-md text-[11px] text-orange-500"><AlertTriangle className="w-3 h-3" />Stok menipis</div>}
                        </div>
                    )}

                    {/* Cart */}
                    <div className="flex-1 flex flex-col min-h-0 px-5 py-3">
                        <div className="bg-white rounded-2xl border border-border/40 flex-1 flex flex-col overflow-hidden shadow-sm">
                            {/* Cart Header */}
                            <div className="px-5 py-3 border-b border-border/30 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-2">
                                    <ShoppingCart className="w-4 h-4 text-primary" />
                                    <span className="font-semibold text-sm">Keranjang</span>
                                    {totalItems > 0 && <Badge className="bg-primary/10 text-primary rounded-full text-xs px-2 h-5">{totalItems} item</Badge>}
                                </div>
                                {(cart.length > 0 || heldTransactions.length > 0) && (
                                    <div className="flex gap-1.5">
                                        {heldTransactions.length > 0 && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-xs text-primary hover:bg-primary/10 rounded-lg"
                                                onClick={() => setShowHeldDialog(true)}
                                            >
                                                Lihat Hold ({heldTransactions.length})
                                            </Button>
                                        )}
                                        {cart.length > 0 && (
                                            <>
                                                <Button variant="ghost" size="sm" className="h-7 text-xs text-orange-500 hover:bg-orange-50 rounded-lg" onClick={holdTransaction}><Pause className="w-3 h-3 mr-1" />Hold</Button>
                                                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-lg" onClick={resetPOS}>Clear</Button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Cart Items - scrollable */}
                            <div className="flex-1 overflow-y-auto min-h-0">
                                {cart.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full py-16 text-muted-foreground/40">
                                        <ShoppingCart className="w-14 h-14 mb-3" />
                                        <p className="font-medium">Keranjang kosong</p>
                                        <p className="text-xs mt-1">Scan barcode atau pilih produk</p>
                                        {heldTransactions.length > 0 && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="mt-4 rounded-lg"
                                                onClick={() => setShowHeldDialog(true)}
                                            >
                                                Lihat Transaksi Hold ({heldTransactions.length})
                                            </Button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="p-3 space-y-1.5">
                                        {cart.map((item, idx) => (
                                            <div key={item.productId}
                                                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted/30 transition-colors group">
                                                {/* Index */}
                                                <span className="text-xs text-muted-foreground/50 w-5 text-center tabular-nums">{idx + 1}</span>
                                                {/* Info */}
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-sm truncate">{item.productName}</p>
                                                    <p className="text-xs text-muted-foreground tabular-nums">{formatCurrency(item.unitPrice)}</p>
                                                </div>
                                                {/* Qty */}
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => updateQuantity(item.productId, -1)} disabled={item.quantity <= 1}>
                                                        <Minus className="w-3 h-3" />
                                                    </Button>
                                                    <span className="w-9 text-center font-bold text-sm tabular-nums">{item.quantity}</span>
                                                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => updateQuantity(item.productId, 1)}>
                                                        <Plus className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                                {/* Subtotal */}
                                                <p className="w-28 text-right font-bold text-sm tabular-nums shrink-0">{formatCurrency(item.subtotal)}</p>
                                                {/* Delete */}
                                                <button onClick={() => removeItem(item.productId)} className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500 p-1">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ============================================ */}
                {/* RIGHT PANEL: Payment */}
                {/* ============================================ */}
                <div className={cn(
                    "bg-white border-l border-border/40 flex flex-col shrink-0",
                    "w-full lg:w-[340px]",
                    "absolute inset-0 lg:relative lg:inset-auto",
                    "pb-16 lg:pb-0",
                    mobileView === "payment" ? "z-10 flex" : "z-0 hidden lg:flex"
                )}>
                    {/* Mobile header for payment panel */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 lg:hidden">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setMobileView("cart")}>
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                        <h2 className="font-bold text-sm">Pembayaran</h2>
                        <div className="w-8" />
                    </div>

                    {/* Scrollable content area */}
                    <div className="flex-1 overflow-y-auto min-h-0">
                        <div className="p-5 space-y-4">

                            {/* Summary */}
                            <div className="space-y-2.5">
                                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums font-medium">{formatCurrency(subtotal)}</span></div>
                                <div className="flex items-center gap-2"><span className="text-sm text-muted-foreground flex-1">Diskon</span><Input type="number" value={discountPercent} onChange={(e) => setDiscountPercent(Number(e.target.value))} className="w-14 h-7 text-right rounded-md text-xs" min={0} max={100} /><span className="text-xs text-muted-foreground">%</span></div>
                                {discountAmount > 0 && <div className="flex justify-between text-sm text-red-500"><span>Diskon</span><span className="tabular-nums">-{formatCurrency(discountAmount)}</span></div>}
                                <div className="flex items-center gap-2"><span className="text-sm text-muted-foreground flex-1">Pajak</span><Input type="number" value={taxPercent} onChange={(e) => setTaxPercent(Number(e.target.value))} className="w-14 h-7 text-right rounded-md text-xs" min={0} max={100} /><span className="text-xs text-muted-foreground">%</span></div>
                                {taxAmount > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Pajak</span><span className="tabular-nums">{formatCurrency(taxAmount)}</span></div>}
                            </div>

                            {/* TOTAL */}
                            <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-4 border border-primary/10">
                                <p className="text-xs font-medium text-primary/60 uppercase tracking-wider">Total Bayar</p>
                                <p className="text-3xl font-bold text-primary tabular-nums tracking-tight mt-1">{formatCurrency(grandTotal)}</p>
                            </div>

                            {/* Promos */}
                            {appliedPromos.length > 0 && (
                                <div className="space-y-1">
                                    <p className="text-[10px] font-semibold text-green-600 uppercase tracking-wider">Promo Aktif</p>
                                    {appliedPromos.map((p, i) => (
                                        <div key={i} className="flex justify-between text-xs bg-green-50/60 rounded-lg px-3 py-1.5">
                                            <span className="text-green-700 truncate">{p.promoName}</span>
                                            <span className="text-green-600 font-medium ml-2">-{formatCurrency(p.discountAmount)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Member */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Member</label>
                                <Input placeholder="No. HP member..." value={customerPhone} onChange={(e) => handleCustomerPhoneChange(e.target.value)} className="rounded-lg h-8 text-sm" />
                                {detectedCustomer && (
                                    <div className="bg-purple-50/60 rounded-lg px-3 py-2 space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-semibold text-purple-700">{detectedCustomer.name}</p>
                                            <Badge className="bg-purple-100 text-purple-700 text-[10px]">{detectedCustomer.memberLevel}</Badge>
                                        </div>
                                        <p className="text-[11px] text-purple-500">{detectedCustomer.points} poin tersedia</p>
                                        {/* Redeem Points */}
                                        {detectedCustomer.points >= 10 && (
                                            <div className="flex gap-1.5 items-center pt-0.5">
                                                <Input type="number" min={10} max={detectedCustomer.points} value={redeemPointsInput || ""} onChange={(e) => setRedeemPointsInput(Number(e.target.value))}
                                                    placeholder="Jumlah poin" className="h-7 text-xs flex-1 rounded-md" />
                                                <Button size="sm" variant="outline" className="h-7 text-[10px] px-2 rounded-md border-purple-300 text-purple-600 hover:bg-purple-50" onClick={handleRedeemPoints}
                                                    disabled={redeemPointsInput < 10 || redeemPointsInput > detectedCustomer.points}>Tukar</Button>
                                            </div>
                                        )}
                                        {redeemDiscount > 0 && (
                                            <div className="flex justify-between text-xs bg-purple-100/60 rounded-md px-2 py-1">
                                                <span className="text-purple-700">Redeem {redeemPointsInput} poin</span>
                                                <span className="text-purple-600 font-medium">-{formatCurrency(redeemDiscount)}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Voucher */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Voucher</label>
                                <div className="flex gap-1.5">
                                    <Input placeholder="Kode" value={voucherCode} onChange={(e) => setVoucherCode(e.target.value.toUpperCase())} className="rounded-lg h-8 text-sm flex-1" />
                                    <Button size="sm" variant="outline" className="rounded-lg h-8 text-xs px-3" onClick={handleApplyVoucher} disabled={!voucherCode}>Apply</Button>
                                </div>
                                {voucherApplied && <div className="flex justify-between text-xs bg-green-50/60 rounded-lg px-3 py-1.5"><span className="text-green-700">{voucherApplied}</span><span className="text-green-600 font-medium">-{formatCurrency(voucherDiscount)}</span></div>}
                            </div>

                            <div className="rounded-xl border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
                                Atur metode pembayaran dan nominal saat klik tombol bayar.
                            </div>
                        </div>
                    </div>

                    {/* Pay Button - fixed at bottom */}
                    <div className="p-4 border-t border-border/30 bg-white shrink-0">
                        <Button className="w-full h-14 rounded-xl text-lg font-bold shadow-lg hover:shadow-xl transition-all"
                            onClick={openPaymentDialog} disabled={loading || cart.length === 0}>
                            <><CreditCard className="mr-2 h-5 w-5" />Bayar {formatCurrency(grandTotal)}</>
                        </Button>
                    </div>
                </div>

            </div>{/* end panels wrapper */}

            {/* ====== MOBILE BOTTOM BAR ====== */}
            <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-border/40 flex lg:hidden safe-bottom">
                <button
                    onClick={() => setMobileView("products")}
                    className={cn(
                        "flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors",
                        mobileView === "products" ? "text-primary" : "text-muted-foreground"
                    )}
                >
                    <Package className="w-5 h-5" />
                    <span className="text-[10px] font-medium">Produk</span>
                </button>
                <button
                    onClick={() => setMobileView("cart")}
                    className={cn(
                        "flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors relative",
                        mobileView === "cart" ? "text-primary" : "text-muted-foreground"
                    )}
                >
                    <div className="relative">
                        <ShoppingCart className="w-5 h-5" />
                        {totalItems > 0 && (
                            <span className="absolute -top-1.5 -right-2.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                                {totalItems}
                            </span>
                        )}
                    </div>
                    <span className="text-[10px] font-medium">Keranjang</span>
                </button>
                <button
                    onClick={() => setMobileView("payment")}
                    className={cn(
                        "flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors",
                        mobileView === "payment" ? "text-primary" : "text-muted-foreground"
                    )}
                >
                    <Wallet className="w-5 h-5" />
                    <span className="text-[10px] font-medium">Bayar</span>
                </button>
            </div>

            {/* ====== DIALOGS ====== */}
            <Dialog open={showSearchDialog} onOpenChange={setShowSearchDialog}>
                <DialogContent className="rounded-2xl max-w-lg"><DialogHeader><DialogTitle className="flex items-center gap-2"><Search className="w-4 h-4" />Cari Produk</DialogTitle></DialogHeader>
                    <Input placeholder="Ketik nama / kode produk..." autoFocus className="rounded-xl h-11" onChange={async (e) => { if (e.target.value.length > 0) { const r = await searchProducts(e.target.value, activeBranchId); setSearchResults(r.map((item) => toProductSearchResult(item as RawPosProduct))); } else { setSearchResults([]); } }} />
                    <ScrollArea className="max-h-[300px]"><div className="space-y-1">{searchResults.map((p) => (<button key={p.id} onClick={() => { addToCart(p); setShowSearchDialog(false); }} className="w-full flex justify-between p-3 hover:bg-accent/50 rounded-xl text-left transition-colors"><div><p className="font-medium text-sm">{p.name}</p><p className="text-xs text-muted-foreground">{p.code} &middot; Stok: {p.stock}</p></div><p className="font-bold text-primary text-sm">{formatCurrency(p.sellingPrice)}</p></button>))}</div></ScrollArea>
                </DialogContent>
            </Dialog>
            <Dialog open={showClosingDialog} onOpenChange={setShowClosingDialog}>
                <DialogContent className="rounded-2xl max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Store className="w-4 h-4" /> Closing Kasir</DialogTitle>
                    </DialogHeader>
                    <DialogBody>
                        <div className="space-y-4">
                            {/* Info shift */}
                            <div className="rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                                <p>Lokasi: <span className="font-medium text-foreground">{activeBranchName}</span></p>
                                <p>Kassa: <span className="font-medium text-foreground">{selectedRegister}</span></p>
                                {activeShift && <p>Dibuka: <span className="font-medium text-foreground">{new Date(activeShift.openedAt).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span></p>}
                            </div>

                            {/* Summary */}
                            {summaryLoading ? (
                                <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary/40" /></div>
                            ) : shiftSummary && (
                                <div className="space-y-3">
                                    {/* Sales overview */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="rounded-xl border border-border/40 p-3">
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Transaksi</p>
                                            <p className="text-xl font-bold tabular-nums">{shiftSummary.totalTransactions}</p>
                                        </div>
                                        <div className="rounded-xl border border-border/40 p-3">
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Penjualan</p>
                                            <p className="text-xl font-bold tabular-nums text-primary">{formatCurrency(shiftSummary.totalSales)}</p>
                                        </div>
                                    </div>

                                    {/* Cash flow detail */}
                                    <div className="rounded-xl border border-border/40 p-3 space-y-1.5 text-sm">
                                        <div className="flex justify-between"><span className="text-muted-foreground">Kas Awal</span><span className="tabular-nums">{formatCurrency(shiftSummary.openingCash)}</span></div>
                                        <div className="flex justify-between"><span className="text-muted-foreground">Penjualan Cash</span><span className="tabular-nums text-emerald-600">+{formatCurrency(shiftSummary.netCash)}</span></div>
                                        {shiftSummary.nonCashIn > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Penjualan Non-Cash</span><span className="tabular-nums text-blue-600">{formatCurrency(shiftSummary.nonCashIn)}</span></div>}
                                        {shiftSummary.expenseAmount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Pengeluaran</span><span className="tabular-nums text-red-500">-{formatCurrency(shiftSummary.expenseAmount)}</span></div>}
                                        {shiftSummary.voidedCount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Transaksi Void</span><span className="tabular-nums text-red-500">{shiftSummary.voidedCount} transaksi</span></div>}
                                        <div className="border-t border-border/30 pt-1.5 flex justify-between font-semibold">
                                            <span>Kas Diharapkan (Sistem)</span>
                                            <span className="tabular-nums text-primary">{formatCurrency(shiftSummary.expectedCash)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Input uang di laci */}
                            <div className="space-y-1.5">
                                <Label>Uang di Laci (Aktual)</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    value={closingCash}
                                    onChange={(e) => setClosingCash(e.target.value)}
                                    className="rounded-lg h-11 text-lg font-semibold tabular-nums"
                                    placeholder="Masukkan nominal uang di laci..."
                                />
                            </div>

                            {/* Selisih */}
                            {shiftSummary && closingCash && (
                                <div className={cn(
                                    "rounded-xl p-3 flex items-center justify-between",
                                    Number(closingCash) - shiftSummary.expectedCash === 0
                                        ? "bg-emerald-50 border border-emerald-200"
                                        : Number(closingCash) - shiftSummary.expectedCash > 0
                                            ? "bg-blue-50 border border-blue-200"
                                            : "bg-red-50 border border-red-200"
                                )}>
                                    <span className="text-sm font-medium">
                                        {Number(closingCash) - shiftSummary.expectedCash === 0 ? "Sesuai" :
                                            Number(closingCash) - shiftSummary.expectedCash > 0 ? "Lebih" : "Kurang"}
                                    </span>
                                    <span className={cn(
                                        "text-lg font-bold tabular-nums",
                                        Number(closingCash) - shiftSummary.expectedCash === 0 ? "text-emerald-600" :
                                            Number(closingCash) - shiftSummary.expectedCash > 0 ? "text-blue-600" : "text-red-600"
                                    )}>
                                        {formatCurrency(Math.abs(Number(closingCash) - shiftSummary.expectedCash))}
                                    </span>
                                </div>
                            )}

                            {/* Catatan */}
                            <div className="space-y-1">
                                <Label>Catatan</Label>
                                <Input value={closingNotes} onChange={(e) => setClosingNotes(e.target.value)} className="rounded-lg" placeholder="Opsional" />
                            </div>
                        </div>
                    </DialogBody>
                    <DialogFooter>
                        <Button variant="outline" className="rounded-lg" onClick={() => setShowClosingDialog(false)}>Batal</Button>
                        <Button className="rounded-lg" onClick={handleCloseShift} disabled={closingShiftLoading || !closingCash}>
                            {closingShiftLoading ? "Memproses..." : "Tutup Shift"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={showHeldDialog} onOpenChange={setShowHeldDialog}>
                <DialogContent className="rounded-2xl w-[92vw] max-w-4xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center justify-between">
                            <span>Transaksi Ditahan</span>
                            <Badge variant="secondary" className="rounded-full px-3">
                                {heldTransactions.length}
                            </Badge>
                        </DialogTitle>
                    </DialogHeader>
                    {heldTransactions.length === 0 ? (
                        <div className="py-10 text-center">
                            <p className="text-sm font-medium text-foreground">Belum ada transaksi hold</p>
                            <p className="text-xs text-muted-foreground mt-1">Gunakan tombol Hold saat ada transaksi aktif</p>
                        </div>
                    ) : (
                        <ScrollArea className="max-h-[60vh] pr-2">
                            <div className="space-y-3">
                                {heldTransactions.map((h) => {
                                    const total = h.cart.reduce((s, i) => s + i.subtotal, 0);
                                    const qty = h.cart.reduce((s, i) => s + i.quantity, 0);
                                    return (
                                        <div key={h.id} className="rounded-xl border border-border/60 bg-card p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="space-y-1">
                                                    <p className="text-sm font-semibold">Hold #{String(h.id).slice(-6)}</p>
                                                    <p className="text-xs text-muted-foreground">Pukul {h.time}</p>
                                                    <div className="flex items-center gap-2 pt-1">
                                                        <Badge variant="outline" className="rounded-md text-[10px]">{h.cart.length} produk</Badge>
                                                        <Badge variant="outline" className="rounded-md text-[10px]">{qty} qty</Badge>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs text-muted-foreground">Total</p>
                                                    <p className="text-base font-bold text-primary tabular-nums">{formatCurrency(total)}</p>
                                                </div>
                                            </div>
                                            <div className="mt-3 flex items-center justify-end gap-2">
                                                <Button size="sm" className="rounded-lg" onClick={() => resumeTransaction(h.id)}>Lanjutkan</Button>
                                                <Button variant="outline" size="sm" className="rounded-lg text-red-500 border-red-200 hover:bg-red-50" onClick={() => setHeldTransactions((p) => p.filter((x) => x.id !== h.id))}>Hapus</Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    )}
                </DialogContent>
            </Dialog>
            <Dialog open={showDiscountDialog} onOpenChange={setShowDiscountDialog}>
                <DialogContent className="rounded-2xl max-w-sm">
                    <DialogHeader><DialogTitle>Set Diskon</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        {/* Type toggle */}
                        <div className="flex gap-1 bg-muted/50 p-1 rounded-lg">
                            <button onClick={() => setDiscountType("percent")}
                                className={`flex-1 text-sm font-medium py-2 rounded-md transition-all ${discountType === "percent" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"}`}>
                                Persen (%)
                            </button>
                            <button onClick={() => setDiscountType("amount")}
                                className={`flex-1 text-sm font-medium py-2 rounded-md transition-all ${discountType === "amount" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"}`}>
                                Rupiah (Rp)
                            </button>
                        </div>

                        {discountType === "percent" ? (
                            <>
                                <div className="relative">
                                    <Input type="number" value={discountPercent} onChange={(e) => setDiscountPercent(Number(e.target.value))} className="rounded-xl text-center text-3xl h-16 font-bold pr-10" min={0} max={100} autoFocus />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl text-muted-foreground">%</span>
                                </div>
                                <div className="grid grid-cols-4 gap-2">
                                    {[5, 10, 15, 20].map((v) => (
                                        <Button key={v} variant="outline" className="rounded-lg h-10" onClick={() => { setDiscountPercent(v); setShowDiscountDialog(false); }}>{v}%</Button>
                                    ))}
                                </div>
                                {subtotal > 0 && discountPercent > 0 && (
                                    <p className="text-center text-sm text-muted-foreground">= {formatCurrency(Math.round(subtotal * discountPercent / 100))}</p>
                                )}
                            </>
                        ) : (
                            <>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">Rp</span>
                                    <Input type="number" value={discountFixed} onChange={(e) => setDiscountFixed(Number(e.target.value))} className="rounded-xl text-center text-3xl h-16 font-bold pl-12" min={0} autoFocus />
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    {[5000, 10000, 20000, 25000, 50000, 100000].map((v) => (
                                        <Button key={v} variant="outline" className="rounded-lg h-9 text-xs" onClick={() => { setDiscountFixed(v); setShowDiscountDialog(false); }}>{formatCurrency(v)}</Button>
                                    ))}
                                </div>
                            </>
                        )}
                        <Button className="w-full rounded-xl h-11" onClick={() => setShowDiscountDialog(false)}>Terapkan</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Transaction History Dialog */}
            <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
                <DialogContent className="rounded-2xl max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
                    <DialogHeader><DialogTitle>Riwayat Transaksi</DialogTitle></DialogHeader>
                    <div className="flex-1 overflow-y-auto">
                        {historyLoading ? (
                            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary/40" /></div>
                        ) : historyData.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">Belum ada transaksi</p>
                        ) : (
                            <div className="space-y-2">
                                {historyData.map((tx) => (
                                    <div key={tx.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/40 hover:bg-muted/20 transition-colors">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-mono font-medium">{tx.invoiceNumber}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {new Date(tx.createdAt).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                                                {" · "}{tx.paymentMethod}
                                            </p>
                                        </div>
                                        <p className="text-sm font-semibold tabular-nums">{formatCurrency(tx.grandTotal)}</p>
                                        <Badge className={
                                            tx.status === "COMPLETED" ? "bg-green-100 text-green-700" :
                                                tx.status === "VOIDED" ? "bg-red-100 text-red-700" :
                                                    tx.status === "REFUNDED" ? "bg-orange-100 text-orange-700" :
                                                        "bg-slate-100 text-slate-700"
                                        }>{tx.status}</Badge>
                                        {tx.status === "COMPLETED" && (
                                            <Button variant="ghost" size="sm" className="h-7 text-xs text-red-500 hover:bg-red-50 rounded-lg shrink-0"
                                                onClick={() => { setVoidingId(tx.id); setVoidReason(""); setShowVoidDialog(true); }}>
                                                Void
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Void Confirmation Dialog */}
            <Dialog open={showVoidDialog} onOpenChange={setShowVoidDialog}>
                <DialogContent className="rounded-2xl max-w-sm">
                    <DialogHeader><DialogTitle>Void Transaksi</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">Transaksi akan dibatalkan dan stok dikembalikan.</p>
                        <div className="space-y-1.5">
                            <Label className="text-sm">Alasan <span className="text-red-400">*</span></Label>
                            <Input value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Masukkan alasan void..." className="rounded-lg" autoFocus />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setShowVoidDialog(false)} className="rounded-lg">Batal</Button>
                            <Button onClick={handleVoid} className="rounded-lg bg-red-600 hover:bg-red-700" disabled={!voidReason.trim()}>Void Transaksi</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
            <Dialog open={showShortcutsDialog} onOpenChange={setShowShortcutsDialog}>
                <DialogContent className="rounded-2xl w-[92vw] max-w-md"><DialogHeader><DialogTitle>Keyboard Shortcuts</DialogTitle></DialogHeader>
                    <div className="space-y-1">{[["F1", "Cari produk"], ["F2", "Hold"], ["F3", "Bayar"], ["F4", "Reset"], ["F5", "Diskon"], ["Enter", "Tambah produk"], ["Esc", "Fokus barcode"]].map(([k, d]) => (<div key={k} className="flex justify-between py-2 border-b border-border/30 last:border-0"><Badge variant="secondary" className="rounded-md font-mono text-xs">{k}</Badge><span className="text-sm text-muted-foreground">{d}</span></div>))}</div>
                </DialogContent>
            </Dialog>
            <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
                {/* Desktop: 2-column wide dialog */}
                <DialogContent className="w-[98vw] max-w-[1400px] rounded-none sm:rounded-2xl p-0 overflow-hidden max-h-[100dvh] sm:max-h-[90vh] flex flex-col" showCloseButton={false}>
                    <div className="flex flex-col md:flex-row md:grid md:grid-cols-[1fr_1.15fr] flex-1 min-h-0 overflow-hidden">

                        {/* ===== MOBILE: single column layout (confirmation first, calculator below) ===== */}
                        {/* ===== DESKTOP: calculator left, confirmation right ===== */}

                        {/* Calculator Section — on mobile: order-2 (bottom), compact */}
                        <div className="order-2 md:order-1 p-3 md:p-5 md:border-r border-t md:border-t-0 border-border/30 bg-muted/20 shrink-0 md:overflow-y-auto">
                            {/* Desktop header */}
                            <DialogHeader className="mb-4 hidden md:flex">
                                <DialogTitle>Kalkulator Pembayaran</DialogTitle>
                            </DialogHeader>

                            {/* Desktop: payment input display */}
                            <div className="mb-3 rounded-xl bg-white border border-border/50 px-4 py-2.5 hidden md:block">
                                <p className="text-[11px] text-muted-foreground">Nominal Input</p>
                                <p className="text-3xl font-bold tabular-nums">{formatCurrency(payment || 0)}</p>
                            </div>

                            {/* Mobile: compact input + quick amounts row */}
                            <div className="flex items-center gap-2 mb-2 md:hidden">
                                <div className="flex-1 rounded-lg bg-white border border-border/50 px-3 py-1.5">
                                    <p className="text-[9px] text-muted-foreground leading-none">Nominal</p>
                                    <p className="text-lg font-bold tabular-nums leading-tight">{formatCurrency(payment || 0)}</p>
                                </div>
                                <div className="flex gap-1 overflow-x-auto scrollbar-hide shrink-0">
                                    {dynamicQuickAmounts.map((amount, idx) => (
                                        <Button key={amount} type="button" variant="secondary" className="rounded-md h-7 text-[10px] shrink-0 px-2" onClick={() => setPaymentAmount(String(amount))}>
                                            {idx === 0 ? "Pas" : formatCurrency(amount)}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {/* Desktop: quick amounts grid */}
                            <div className="hidden md:grid grid-cols-2 gap-2 mb-3">
                                {dynamicQuickAmounts.map((amount, idx) => (
                                    <Button key={amount} type="button" variant="secondary" className="rounded-lg h-9 text-xs" onClick={() => setPaymentAmount(String(amount))}>
                                        {idx === 0 ? "Pas" : formatCurrency(amount)}
                                    </Button>
                                ))}
                            </div>

                            {/* Calculator grid — mobile: 4 cols compact, desktop: 3 cols */}
                            <div className="grid grid-cols-4 md:grid-cols-3 gap-1 md:gap-2">
                                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "BACKSPACE"].map((key) => (
                                    <Button
                                        key={key}
                                        type="button"
                                        variant="outline"
                                        className="h-9 md:h-11 rounded-lg md:rounded-xl text-sm md:text-base active:scale-95 transition-transform"
                                        onClick={() => handleCalculatorInput(key)}
                                    >
                                        {key === "BACKSPACE" ? "⌫" : key}
                                    </Button>
                                ))}
                                <Button type="button" variant="ghost" className="h-8 md:h-11 rounded-lg md:rounded-xl text-red-500 text-xs md:text-sm col-span-4 md:col-span-3" onClick={() => handleCalculatorInput("CLEAR")}>Clear</Button>
                            </div>
                        </div>

                        {/* Confirmation Section — on mobile: order-1 (top), no scroll */}
                        <div className="order-1 md:order-2 flex flex-col min-h-0">
                            <div className="p-4 md:p-5 space-y-3 md:space-y-4 shrink-0 md:flex-1 md:overflow-y-auto">
                                {/* Mobile header */}
                                <DialogHeader className="md:hidden">
                                    <DialogTitle className="text-base">Pembayaran</DialogTitle>
                                </DialogHeader>
                                {/* Desktop header */}
                                <div className="hidden md:block">
                                    <DialogHeader>
                                        <DialogTitle>Konfirmasi Pembayaran</DialogTitle>
                                    </DialogHeader>
                                </div>

                                {/* Total display — mobile only (prominent) */}
                                <div className="rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/10 px-4 py-2.5 md:hidden">
                                    <p className="text-[10px] text-primary/60 uppercase tracking-wider font-medium">Total Bayar</p>
                                    <p className="text-2xl font-bold text-primary tabular-nums">{formatCurrency(grandTotal)}</p>
                                </div>

                                {/* Payment Method */}
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Metode Pembayaran</label>
                                    <div className="grid grid-cols-3 md:grid-cols-2 gap-1.5 md:gap-2">
                                        {PAYMENT_METHOD_OPTIONS.map((method) => (
                                            <button
                                                key={method.value}
                                                type="button"
                                                onClick={() => {
                                                    setPaymentMethod(method.value);
                                                    if (method.value !== "CASH") setPaymentAmount(String(grandTotal));
                                                }}
                                                className={cn(
                                                    "flex items-center justify-center md:justify-start gap-1 md:gap-2 rounded-lg border px-2 md:px-3 py-1.5 md:py-2 text-[11px] md:text-sm transition-colors",
                                                    paymentMethod === method.value
                                                        ? "border-primary bg-primary/5 text-primary"
                                                        : "border-border/60 hover:border-primary/40 hover:bg-accent/40"
                                                )}
                                            >
                                                <span className={cn(
                                                    "h-3 w-3 md:h-4 md:w-4 rounded-full border flex items-center justify-center shrink-0",
                                                    paymentMethod === method.value ? "border-primary" : "border-muted-foreground/40"
                                                )}>
                                                    <span className={cn(
                                                        "h-1.5 w-1.5 md:h-2 md:w-2 rounded-full",
                                                        paymentMethod === method.value ? "bg-primary" : "bg-transparent"
                                                    )} />
                                                </span>
                                                <span className="truncate">{method.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Manual input - desktop only */}
                                <div className="hidden md:block space-y-1.5">
                                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Nominal Bayar</label>
                                    <Input
                                        type="number"
                                        value={paymentAmount}
                                        onChange={(e) => setPaymentAmount(e.target.value)}
                                        disabled={paymentMethod !== "CASH"}
                                        className="rounded-lg h-11 text-right text-2xl font-bold tabular-nums"
                                    />
                                    {paymentMethod !== "CASH" && (
                                        <p className="text-xs text-muted-foreground">Metode non-cash otomatis menggunakan nominal total.</p>
                                    )}
                                </div>

                                {/* Summary */}
                                <div className="rounded-xl border border-border/40 p-2.5 md:p-4 space-y-1 md:space-y-2">
                                    <div className="flex justify-between text-xs md:text-sm"><span className="text-muted-foreground">Total</span><span className="font-semibold tabular-nums">{formatCurrency(grandTotal)}</span></div>
                                    <div className="flex justify-between text-xs md:text-sm"><span className="text-muted-foreground">Dibayar</span><span className="font-semibold tabular-nums">{formatCurrency(paymentMethod === "CASH" ? payment : grandTotal)}</span></div>
                                    <div className="border-t border-border/30 pt-1 md:pt-2 flex justify-between text-sm md:text-base"><span className="font-medium">Kembalian</span><span className="font-bold tabular-nums text-emerald-600">{formatCurrency(paymentMethod === "CASH" && payment >= grandTotal ? changeAmount : 0)}</span></div>
                                </div>
                            </div>

                            {/* Action buttons — sticky bottom */}
                            <div className="p-3 md:p-5 pt-2 md:pt-1 border-t border-border/30 bg-white shrink-0">
                                <div className="flex gap-2">
                                    <Button variant="outline" className="flex-1 rounded-xl h-10 md:h-11" onClick={() => setShowPaymentDialog(false)}>Batal</Button>
                                    <Button
                                        className="flex-[2] md:flex-1 rounded-xl h-10 md:h-11 text-sm md:text-base"
                                        onClick={handlePayment}
                                        disabled={loading || (paymentMethod === "CASH" && payment < grandTotal)}
                                    >
                                        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Memproses...</> : "Proses Pembayaran"}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
