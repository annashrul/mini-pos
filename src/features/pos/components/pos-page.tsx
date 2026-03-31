"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { posService } from "@/features/pos";
import { formatCurrency } from "@/lib/utils";
import { printThermalReceipt } from "@/lib/thermal-receipt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    ScanBarcode, Plus, Minus, Trash2, ShoppingCart, CreditCard, Loader2,
    Check, Printer, Pause, AlertTriangle, Keyboard, Search,
    ArrowLeft, Store, LogOut,
} from "lucide-react";
import { toast } from "sonner";
import type { CartItem, ProductSearchResult, Branch, ProductTierPrice } from "@/types";
import type { ReceiptConfig } from "@/lib/receipt-config";

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

function getTierUnitPrice(basePrice: number, tiers: ProductTierPrice[] | undefined, qty: number) {
    if (!tiers || tiers.length === 0) return basePrice;
    const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
    let price = basePrice;
    for (const tier of sorted) {
        if (qty >= tier.minQty) {
            price = tier.price;
        }
    }
    return price;
}

type RawPosProduct = {
    id: string;
    code: string;
    name: string;
    categoryId?: string;
    sellingPrice: number;
    purchasePrice: number;
    stock: number;
    minStock: number;
    unit: string;
    imageUrl?: string | null;
    tierPrices?: ProductTierPrice[];
    category?: { name: string } | null;
};

