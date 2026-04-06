"use client";

import { useState, useEffect, useRef, useTransition, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    createPurchaseOrder,
    getPurchaseOrders,
    getPurchaseOrderById,
    receivePurchaseOrder,
    updatePurchaseOrderStatus,
} from "@/features/purchases";
import { createPurchaseOrderSchema, type CreatePurchaseOrderInput } from "@/features/purchases/schemas/purchases.schema";
import { getProducts } from "@/features/products";
import { getSuppliers } from "@/features/suppliers";
import { getCategories } from "@/features/categories";
import { getBranches } from "@/features/branches";
import { useMenuActionAccess } from "@/features/access-control";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SmartSelect } from "@/components/ui/smart-select";
import { BranchMultiSelect } from "@/components/ui/branch-multi-select";
import { DatePicker } from "@/components/ui/date-picker";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogBody, DialogFooter,
} from "@/components/ui/dialog";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    Plus, Eye, ShoppingBasket,
    Send, XCircle, PackageCheck, Trash2,
    Minus, FileText, Truck,
    DollarSign, MapPin, Package,
    Search, Loader2,
    CalendarDays,
    ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { Supplier, PurchaseOrderDetail, Category, Branch } from "@/types";
import { useBranch } from "@/components/providers/branch-provider";
import { ProductFormDialog } from "@/features/products";
import { PaginationControl } from "@/components/ui/pagination-control";

interface CreatedProductResult {
    id: string;
    name: string;
    code: string;
    purchasePrice: number;
    unit: string;
    stock: number;
}

type PurchaseOrdersData = Awaited<ReturnType<typeof getPurchaseOrders>>;

const statusConfig: Record<string, { label: string; className: string }> = {
    DRAFT: {
        label: "Draft",
        className: "bg-gradient-to-r from-slate-100 to-slate-50 text-slate-700 border border-slate-200 ring-1 ring-slate-100",
    },
    ORDERED: {
        label: "Dipesan",
        className: "bg-gradient-to-r from-blue-100 to-blue-50 text-blue-700 border border-blue-200 ring-1 ring-blue-100",
    },
    PARTIAL: {
        label: "Sebagian",
        className: "bg-gradient-to-r from-amber-100 to-amber-50 text-amber-700 border border-amber-200 ring-1 ring-amber-100",
    },
    RECEIVED: {
        label: "Diterima",
        className: "bg-gradient-to-r from-emerald-100 to-emerald-50 text-emerald-700 border border-emerald-200 ring-1 ring-emerald-100",
    },
    CANCELLED: {
        label: "Dibatalkan",
        className: "bg-gradient-to-r from-red-100 to-red-50 text-red-700 border border-red-200 ring-1 ring-red-100",
    },
};

const statusBorderColor: Record<string, string> = {
    DRAFT: "border-l-slate-400",
    ORDERED: "border-l-blue-500",
    PARTIAL: "border-l-amber-500",
    RECEIVED: "border-l-emerald-500",
    CANCELLED: "border-l-red-500",
};

const statusIconBg: Record<string, string> = {
    DRAFT: "from-slate-100 to-slate-200 text-slate-600",
    ORDERED: "from-blue-100 to-blue-200 text-blue-600",
    PARTIAL: "from-amber-100 to-amber-200 text-amber-600",
    RECEIVED: "from-emerald-100 to-green-200 text-emerald-600",
    CANCELLED: "from-red-100 to-red-200 text-red-600",
};

const statusFilterPills = [
    { value: "ALL", label: "Semua" },
    { value: "DRAFT", label: "Draft" },
    { value: "ORDERED", label: "Ordered" },
    { value: "PARTIAL", label: "Partial" },
    { value: "RECEIVED", label: "Received" },
    { value: "CANCELLED", label: "Cancelled" },
];