function toProductSearchResult(product: RawPosProduct): ProductSearchResult {
    return {
        id: product.id,
        code: product.code,
        name: product.name,
        ...(product.categoryId ? { categoryId: product.categoryId } : {}),
        sellingPrice: product.sellingPrice,
        purchasePrice: product.purchasePrice,
        stock: product.stock,
        minStock: product.minStock,
        unit: product.unit,
        imageUrl: product.imageUrl ?? null,
        tierPrices: product.tierPrices ?? [],
        category: { name: product.category?.name ?? "" },
    };
}

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
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [heldTransactions, setHeldTransactions] = useState<{ id: number; cart: CartItem[]; time: string }[]>([]);
    const [discountPercent, setDiscountPercent] = useState(0);
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
    // Infinite scroll product panel
    const [browseItems, setBrowseItems] = useState<ProductSearchResult[]>([]);
    const [browsePage, setBrowsePage] = useState(1);
    const [browseHasMore, setBrowseHasMore] = useState(true);
    const [browseLoading, setBrowseLoading] = useState(false);
    const productSentinelRef = useRef<HTMLDivElement>(null);
    const [customerPhone, setCustomerPhone] = useState("");
    const [detectedCustomer, setDetectedCustomer] = useState<{ id: string; name: string; phone: string | null; memberLevel: string; points: number; totalSpending: number } | null>(null);
    const [appliedPromos, setAppliedPromos] = useState<{ promoId: string; promoName: string; type: string; discountAmount: number; appliedTo: string }[]>([]);
    const [promoDiscount, setPromoDiscount] = useState(0);
    const [voucherCode, setVoucherCode] = useState("");
    const [voucherDiscount, setVoucherDiscount] = useState(0);
    const [voucherApplied, setVoucherApplied] = useState("");
    const [voucherPromoId, setVoucherPromoId] = useState("");
    const [receiptConfig, setReceiptConfig] = useState<ReceiptConfig | null>(null);
    // Redeem points
    const [redeemPointsInput, setRedeemPointsInput] = useState(0);
    const [redeemDiscount, setRedeemDiscount] = useState(0);
    const [pointsEarnedResult, setPointsEarnedResult] = useState(0);
    // Product panel - no tabs, just category filter
    const [productTab] = useState<"favorites" | "category">("favorites");
    const activeBranchId = selectedBranchId || userBranchId || "";
    const activeBranchName = branches.find((branch) => branch.id === selectedBranchId)?.name || "Belum dipilih";
    const isPosReady = Boolean(activeShift && selectedBranchId && selectedRegister.trim() && sessionStarted);

    const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
    const discountAmount = Math.round(subtotal * (discountPercent / 100)) + promoDiscount + voucherDiscount + redeemDiscount;
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = Math.round(afterDiscount * (taxPercent / 100));
    const grandTotal = afterDiscount + taxAmount;
    const payment = Number(paymentAmount) || 0;
    const changeAmount = payment - grandTotal;
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

    // Effects
    useEffect(() => {
        const run = async () => {
            if (cart.length === 0) { setAppliedPromos([]); setPromoDiscount(0); return; }
            const items = cart.map((c) => ({
                productId: c.productId,
                productName: c.productName,
                ...(c.categoryId ? { categoryId: c.categoryId } : {}),
                quantity: c.quantity,
                unitPrice: c.unitPrice,
                subtotal: c.subtotal
            }));
            const result = await calculateAutoPromo(items, subtotal);
            setAppliedPromos(result.promos); setPromoDiscount(result.totalDiscount);
        };
        run();
    }, [cart, subtotal]);

    useEffect(() => { if (cart.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(cart)); else localStorage.removeItem(STORAGE_KEY); }, [cart]);

    // Handlers
    const handleCustomerPhoneChange = async (phone: string) => { setCustomerPhone(phone); if (phone.length >= 4) { const c = await findCustomerByPhone(phone); if (c) { setDetectedCustomer(c); toast.success(`Member: ${c.name}`); } else setDetectedCustomer(null); } else setDetectedCustomer(null); };
    const handleApplyVoucher = async () => { if (!voucherCode) return; const r = await validateVoucher(voucherCode, subtotal); if (r.error) { setVoucherPromoId(""); toast.error(r.error); } else { setVoucherDiscount(r.discount!); setVoucherApplied(r.promoName!); setVoucherPromoId(r.promoId!); toast.success(`Voucher: -${formatCurrency(r.discount!)}`); } };

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
            if (existing) {
                if (existing.quantity >= product.stock) { toast.error("Stok tidak cukup"); return prev; }
                const nextQty = existing.quantity + 1;
                const nextUnitPrice = getTierUnitPrice(existing.baseUnitPrice ?? existing.unitPrice, existing.tierPrices, nextQty);
                return prev.map((i) => i.productId === product.id ? { ...i, quantity: nextQty, unitPrice: nextUnitPrice, subtotal: nextQty * nextUnitPrice - i.discount } : i);
            }
            if (product.stock <= product.minStock) toast.warning(`Stok ${product.name} menipis!`);
            if (product.sellingPrice <= product.purchasePrice) toast.warning(`Margin negatif: ${product.name}`);
            const initialUnitPrice = getTierUnitPrice(product.sellingPrice, product.tierPrices, 1);
            return [...prev, {
                productId: product.id,
                ...(product.categoryId ? { categoryId: product.categoryId } : {}),
                productName: product.name,
                productCode: product.code,
                quantity: 1,
                unitPrice: initialUnitPrice,
                purchasePrice: product.purchasePrice,
                discount: 0,
                subtotal: initialUnitPrice,
                maxStock: product.stock,
                baseUnitPrice: product.sellingPrice,
                tierPrices: product.tierPrices ?? [],
            }];
        });
        setSearchQuery(""); setSearchResults([]); barcodeInputRef.current?.focus();
    }, []);

    const handleBarcodeInput = useCallback(async (value: string) => {
        setSearchQuery(value); if (value.length < 1) { setSearchResults([]); return; }
        if (/^\d{8,}$/.test(value)) { const p = await findByBarcode(value, activeBranchId); if (p) { addToCart(toProductSearchResult(p as RawPosProduct)); setSearchQuery(""); setSearchResults([]); return; } }
        setSearching(true); const r = await searchProducts(value, activeBranchId); setSearchResults(r.map((item) => toProductSearchResult(item as RawPosProduct))); setSearching(false);
    }, [activeBranchId, addToCart]);

    const updateQuantity = (id: string, d: number) => {
        setCart((prev) => prev.map((i) => {
            if (i.productId !== id) return i;
            const nextQty = i.quantity + d;
            if (nextQty <= 0 || nextQty > i.maxStock) {
                if (nextQty > i.maxStock) toast.error("Stok tidak cukup");
                return i;
            }
            const nextUnitPrice = getTierUnitPrice(i.baseUnitPrice ?? i.unitPrice, i.tierPrices, nextQty);
            return { ...i, quantity: nextQty, unitPrice: nextUnitPrice, subtotal: nextQty * nextUnitPrice - i.discount };
        }));
    };
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
            items: cart.map((item) => ({
                productId: item.productId,
                ...(item.categoryId ? { categoryId: item.categoryId } : {}),
                productName: item.productName,
                productCode: item.productCode,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discount: item.discount,
                subtotal: item.subtotal
            })),
            subtotal,
            discountAmount,
            taxAmount,
            grandTotal,
            paymentMethod,
            paymentAmount: paymentMethod === "CASH" ? payment : grandTotal,
            changeAmount: paymentMethod === "CASH" ? changeAmount : 0,
            ...(detectedCustomer?.id ? { customerId: detectedCustomer.id } : {}),
            ...(pn.length > 0 ? { promoApplied: pn.join(", ") } : {}),
            ...(appliedPromos.length > 0 || voucherPromoId ? { promoIds: Array.from(new Set([...appliedPromos.map((p) => p.promoId), ...(voucherPromoId ? [voucherPromoId] : [])])) } : {}),
            ...(redeemDiscount > 0 ? { redeemPoints: redeemPointsInput } : {}),
        };
        const r = await createTransaction(payload);
        setLoading(false); if (r.error) toast.error(r.error); else { setShowPaymentDialog(false); setSuccess(r.invoiceNumber!); setPointsEarnedResult(r.pointsEarned || 0); localStorage.removeItem(STORAGE_KEY); }
    };

    const resetPOS = useCallback(() => { setCart([]); setDiscountPercent(0); setPaymentAmount(""); setSuccess(null); setSearchQuery(""); setSearchResults([]); setCustomerPhone(""); setDetectedCustomer(null); setAppliedPromos([]); setPromoDiscount(0); setVoucherCode(""); setVoucherDiscount(0); setVoucherApplied(""); setVoucherPromoId(""); setRedeemPointsInput(0); setRedeemDiscount(0); setPointsEarnedResult(0); localStorage.removeItem(STORAGE_KEY); barcodeInputRef.current?.focus(); }, []);

    const loadProducts = useCallback(async (mode: "favorites" | "category" = "favorites", catId?: string, page = 1, reset = true, branchId?: string) => {
        if (browseLoading) return;
        setBrowseLoading(true);
        try {
            const result = await browseProducts({
                mode: catId ? "category" : mode,
                page,
                perPage: 20,
                branchId: branchId ?? activeBranchId,
                ...(catId ? { categoryId: catId } : {}),
            });
            const normalizedProducts = result.products.map((item) => toProductSearchResult(item as RawPosProduct));
            if (reset) {
                setBrowseItems(normalizedProducts);
            } else {
                setBrowseItems((prev) => [...prev, ...normalizedProducts]);
            }
            setBrowsePage(page);
            setBrowseHasMore(result.hasMore);
        } catch { /**/ }
        setBrowseLoading(false);
    }, [activeBranchId, browseLoading]);

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
        if (!sentinel) return;
        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (entry && entry.isIntersecting && browseHasMore && !browseLoading) {
                    loadProducts(productTab, selectedCategory || undefined, browsePage + 1, false);
                }
            },
            { threshold: 0.1 }
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
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [holdTransaction, openPaymentDialog, resetPOS]);

    const handleCategoryClick = (catId: string) => {
        setSelectedCategory(catId);
        loadProducts("category", catId, 1, true);
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
            await loadProducts("favorites", undefined, 1, true, branchId);
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
                    <div className="grid grid-cols-2 gap-4">
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
                    <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto"><Check className="w-10 h-10 text-emerald-500" /></div>
                    <div><h2 className="text-2xl font-bold">Transaksi Berhasil!</h2><p className="text-muted-foreground mt-1 font-mono text-sm">{success}</p></div>
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
        <div className="flex h-screen overflow-hidden">

            {/* ============================================ */}
            {/* LEFT PANEL: Products */}
            {/* ============================================ */}
            <div className="w-[220px] bg-white border-r border-border/40 flex flex-col shrink-0">
                {/* Header */}
                <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => router.push("/dashboard")}>
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div className="text-center">
                        <h2 className="font-bold text-sm text-foreground">POS Kasir</h2>
                        <p className="text-[10px] text-muted-foreground">{activeBranchName} • {selectedRegister}</p>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setShowClosingDialog(true)}>
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
                        <button onClick={() => { setSelectedCategory(""); loadProducts("favorites", undefined, 1, true); }}
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
                <div className="flex-1 overflow-y-auto px-3 pb-3">
                    <div className="grid grid-cols-2 gap-2 pt-2">
                        {browseItems.map((p) => (
                            <button key={p.id} onClick={() => addToCart(p)}
                                className="text-left p-3 rounded-xl border border-border/40 hover:border-primary/50 hover:shadow-sm transition-all group bg-white">
                                <p className="text-xs font-medium truncate group-hover:text-primary transition-colors leading-tight">{p.name}</p>
                                <p className="text-[10px] text-muted-foreground mt-1">Stok: {p.stock}</p>
                                <p className="text-sm text-primary font-bold mt-1 tabular-nums">{formatCurrency(p.sellingPrice)}</p>
                                {p.tierPrices && p.tierPrices.length > 0 && (
                                    <p className="text-[10px] text-emerald-600 mt-1">
                                        Tier mulai {p.tierPrices[0]?.minQty}+: {formatCurrency(p.tierPrices[0]?.price ?? p.sellingPrice)}
                                    </p>
                                )}
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

                {/* Shortcut Bar */}
                <div className="px-3 py-2 border-t border-border/30 flex gap-1">
                    {[
                        { key: "F1", label: "Cari", action: () => setShowSearchDialog(true) },
                        { key: "F2", label: heldTransactions.length > 0 ? `Hold (${heldTransactions.length})` : "Hold", action: () => heldTransactions.length > 0 ? setShowHeldDialog(true) : holdTransaction() },
                        { key: "F5", label: "Diskon", action: () => setShowDiscountDialog(true) },
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
            <div className="flex-1 flex flex-col min-w-0 bg-[#F1F5F9]">

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
                            className="pl-12 h-12 rounded-xl text-base border-2 border-border/50 focus:border-primary/50 bg-muted/20"
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
                                    {cart.map((item, idx) => {
                                        const itemPromo = promoMeta.byItem[item.productId];
                                        const freeQty = promoMeta.freeQtyByItem[item.productId] ?? 0;
                                        const displayQty = item.quantity + freeQty;
                                        return (
                                            <div key={item.productId}
                                                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted/30 transition-colors group">
                                                {/* Index */}
                                                <span className="text-xs text-muted-foreground/50 w-5 text-center tabular-nums">{idx + 1}</span>
                                                {/* Info */}
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-sm truncate">{item.productName}</p>
                                                    <p className="text-xs text-muted-foreground tabular-nums">{formatCurrency(item.unitPrice)}</p>
                                                    {item.tierPrices && item.tierPrices.length > 0 && (
                                                        <p className="text-[10px] text-emerald-600">
                                                            {item.baseUnitPrice && item.unitPrice < item.baseUnitPrice ? "Harga tier aktif" : "Produk memiliki harga tier"}
                                                        </p>
                                                    )}
                                                    {itemPromo && (
                                                        <p className="text-[10px] text-green-600 truncate">
                                                            {itemPromo.names.join(", ")} · -{formatCurrency(itemPromo.discount)}
                                                        </p>
                                                    )}
                                                </div>
                                                {/* Qty */}
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => updateQuantity(item.productId, -1)} disabled={item.quantity <= 1}>
                                                        <Minus className="w-3 h-3" />
                                                    </Button>
                                                    <span className="w-9 text-center font-bold text-sm tabular-nums">{displayQty}</span>
                                                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => updateQuantity(item.productId, 1)}>
                                                        <Plus className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                                {freeQty > 0 && (
                                                    <span className="text-[10px] text-green-600 shrink-0">+{freeQty} gratis</span>
                                                )}
                                                {/* Subtotal */}
                                                <p className="w-28 text-right font-bold text-sm tabular-nums shrink-0">{formatCurrency(item.subtotal)}</p>
                                                {/* Delete */}
                                                <button onClick={() => removeItem(item.productId)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500 p-1">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ============================================ */}
            {/* RIGHT PANEL: Payment */}
            {/* ============================================ */}
            <div className="w-[240px] bg-white border-l border-border/40 flex flex-col shrink-0">
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
                                {promoMeta.cartPromos.map((p, i) => (
                                    <div key={i} className="flex justify-between text-xs bg-green-50/60 rounded-lg px-3 py-1.5">
                                        <span className="text-green-700 truncate">{p.promoName}</span>
                                        <span className="text-green-600 font-medium ml-2">-{formatCurrency(p.discountAmount)}</span>
                                    </div>
                                ))}
                                {Object.keys(promoMeta.byItem).length > 0 && (
                                    <div className="text-[11px] text-green-700 bg-green-50/60 rounded-lg px-3 py-1.5">
                                        Promo item aktif di {Object.keys(promoMeta.byItem).length} produk (lihat di baris produk)
                                    </div>
                                )}
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

            {/* ====== DIALOGS ====== */}
            <Dialog open={showSearchDialog} onOpenChange={setShowSearchDialog}>
                <DialogContent className="rounded-2xl max-w-lg"><DialogHeader><DialogTitle className="flex items-center gap-2"><Search className="w-4 h-4" />Cari Produk</DialogTitle></DialogHeader>
                    <Input placeholder="Ketik nama / kode produk..." autoFocus className="rounded-xl h-11" onChange={async (e) => { if (e.target.value.length > 0) { const r = await searchProducts(e.target.value, activeBranchId); setSearchResults(r.map((item) => toProductSearchResult(item as RawPosProduct))); } else { setSearchResults([]); } }} />
                    <ScrollArea className="max-h-[300px]"><div className="space-y-1">{searchResults.map((p) => (<button key={p.id} onClick={() => { addToCart(p); setShowSearchDialog(false); }} className="w-full flex justify-between p-3 hover:bg-accent/50 rounded-xl text-left transition-colors"><div><p className="font-medium text-sm">{p.name}</p><p className="text-xs text-muted-foreground">{p.code} &middot; Stok: {p.stock}</p></div><p className="font-bold text-primary text-sm">{formatCurrency(p.sellingPrice)}</p></button>))}</div></ScrollArea>
                </DialogContent>
            </Dialog>
            <Dialog open={showClosingDialog} onOpenChange={setShowClosingDialog}>
                <DialogContent className="rounded-2xl max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Store className="w-4 h-4" /> Closing Kasir</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                            <p>Lokasi: <span className="font-medium text-foreground">{activeBranchName}</span></p>
                            <p>Kassa: <span className="font-medium text-foreground">{selectedRegister}</span></p>
                        </div>
                        <div className="space-y-1">
                            <Label>Saldo Akhir Kas</Label>
                            <Input type="number" min={0} value={closingCash} onChange={(e) => setClosingCash(e.target.value)} className="rounded-lg" />
                        </div>
                        <div className="space-y-1">
                            <Label>Catatan</Label>
                            <Input value={closingNotes} onChange={(e) => setClosingNotes(e.target.value)} className="rounded-lg" placeholder="Opsional" />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" className="rounded-lg" onClick={() => setShowClosingDialog(false)}>Batal</Button>
                            <Button className="rounded-lg" onClick={handleCloseShift} disabled={closingShiftLoading}>
                                {closingShiftLoading ? "Memproses..." : "Tutup Shift"}
                            </Button>
                        </div>
                    </div>
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
                <DialogContent className="rounded-2xl max-w-xs"><DialogHeader><DialogTitle>Set Diskon</DialogTitle></DialogHeader>
                    <div className="space-y-4"><Input type="number" value={discountPercent} onChange={(e) => setDiscountPercent(Number(e.target.value))} className="rounded-xl text-center text-3xl h-16 font-bold" min={0} max={100} autoFocus /><div className="grid grid-cols-4 gap-2">{[5, 10, 15, 20].map((v) => (<Button key={v} variant="outline" className="rounded-lg h-10" onClick={() => { setDiscountPercent(v); setShowDiscountDialog(false); }}>{v}%</Button>))}</div><Button className="w-full rounded-xl h-11" onClick={() => setShowDiscountDialog(false)}>Terapkan</Button></div>
                </DialogContent>
            </Dialog>
            <Dialog open={showShortcutsDialog} onOpenChange={setShowShortcutsDialog}>
                <DialogContent className="rounded-2xl w-[92vw] max-w-md"><DialogHeader><DialogTitle>Keyboard Shortcuts</DialogTitle></DialogHeader>
                    <div className="space-y-1">{[["F1", "Cari produk"], ["F2", "Hold"], ["F3", "Bayar"], ["F4", "Reset"], ["F5", "Diskon"], ["Enter", "Tambah produk"], ["Esc", "Fokus barcode"]].map(([k, d]) => (<div key={k} className="flex justify-between py-2 border-b border-border/30 last:border-0"><Badge variant="secondary" className="rounded-md font-mono text-xs">{k}</Badge><span className="text-sm text-muted-foreground">{d}</span></div>))}</div>
                </DialogContent>
            </Dialog>
            <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
                {/* <DialogContent className="w-screen max-w-[95vw] rounded-2xl p-0 overflow-hidden"> */}
                <DialogContent className="w-[98vw] max-w-[1400px] rounded-2xl p-0 overflow-hidden">
                    {/* <DialogContent className="rounded-2xl max-w-none w-[98vw] p-0 overflow-hidden"> */}
                    <div className="grid md:grid-cols-[1fr_1.15fr]">
                        <div className="p-5 border-r border-border/30 bg-muted/20">
                            <DialogHeader className="mb-4">
                                <DialogTitle>Kalkulator Pembayaran</DialogTitle>
                            </DialogHeader>
                            <div className="mb-3 rounded-xl bg-white border border-border/50 px-4 py-3">
                                <p className="text-[11px] text-muted-foreground">Nominal Input</p>
                                <p className="text-3xl font-bold tabular-nums">{formatCurrency(payment || 0)}</p>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "000", "BACKSPACE"].map((key) => (
                                    <Button
                                        key={key}
                                        type="button"
                                        variant="outline"
                                        className="h-11 rounded-xl"
                                        onClick={() => handleCalculatorInput(key)}
                                    >
                                        {key === "BACKSPACE" ? "⌫" : key === "CLEAR" ? "C" : key}
                                    </Button>
                                ))}
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-3">
                                {dynamicQuickAmounts.map((amount, idx) => (
                                    <Button
                                        key={amount}
                                        type="button"
                                        variant="secondary"
                                        className="rounded-lg h-9 text-xs"
                                        onClick={() => setPaymentAmount(String(amount))}
                                    >
                                        {idx === 0 ? "Pas" : formatCurrency(amount)}
                                    </Button>
                                ))}
                            </div>
                            <Button type="button" variant="ghost" className="w-full mt-2 rounded-lg text-red-500" onClick={() => handleCalculatorInput("CLEAR")}>Clear</Button>
                        </div>
                        <div className="p-5 space-y-4">
                            <DialogHeader>
                                <DialogTitle>Konfirmasi Pembayaran</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Metode Pembayaran</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {PAYMENT_METHOD_OPTIONS.map((method) => (
                                        <button
                                            key={method.value}
                                            type="button"
                                            onClick={() => {
                                                setPaymentMethod(method.value);
                                                if (method.value !== "CASH") setPaymentAmount(String(grandTotal));
                                            }}
                                            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${paymentMethod === method.value
                                                ? "border-primary bg-primary/5 text-primary"
                                                : "border-border/60 hover:border-primary/40 hover:bg-accent/40"
                                                }`}
                                        >
                                            <span className={`h-4 w-4 rounded-full border flex items-center justify-center ${paymentMethod === method.value ? "border-primary" : "border-muted-foreground/40"}`}>
                                                <span className={`h-2 w-2 rounded-full ${paymentMethod === method.value ? "bg-primary" : "bg-transparent"}`} />
                                            </span>
                                            <span>{method.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-1.5">
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
                            <div className="rounded-xl border border-border/40 p-4 space-y-2">
                                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total</span><span className="font-semibold tabular-nums">{formatCurrency(grandTotal)}</span></div>
                                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Dibayar</span><span className="font-semibold tabular-nums">{formatCurrency(paymentMethod === "CASH" ? payment : grandTotal)}</span></div>
                                <div className="flex justify-between text-base"><span className="font-medium">Kembalian</span><span className="font-bold tabular-nums text-emerald-600">{formatCurrency(paymentMethod === "CASH" && payment >= grandTotal ? changeAmount : 0)}</span></div>
                            </div>
                            <div className="flex gap-2 pt-1">
                                <Button variant="outline" className="flex-1 rounded-xl h-11" onClick={() => setShowPaymentDialog(false)}>Batal</Button>
                                <Button
                                    className="flex-1 rounded-xl h-11"
                                    onClick={handlePayment}
                                    disabled={loading || (paymentMethod === "CASH" && payment < grandTotal)}
                                >
                                    {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Memproses...</> : "Proses Pembayaran"}
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