export function PurchasesContent() {
    const [data, setData] = useState<PurchaseOrdersData>({ orders: [], total: 0, totalPages: 0 });
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [createOpen, setCreateOpen] = useState(false);
    const [detailOpen, setDetailOpen] = useState(false);
    const [receiveOpen, setReceiveOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const [pendingConfirmAction, setPendingConfirmAction] = useState<null | (() => Promise<void>)>(null);
    const [confirmRequiredAction, setConfirmRequiredAction] = useState<null | "approve" | "update">(null);
    const [selectedPO, setSelectedPO] = useState<PurchaseOrderDetail | null>(null);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [activeFilters, setActiveFilters] = useState<Record<string, string>>({ status: "ALL" });
    const [sortKey] = useState<string>("");
    const [sortDir] = useState<"asc" | "desc">("asc");
    const [loading, startTransition] = useTransition();
    const { canAction, cannotMessage } = useMenuActionAccess("purchases");
    const canCreate = canAction("create");
    const canUpdate = canAction("update");
    const canApprove = canAction("approve");
    const canReceive = canAction("receive");
    const { canAction: canProductAction, cannotMessage: cannotProductMessage } = useMenuActionAccess("products");
    const canCreateProduct = canProductAction("create");
    const { selectedBranchId, branchReady } = useBranch();
    const prevBranchRef = useRef(selectedBranchId);

    // Create PO form (React Hook Form + Zod)
    const poForm = useForm<CreatePurchaseOrderInput>({
        resolver: zodResolver(createPurchaseOrderSchema),
        defaultValues: { supplierId: "", branchIds: [], expectedDate: "", notes: "", items: [] },
    });
    const watchedItems = poForm.watch("items");
    const cartTotal = watchedItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

    const [productOptions, setProductOptions] = useState<Array<{
        id: string;
        name: string;
        code: string;
        purchasePrice: number;
        unit: string;
        stock: number;
    }>>([]);
    const [selectedProductId, setSelectedProductId] = useState("");
    const [newQty, setNewQty] = useState(1);
    const [newPrice, setNewPrice] = useState(0);
    const [productModalOpen, setProductModalOpen] = useState(false);

    // Receive state
    const [receiveQtys, setReceiveQtys] = useState<Record<string, number>>({});
    function fetchData(params: { search?: string; page?: number; pageSize?: number; filters?: Record<string, string>; sortKey?: string; sortDir?: "asc" | "desc" }) {
        startTransition(async () => {
            const f = params.filters ?? activeFilters;
            const sk = params.sortKey ?? sortKey;
            const sd = params.sortDir ?? sortDir;
            const query = {
                search: params.search ?? search,
                page: params.page ?? page,
                ...(f.status !== "ALL" ? { status: f.status } : {}),
                ...(f.branchId && f.branchId !== "ALL" ? { branchId: f.branchId } : selectedBranchId ? { branchId: selectedBranchId } : {}),
                ...(f.date_from ? { dateFrom: f.date_from } : {}),
                ...(f.date_to ? { dateTo: f.date_to } : {}),
                ...(sk ? { sortBy: sk, sortDir: sd } : {}),
            };
            const result = await getPurchaseOrders(query);
            setData(result);
        });
    }

    useEffect(() => {
        if (!createOpen) return;
        startTransition(async () => {
            const [suppliersData, categoriesData, productsData, branchesData] = await Promise.all([
                getSuppliers({ page: 1, perPage: 500 }),
                getCategories({ page: 1, perPage: 500 }),
                getProducts({ page: 1, limit: 500 }),
                getBranches({ page: 1, perPage: 500 }),
            ]);
            setSuppliers(suppliersData.suppliers);
            setCategories(categoriesData.categories);
            setProductOptions(productsData.products.map((item) => ({
                id: item.id,
                name: item.name,
                code: item.code,
                purchasePrice: item.purchasePrice,
                unit: item.unit,
                stock: item.stock,
            })));
            setBranches(branchesData.branches);
        });
    }, [createOpen]);

    useEffect(() => {
        if (!branchReady) return;
        if (prevBranchRef.current !== selectedBranchId) {
            prevBranchRef.current = selectedBranchId;
            setPage(1);
            fetchData({ page: 1 });
        } else {
            fetchData({});
        }
    }, [selectedBranchId]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleViewDetail = async (id: string) => {
        const po = await getPurchaseOrderById(id);
        setSelectedPO(po);
        setDetailOpen(true);
    };

    const handleOpenReceive = async (id: string) => {
        const po: PurchaseOrderDetail | null = await getPurchaseOrderById(id);
        setSelectedPO(po);
        const qtys: Record<string, number> = {};
        po?.items.forEach((item) => {
            qtys[item.id] = 0;
        });
        setReceiveQtys(qtys);
        setReceiveOpen(true);
    };

    const addCartItem = () => {
        if (!selectedProductId || newQty < 1 || newPrice < 0) {
            toast.error("Lengkapi data item");
            return;
        }
        const selectedProduct = productOptions.find((item) => item.id === selectedProductId);
        if (!selectedProduct) {
            toast.error("Produk tidak ditemukan");
            return;
        }
        const currentItems = poForm.getValues("items");
        const existing = currentItems.find((item) => item.productId === selectedProductId);
        if (existing) {
            poForm.setValue("items", currentItems.map((item) =>
                item.productId === selectedProductId
                    ? { ...item, quantity: item.quantity + newQty, unitPrice: newPrice }
                    : item
            ), { shouldValidate: true });
        } else {
            poForm.setValue("items", [...currentItems, {
                productId: selectedProduct.id,
                productName: selectedProduct.name,
                quantity: newQty,
                unitPrice: newPrice,
            }], { shouldValidate: true });
        }
        setSelectedProductId("");
        setNewQty(1);
        setNewPrice(0);
    };

    const removeCartItem = (index: number) => {
        const currentItems = poForm.getValues("items");
        poForm.setValue("items", currentItems.filter((_, i) => i !== index), { shouldValidate: true });
    };

    const openProductModal = () => {
        if (!canCreateProduct) { toast.error(cannotProductMessage("create")); return; }
        setProductModalOpen(true);
    };

    const handleProductCreated = async (_mode: "create" | "update", createdProduct?: CreatedProductResult) => {
        if (createdProduct) {
            setProductOptions((prev) => {
                if (prev.some((item) => item.id === createdProduct.id)) return prev;
                return [...prev, createdProduct];
            });
            setSelectedProductId(createdProduct.id);
            setNewPrice(createdProduct.purchasePrice);
            setProductModalOpen(false);
            return;
        }
        const latest = await getProducts({ page: 1, limit: 300 });
        setProductOptions(
            latest.products.map((item) => ({
                id: item.id,
                name: item.name,
                code: item.code,
                purchasePrice: item.purchasePrice,
                unit: item.unit,
                stock: item.stock,
            }))
        );
        setProductModalOpen(false);
    };

    const handleCreatePO = async (formData: CreatePurchaseOrderInput) => {
        if (!canCreate) { toast.error(cannotMessage("create")); return; }

        const payload = {
            supplierId: formData.supplierId,
            ...(formData.branchIds.length > 0 ? { branchIds: formData.branchIds } : {}),
            items: formData.items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
            })),
            ...(formData.expectedDate ? { expectedDate: formData.expectedDate } : {}),
            ...(formData.notes ? { notes: formData.notes } : {}),
        };

        const result = await createPurchaseOrder(payload);

        if (result.error) {
            toast.error(result.error);
        } else {
            toast.success("Purchase Order berhasil dibuat");
            setCreateOpen(false);
            poForm.reset();
            setSelectedProductId("");
            fetchData({});
        }
    };

    const handleReceive = async () => {
        if (!canReceive) { toast.error(cannotMessage("receive")); return; }
        if (!selectedPO) return;
        const items = Object.entries(receiveQtys)
            .filter(([, qty]) => qty > 0)
            .map(([itemId, qty]) => ({ itemId, receivedQty: qty }));

        if (items.length === 0) { toast.error("Masukkan qty yang diterima"); return; }

        const result = await receivePurchaseOrder(selectedPO.id, items);
        if (result.error) {
            toast.error(result.error);
        } else {
            toast.success("Barang berhasil diterima");
            setReceiveOpen(false);
            fetchData({});
        }
    };

    const handleStatusChange = async (id: string, status: "ORDERED" | "CANCELLED") => {
        if (status === "ORDERED" && !canApprove) { toast.error(cannotMessage("approve")); return; }
        if (status === "CANCELLED" && !canUpdate) { toast.error(cannotMessage("update")); return; }
        const label = status === "ORDERED" ? "mengirim" : "membatalkan";
        setConfirmRequiredAction(status === "ORDERED" ? "approve" : "update");
        setConfirmText(`Yakin ingin ${label} PO ini?`);
        setPendingConfirmAction(() => async () => {
            const result = await updatePurchaseOrderStatus(id, status);
            if (result.error) toast.error(result.error);
            else { toast.success(`PO berhasil di-${label}`); fetchData({}); }
            setConfirmOpen(false);
            setPendingConfirmAction(null);
            setConfirmRequiredAction(null);
        });
        setConfirmOpen(true);
    };

    // Stats bar data
    const stats = useMemo(() => {
        const orders = data.orders;
        const draftCount = orders.filter((o) => o.status === "DRAFT").length;
        const orderedCount = orders.filter((o) => o.status === "ORDERED").length;
        const receivedCount = orders.filter((o) => o.status === "RECEIVED").length;
        const totalAmount = orders.reduce((sum, o) => sum + o.totalAmount, 0);
        return { draftCount, orderedCount, receivedCount, totalAmount };
    }, [data.orders]);

    const handleSearchChange = (value: string) => {
        setSearch(value);
        setPage(1);
        fetchData({ search: value, page: 1 });
    };

    const handleStatusFilter = (status: string) => {
        const newFilters = { ...activeFilters, status };
        setActiveFilters(newFilters);
        setPage(1);
        fetchData({ filters: newFilters, page: 1 });
    };

    return (
        <div className="space-y-4 sm:space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-200">
                        <ShoppingBasket className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg sm:text-2xl font-bold text-foreground tracking-tight">Purchase Order</h1>
                        <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-muted-foreground text-xs sm:text-sm">Kelola pemesanan barang ke supplier</p>
                            <Badge variant="secondary" className="rounded-full bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 border border-emerald-200 text-xs font-medium">
                                {data.total} PO
                            </Badge>
                        </div>
                    </div>
                </div>
                <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")}>
                    <Button disabled={!canCreate} className="w-full sm:w-auto text-xs sm:text-sm rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-200/50 text-white" onClick={() => setCreateOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Buat PO
                    </Button>
                </DisabledActionTooltip>
                <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) { poForm.reset(); setSelectedProductId(""); setNewQty(1); setNewPrice(0); } }}>
                    <DialogContent className="rounded-xl sm:rounded-2xl w-[95vw] max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-t-2xl -mt-6 mb-2" />
                        <DialogHeader>
                            <DialogTitle className="text-lg font-bold">Buat Purchase Order</DialogTitle>
                        </DialogHeader>

                        <DialogBody className={`space-y-5 overflow-x-hidden ${!canCreate ? "pointer-events-none opacity-70" : ""}`}>
                            {/* Supplier, Location, Date — inline */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">Supplier</Label>
                                    <Controller name="supplierId" control={poForm.control} render={({ field }) => (
                                        <SmartSelect value={field.value} onChange={field.onChange} placeholder="Pilih supplier"
                                            onSearch={async (query) => suppliers.filter((s) => s.isActive && s.name.toLowerCase().includes(query.toLowerCase())).map((s) => ({ value: s.id, label: s.name }))} />
                                    )} />
                                    {poForm.formState.errors.supplierId && <p className="text-xs text-red-500">{poForm.formState.errors.supplierId.message}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">Lokasi</Label>
                                    <Controller name="branchIds" control={poForm.control} render={({ field }) => (
                                        <BranchMultiSelect branches={branches.filter((b) => b.isActive)} value={field.value} onChange={field.onChange} placeholder="Pilih lokasi" />
                                    )} />
                                    {poForm.formState.errors.branchIds && <p className="text-xs text-red-500">{poForm.formState.errors.branchIds.message}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">Tgl Diharapkan</Label>
                                    <Controller name="expectedDate" control={poForm.control} render={({ field }) => (
                                        <DatePicker value={field.value ?? ""} onChange={field.onChange} className="rounded-xl" />
                                    )} />
                                </div>
                            </div>

                            {/* Notes */}
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Catatan (opsional)</Label>
                                <Input {...poForm.register("notes")} className="rounded-xl" placeholder="Catatan tambahan..." />
                            </div>

                            {/* Sticky add item form */}
                            <div className="sticky top-0 z-10 py-3 bg-white/95 backdrop-blur-sm border-y border-slate-200/60">
                                <div className="rounded-xl bg-slate-50 border border-slate-200/60 p-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Package className="w-4 h-4 text-emerald-600" />
                                            <Label className="font-semibold text-sm">Tambah Produk</Label>
                                        </div>
                                        <DisabledActionTooltip disabled={!canCreateProduct} message={cannotProductMessage("create")}>
                                            <Button disabled={!canCreateProduct} variant="outline" size="sm" className="rounded-xl text-xs h-7" onClick={openProductModal}>
                                                <Plus className="w-3 h-3 mr-1" /> Produk Baru
                                            </Button>
                                        </DisabledActionTooltip>
                                    </div>
                                    <div className="grid grid-cols-12 gap-2 items-end">
                                        <div className="col-span-5">
                                            <SmartSelect value={selectedProductId} onChange={(value) => { setSelectedProductId(value); const selected = productOptions.find((item) => item.id === value); if (selected) setNewPrice(selected.purchasePrice); }} placeholder="Pilih produk"
                                                onSearch={async (query) => productOptions.filter((item) => { if (!query) return true; const q = query.toLowerCase(); return item.name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q); }).map((item) => ({ value: item.id, label: item.name, description: `${item.code} • Stok ${item.stock} • ${item.unit}` }))} />
                                        </div>
                                        <div className="col-span-2">
                                            <Input type="number" value={newQty} onChange={(e) => setNewQty(Number(e.target.value))} className="rounded-xl" min={1} placeholder="Qty" />
                                        </div>
                                        <div className="col-span-3">
                                            <Input type="number" value={newPrice} onChange={(e) => setNewPrice(Number(e.target.value))} className="rounded-xl" min={0} placeholder="Harga beli" />
                                        </div>
                                        <div className="col-span-2">
                                            <Button onClick={addCartItem} className="rounded-xl w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white" size="sm">
                                                <Plus className="w-3.5 h-3.5 mr-1" /> Tambah
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Cart items */}
                            {poForm.formState.errors.items?.root && <p className="text-xs text-red-500">{poForm.formState.errors.items.root.message}</p>}
                            {poForm.formState.errors.items?.message && <p className="text-xs text-red-500">{poForm.formState.errors.items.message}</p>}
                            {watchedItems.length > 0 ? (
                                <div className="space-y-2">
                                    {watchedItems.map((item, i) => (
                                        <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 group hover:shadow-sm transition-shadow">
                                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center shrink-0">
                                                <Package className="w-4 h-4 text-emerald-600" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-foreground truncate">{item.productName}</p>
                                                <p className="text-xs text-muted-foreground">{formatCurrency(item.unitPrice)} / unit</p>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" onClick={() => { const items = poForm.getValues("items"); poForm.setValue("items", items.map((ci, idx) => idx === i && ci.quantity > 1 ? { ...ci, quantity: ci.quantity - 1 } : ci), { shouldValidate: true }); }}>
                                                    <Minus className="w-3 h-3" />
                                                </Button>
                                                <span className="w-8 text-center text-sm font-semibold tabular-nums">{item.quantity}</span>
                                                <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" onClick={() => { const items = poForm.getValues("items"); poForm.setValue("items", items.map((ci, idx) => idx === i ? { ...ci, quantity: ci.quantity + 1 } : ci), { shouldValidate: true }); }}>
                                                    <Plus className="w-3 h-3" />
                                                </Button>
                                            </div>
                                            <div className="text-right min-w-[100px]">
                                                <p className="text-sm font-semibold tabular-nums">{formatCurrency(item.quantity * item.unitPrice)}</p>
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg lg:opacity-0 lg:group-hover:opacity-100 text-red-400 hover:text-red-600 hover:bg-red-50 transition-all" onClick={() => removeCartItem(i)}>
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-8 text-center">
                                    <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-slate-100 to-gray-100 flex items-center justify-center mb-3">
                                        <Package className="w-4 h-4 sm:w-6 sm:h-6 text-slate-400" />
                                    </div>
                                    <p className="text-sm text-muted-foreground">Belum ada item</p>
                                    <p className="text-xs text-muted-foreground/70">Pilih produk di atas untuk menambahkan</p>
                                </div>
                            )}
                        </DialogBody>

                        <DialogFooter>
                            <div className="flex items-center justify-between w-full">
                                {watchedItems.length > 0 ? (
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-medium text-emerald-700">Total:</span>
                                        <span className="font-mono text-lg font-bold text-emerald-700 tabular-nums">{formatCurrency(cartTotal)}</span>
                                        <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2">
                                            {watchedItems.length} produk
                                        </Badge>
                                    </div>
                                ) : <div />}
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" onClick={() => setCreateOpen(false)} className="rounded-xl">Batal</Button>
                                    <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")}>
                                        <Button disabled={!canCreate} onClick={poForm.handleSubmit(handleCreatePO)} className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-200/50">
                                            <ShoppingBasket className="w-4 h-4 mr-2" />
                                            Buat PO
                                        </Button>
                                    </DisabledActionTooltip>
                                </div>
                            </div>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
                <ProductFormDialog
                    open={productModalOpen}
                    onOpenChange={setProductModalOpen}
                    editingProduct={null}
                    categories={categories}
                    branches={branches}
                    onSubmitted={() => handleProductCreated("create")}
                />
            </div>

            {/* Stats bar */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <div className="inline-flex items-center gap-1.5 rounded-lg sm:rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 px-2.5 sm:px-4 py-1.5 sm:py-2">
                    <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500" />
                    <span className="text-[11px] sm:text-xs font-semibold text-slate-700">{stats.draftCount}</span>
                    <span className="text-[11px] sm:text-xs text-slate-500">Draft</span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-lg sm:rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 px-2.5 sm:px-4 py-1.5 sm:py-2">
                    <Send className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-500" />
                    <span className="text-[11px] sm:text-xs font-semibold text-blue-700">{stats.orderedCount}</span>
                    <span className="text-[11px] sm:text-xs text-blue-500">Dipesan</span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-lg sm:rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 px-2.5 sm:px-4 py-1.5 sm:py-2">
                    <PackageCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-500" />
                    <span className="text-[11px] sm:text-xs font-semibold text-emerald-700">{stats.receivedCount}</span>
                    <span className="text-[11px] sm:text-xs text-emerald-500">Diterima</span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-lg sm:rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 px-2.5 sm:px-4 py-1.5 sm:py-2">
                    <DollarSign className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500" />
                    <span className="text-[11px] sm:text-xs font-semibold text-amber-700">{formatCurrency(stats.totalAmount)}</span>
                    <span className="text-[11px] sm:text-xs text-amber-500">Total</span>
                </div>
            </div>

            {/* Search bar + Status filter pills */}
            <div className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <div className="relative flex-1 sm:max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            placeholder="Cari PO berdasarkan nomor, supplier..."
                            className="pl-10 rounded-xl border-slate-200 bg-white h-9 sm:h-10 text-sm"
                        />
                        {loading && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap overflow-x-auto scrollbar-hide">
                    {statusFilterPills.map((pill) => (
                        <button
                            key={pill.value}
                            onClick={() => handleStatusFilter(pill.value)}
                            className={`shrink-0 px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                                activeFilters.status === pill.value
                                    ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-200/50"
                                    : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                            }`}
                        >
                            {pill.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* PO Card List */}
            <div className="space-y-3">
                {loading && data.orders.length === 0 ? (
                    <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 animate-pulse">
                                <div className="flex items-center gap-4">
                                    <div className="w-11 h-11 rounded-xl bg-slate-200" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 bg-slate-200 rounded w-1/3" />
                                        <div className="h-3 bg-slate-100 rounded w-1/4" />
                                    </div>
                                    <div className="h-5 bg-slate-200 rounded w-20" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : data.orders.length === 0 ? (
                    /* Empty state */
                    <div className="flex flex-col items-center justify-center py-10 sm:py-16 rounded-xl sm:rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-white to-slate-50/50">
                        <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center mb-4">
                            <ShoppingBasket className="w-5 h-5 sm:w-8 sm:h-8 text-emerald-300" />
                        </div>
                        <p className="text-sm sm:text-base font-semibold text-foreground mb-1">Belum ada purchase order</p>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                            {search || activeFilters.status !== "ALL"
                                ? "Tidak ada PO yang cocok dengan filter"
                                : "Buat PO pertama untuk mulai mengelola pembelian"}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
                        {data.orders.map((row) => {
                            const cfg = statusConfig[row.status] || { label: row.status, className: "" };
                            const borderColor = statusBorderColor[row.status] || "border-l-slate-300";
                            const iconBg = statusIconBg[row.status] || "from-slate-100 to-slate-200 text-slate-600";
                            const d = new Date(row.orderDate);
                            const supplierName = (row as unknown as { supplier?: { name?: string } }).supplier?.name ?? suppliers.find((s) => s.id === row.supplierId)?.name ?? "-";
                            const branchName = (row as unknown as { branch?: { name: string } | null }).branch?.name ?? "Semua Cabang";
                            const itemCount = (row as unknown as { _count?: { items?: number } })._count?.items ?? 0;

                            return (
                                <div
                                    key={row.id}
                                    className={`group relative rounded-xl border border-slate-200/60 border-l-4 ${borderColor} bg-white hover:shadow-md transition-all duration-200`}
                                >
                                    {/* Status badge — absolute top right */}
                                    <Badge className={`${cfg.className} gap-1 rounded-bl-xl rounded-tr-xl rounded-tl-none rounded-br-none px-3 py-1 text-[11px] font-medium shadow-none absolute top-0 right-0 z-[1]`}>
                                        {cfg.label}
                                    </Badge>

                                    <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4">
                                        {/* Left: Icon */}
                                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${iconBg} flex items-center justify-center shadow-sm shrink-0`}>
                                            <ClipboardList className="w-4.5 h-4.5" />
                                        </div>

                                        {/* Middle: PO info */}
                                        <div className="flex-1 min-w-0 space-y-1.5">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-sm font-bold text-foreground">{row.orderNumber}</span>
                                                <span className="text-xs text-muted-foreground">·</span>
                                                <span className="text-sm font-medium text-foreground truncate">{supplierName}</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                <span className="inline-flex items-center gap-1">
                                                    <MapPin className="w-3 h-3" />
                                                    {branchName}
                                                </span>
                                                <span className="inline-flex items-center gap-1">
                                                    <CalendarDays className="w-3 h-3" />
                                                    {format(d, "dd MMM yy", { locale: idLocale })}
                                                </span>
                                                <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 border border-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                                                    <Package className="w-3 h-3 text-slate-400" />
                                                    {itemCount} item
                                                </span>
                                            </div>
                                            <p className="font-mono text-sm font-bold text-foreground tabular-nums">{formatCurrency(row.totalAmount)}</p>
                                        </div>

                                        {/* Right: Action buttons */}
                                        <div className="flex items-center gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity shrink-0">
                                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-slate-100" onClick={() => handleViewDetail(row.id)}>
                                                <Eye className="w-3.5 h-3.5 text-slate-500" />
                                            </Button>
                                            {(row.status === "ORDERED" || row.status === "PARTIAL") && (
                                                <DisabledActionTooltip disabled={!canReceive} message={cannotMessage("receive")}>
                                                    <Button disabled={!canReceive} variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-emerald-500 hover:bg-emerald-50" onClick={() => handleOpenReceive(row.id)}>
                                                        <PackageCheck className="w-3.5 h-3.5" />
                                                    </Button>
                                                </DisabledActionTooltip>
                                            )}
                                            {row.status === "DRAFT" && (
                                                <DisabledActionTooltip disabled={!canApprove} message={cannotMessage("approve")}>
                                                    <Button disabled={!canApprove} variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-blue-500 hover:bg-blue-50" onClick={() => handleStatusChange(row.id, "ORDERED")}>
                                                        <Send className="w-3.5 h-3.5" />
                                                    </Button>
                                                </DisabledActionTooltip>
                                            )}
                                            {(row.status === "DRAFT" || row.status === "ORDERED") && (
                                                <DisabledActionTooltip disabled={!canUpdate} message={cannotMessage("update")}>
                                                    <Button disabled={!canUpdate} variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleStatusChange(row.id, "CANCELLED")}>
                                                        <XCircle className="w-3.5 h-3.5" />
                                                    </Button>
                                                </DisabledActionTooltip>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Pagination */}
            <PaginationControl
                currentPage={page}
                totalPages={data.totalPages}
                totalItems={data.total}
                pageSize={pageSize}
                onPageChange={(p) => { setPage(p); fetchData({ page: p }); }}
                onPageSizeChange={(s) => { setPageSize(s); setPage(1); fetchData({ pageSize: s, page: 1 }); }}
            />

            {/* Detail Dialog */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="rounded-xl sm:rounded-2xl max-w-lg p-0 gap-0 overflow-hidden">
                    <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
                    <DialogHeader className="px-6 pt-5 pb-3">
                        <DialogTitle className="text-lg font-bold">Detail Purchase Order</DialogTitle>
                    </DialogHeader>
                    {selectedPO && (
                        <div className="px-6 pb-6 space-y-4">
                            {/* Info cards grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                                <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-3">
                                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium mb-1">No. PO</p>
                                    <p className="font-mono font-bold text-sm text-foreground">{selectedPO.orderNumber}</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-3">
                                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium mb-1">Supplier</p>
                                    <div className="flex items-center gap-1.5">
                                        <Truck className="w-3.5 h-3.5 text-emerald-500" />
                                        <p className="text-sm font-medium">{selectedPO.supplier.name}</p>
                                    </div>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-3">
                                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium mb-1">Tanggal Order</p>
                                    <p className="text-sm">{format(new Date(selectedPO.orderDate), "dd MMM yyyy", { locale: idLocale })}</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-3">
                                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium mb-1">Status</p>
                                    <Badge className={`${statusConfig[selectedPO.status]?.className} rounded-full text-xs font-medium px-2.5 py-0.5`}>
                                        {statusConfig[selectedPO.status]?.label}
                                    </Badge>
                                </div>
                            </div>

                            {/* Items table */}
                            <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-gradient-to-r from-slate-50 to-white">
                                            <TableHead className="text-xs font-semibold">Produk</TableHead>
                                            <TableHead className="text-center text-xs font-semibold">Order</TableHead>
                                            <TableHead className="text-center text-xs font-semibold hidden sm:table-cell">Diterima</TableHead>
                                            <TableHead className="text-right text-xs font-semibold">Subtotal</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedPO.items.map((item) => (
                                            <TableRow key={item.id} className="hover:bg-slate-50/50">
                                                <TableCell className="text-sm font-medium">{item.product.name}</TableCell>
                                                <TableCell className="text-center text-sm tabular-nums">{item.quantity}</TableCell>
                                                <TableCell className="text-center text-sm hidden sm:table-cell">
                                                    <Badge
                                                        variant={item.receivedQty >= item.quantity ? "default" : "secondary"}
                                                        className={`rounded-lg font-semibold ${item.receivedQty >= item.quantity
                                                            ? "bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700 border border-emerald-200"
                                                            : "bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 border border-amber-200"
                                                            }`}
                                                    >
                                                        {item.receivedQty}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right text-sm font-semibold tabular-nums">{formatCurrency(item.subtotal)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Total */}
                            <div className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 p-4 flex items-center justify-between">
                                <span className="text-white font-semibold text-sm">Total</span>
                                <span className="text-white font-bold text-lg tabular-nums">{formatCurrency(selectedPO.totalAmount)}</span>
                            </div>

                            {/* Action buttons */}
                            <div className="flex justify-end gap-2">
                                {(selectedPO.status === "ORDERED" || selectedPO.status === "PARTIAL") && (
                                    <DisabledActionTooltip disabled={!canReceive} message={cannotMessage("receive")}>
                                        <Button
                                            disabled={!canReceive}
                                            className="rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white"
                                            onClick={() => { setDetailOpen(false); handleOpenReceive(selectedPO.id); }}
                                        >
                                            <PackageCheck className="w-4 h-4 mr-2" />
                                            Terima Barang
                                        </Button>
                                    </DisabledActionTooltip>
                                )}
                                {(selectedPO.status === "DRAFT" || selectedPO.status === "ORDERED") && (
                                    <DisabledActionTooltip disabled={!canUpdate} message={cannotMessage("update")}>
                                        <Button
                                            disabled={!canUpdate}
                                            variant="outline"
                                            className="rounded-xl text-red-600 border-red-200 hover:bg-red-50"
                                            onClick={() => { setDetailOpen(false); handleStatusChange(selectedPO.id, "CANCELLED"); }}
                                        >
                                            <XCircle className="w-4 h-4 mr-2" />
                                            Batalkan
                                        </Button>
                                    </DisabledActionTooltip>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Receive Dialog */}
            <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
                <DialogContent className="rounded-xl sm:rounded-2xl max-w-lg p-0 gap-0 overflow-hidden">
                    <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-green-500 to-lime-500" />
                    <DialogHeader className="px-6 pt-5 pb-3">
                        <DialogTitle className="text-lg font-bold flex items-center gap-2">
                            <PackageCheck className="w-5 h-5 text-emerald-500" />
                            Terima Barang
                        </DialogTitle>
                        {selectedPO && (
                            <p className="text-xs font-mono text-muted-foreground mt-1">{selectedPO.orderNumber}</p>
                        )}
                    </DialogHeader>
                    {selectedPO && (
                        <div className="px-6 pb-6 space-y-4">
                            <p className="text-sm text-muted-foreground">Masukkan jumlah barang yang diterima untuk setiap item.</p>
                            <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-gradient-to-r from-slate-50 to-white">
                                            <TableHead className="text-xs font-semibold">Produk</TableHead>
                                            <TableHead className="text-center text-xs font-semibold hidden sm:table-cell">Order</TableHead>
                                            <TableHead className="text-center text-xs font-semibold hidden sm:table-cell">Sudah</TableHead>
                                            <TableHead className="text-center text-xs font-semibold">Terima</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedPO.items.map((item) => {
                                            const remaining = item.quantity - item.receivedQty;
                                            return (
                                                <TableRow key={item.id} className="hover:bg-slate-50/50">
                                                    <TableCell className="text-sm font-medium">{item.product.name}</TableCell>
                                                    <TableCell className="text-center text-sm tabular-nums hidden sm:table-cell">{item.quantity}</TableCell>
                                                    <TableCell className="text-center text-sm hidden sm:table-cell">
                                                        <Badge variant="secondary" className="rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200 font-semibold">
                                                            {item.receivedQty}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Input
                                                            type="number"
                                                            min={0}
                                                            max={remaining}
                                                            value={receiveQtys[item.id] || 0}
                                                            onChange={(e) => setReceiveQtys({ ...receiveQtys, [item.id]: Number(e.target.value) })}
                                                            className="w-20 mx-auto rounded-xl text-center text-sm border-slate-200 focus:border-emerald-300"
                                                            disabled={remaining <= 0}
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setReceiveOpen(false)} className="rounded-xl">Batal</Button>
                                <DisabledActionTooltip disabled={!canReceive} message={cannotMessage("receive")}>
                                    <Button disabled={!canReceive} onClick={handleReceive} className="rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-lg shadow-emerald-200/50">
                                        <PackageCheck className="w-4 h-4 mr-2" />
                                        Terima Barang
                                    </Button>
                                </DisabledActionTooltip>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Confirm Dialog */}
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent className="rounded-xl sm:rounded-2xl max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold">Konfirmasi</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">{confirmText}</p>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => { setConfirmOpen(false); setPendingConfirmAction(null); }} className="rounded-xl">Batal</Button>
                        <DisabledActionTooltip
                            disabled={confirmRequiredAction === "approve" ? !canApprove : confirmRequiredAction === "update" ? !canUpdate : false}
                            message={cannotMessage(confirmRequiredAction === "approve" ? "approve" : "update")}
                        >
                            <Button
                                disabled={confirmRequiredAction === "approve" ? !canApprove : confirmRequiredAction === "update" ? !canUpdate : false}
                                variant="destructive"
                                onClick={async () => { await pendingConfirmAction?.(); }}
                                className="rounded-xl"
                            >
                                Ya, Lanjutkan
                            </Button>
                        </DisabledActionTooltip>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
