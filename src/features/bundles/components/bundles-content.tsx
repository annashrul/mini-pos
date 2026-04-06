"use client";

import { useEffect, useState, useTransition, useMemo, useRef, useCallback } from "react";
import { getBundles, createBundle, updateBundle, deleteBundle } from "@/server/actions/bundles";
import { searchProducts } from "@/server/actions/products";
import { getCategories } from "@/server/actions/categories";
import { useMenuActionAccess } from "@/features/access-control";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import { SmartTable, type SmartColumn, type SmartFilter } from "@/components/ui/smart-table";
import {
    Plus, Pencil, Trash2, Package, AlertTriangle, Search,
    X, Loader2, PackageOpen, BadgePercent, ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";

// ===========================
// Types
// ===========================

interface BundleItem {
    id?: string;
    productId: string;
    quantity: number;
    sortOrder?: number;
    product: {
        id: string;
        code: string;
        name: string;
        sellingPrice: number;
        purchasePrice?: number;
        stock?: number;
        unit?: string;
        imageUrl?: string | null;
    };
}

interface Bundle {
    id: string;
    code: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    sellingPrice: number;
    totalBasePrice: number;
    categoryId: string | null;
    isActive: boolean;
    barcode: string | null;
    branchId: string | null;
    items: BundleItem[];
    category: { id: string; name: string } | null;
    createdAt: string;
    updatedAt: string;
}

interface CategoryOption {
    id: string;
    name: string;
}

interface FormItem {
    productId: string;
    productName: string;
    productCode: string;
    productPrice: number;
    quantity: number;
}

// ===========================
// Component
// ===========================

export function BundlesContent() {
    // Data state
    const [data, setData] = useState<{ bundles: Bundle[]; total: number; totalPages: number }>({ bundles: [], total: 0, totalPages: 0 });
    const [categories, setCategories] = useState<CategoryOption[]>([]);

    // Table state
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [search, setSearch] = useState("");
    const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [loading, startTransition] = useTransition();

    // Dialog state
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<Bundle | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const [pendingConfirmAction, setPendingConfirmAction] = useState<null | (() => Promise<void>)>(null);
    const [submitting, setSubmitting] = useState(false);

    // Form state
    const [formCode, setFormCode] = useState("");
    const [formName, setFormName] = useState("");
    const [formDescription, setFormDescription] = useState("");
    const [formSellingPrice, setFormSellingPrice] = useState("");
    const [formCategoryId, setFormCategoryId] = useState("");
    const [formBarcode, setFormBarcode] = useState("");
    const [formItems, setFormItems] = useState<FormItem[]>([]);

    // Product search state
    const [productSearch, setProductSearch] = useState("");
    const [productResults, setProductResults] = useState<Array<{ id: string; code: string; name: string; sellingPrice: number }>>([]);
    const [searchingProducts, setSearchingProducts] = useState(false);
    const productSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Access control
    const { canAction, cannotMessage } = useMenuActionAccess("products");
    const canCreate = canAction("create");
    const canUpdate = canAction("update");
    const canDelete = canAction("delete");

    // Stats
    const stats = useMemo(() => {
        const active = data.bundles.filter((b) => b.isActive).length;
        const inactive = data.bundles.filter((b) => !b.isActive).length;
        return { total: data.total, active, inactive };
    }, [data]);

    // Fetch data
    const fetchData = useCallback((params: { search?: string; page?: number; pageSize?: number; filters?: Record<string, string> }) => {
        startTransition(async () => {
            const f = params.filters ?? activeFilters;
            const result = await getBundles({
                search: params.search ?? search,
                page: params.page ?? page,
                perPage: params.pageSize ?? pageSize,
                ...(f.status === "active" ? { isActive: true } : f.status === "inactive" ? { isActive: false } : {}),
            });
            setData(result as unknown as typeof data);
        });
    }, [search, page, pageSize, activeFilters]); // eslint-disable-line react-hooks/exhaustive-deps

    const didFetchRef = useRef(false);
    useEffect(() => {
        if (didFetchRef.current) return;
        didFetchRef.current = true;
        fetchData({});
        // Load categories
        getCategories({ perPage: 200 }).then((res) => {
            setCategories(res.categories.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
        });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Generate code
    const generateCode = () => {
        const prefix = "BDL";
        const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `${prefix}-${rand}`;
    };

    // Open dialog for create/edit
    const openDialog = (bundle?: Bundle) => {
        if (bundle) {
            setEditing(bundle);
            setFormCode(bundle.code);
            setFormName(bundle.name);
            setFormDescription(bundle.description || "");
            setFormSellingPrice(bundle.sellingPrice.toString());
            setFormCategoryId(bundle.categoryId || "");
            setFormBarcode(bundle.barcode || "");
            setFormItems(
                bundle.items.map((item) => ({
                    productId: item.product.id,
                    productName: item.product.name,
                    productCode: item.product.code,
                    productPrice: item.product.sellingPrice,
                    quantity: item.quantity,
                }))
            );
        } else {
            setEditing(null);
            setFormCode(generateCode());
            setFormName("");
            setFormDescription("");
            setFormSellingPrice("");
            setFormCategoryId("");
            setFormBarcode("");
            setFormItems([]);
        }
        setProductSearch("");
        setProductResults([]);
        setOpen(true);
    };

    // Product search handler
    const handleProductSearch = (query: string) => {
        setProductSearch(query);
        if (productSearchTimeout.current) clearTimeout(productSearchTimeout.current);
        if (!query || query.length < 1) {
            setProductResults([]);
            return;
        }
        setSearchingProducts(true);
        productSearchTimeout.current = setTimeout(async () => {
            try {
                const results = await searchProducts(query);
                setProductResults(
                    results.map((p: { id: string; code: string; name: string; sellingPrice: number }) => ({
                        id: p.id,
                        code: p.code,
                        name: p.name,
                        sellingPrice: p.sellingPrice,
                    }))
                );
            } catch {
                setProductResults([]);
            } finally {
                setSearchingProducts(false);
            }
        }, 300);
    };

    // Add product to items
    const addProductToItems = (product: { id: string; code: string; name: string; sellingPrice: number }) => {
        const exists = formItems.find((item) => item.productId === product.id);
        if (exists) {
            setFormItems((prev) =>
                prev.map((item) => (item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item))
            );
        } else {
            setFormItems((prev) => [
                ...prev,
                {
                    productId: product.id,
                    productName: product.name,
                    productCode: product.code,
                    productPrice: product.sellingPrice,
                    quantity: 1,
                },
            ]);
        }
        setProductSearch("");
        setProductResults([]);
    };

    // Remove product from items
    const removeProductFromItems = (productId: string) => {
        setFormItems((prev) => prev.filter((item) => item.productId !== productId));
    };

    // Update item quantity
    const updateItemQuantity = (productId: string, quantity: number) => {
        if (quantity < 1) return;
        setFormItems((prev) => prev.map((item) => (item.productId === productId ? { ...item, quantity } : item)));
    };

    // Calculated total base price
    const calculatedBasePrice = useMemo(() => {
        return formItems.reduce((sum, item) => sum + item.productPrice * item.quantity, 0);
    }, [formItems]);

    // Savings
    const savings = useMemo(() => {
        const selling = parseFloat(formSellingPrice) || 0;
        if (calculatedBasePrice <= 0 || selling <= 0) return { amount: 0, percentage: 0 };
        const amount = calculatedBasePrice - selling;
        const percentage = (amount / calculatedBasePrice) * 100;
        return { amount, percentage };
    }, [calculatedBasePrice, formSellingPrice]);

    // Submit handler
    const handleSubmit = async () => {
        if (editing ? !canUpdate : !canCreate) {
            toast.error(cannotMessage(editing ? "update" : "create"));
            return;
        }
        if (!formName.trim()) { toast.error("Nama paket harus diisi"); return; }
        if (!formSellingPrice || parseFloat(formSellingPrice) <= 0) { toast.error("Harga paket harus diisi"); return; }
        if (formItems.length === 0) { toast.error("Tambahkan minimal 1 produk ke paket"); return; }

        setSubmitting(true);
        try {
            const payload = {
                code: formCode,
                name: formName.trim(),
                ...(formDescription.trim() ? { description: formDescription.trim() } : {}),
                sellingPrice: parseFloat(formSellingPrice),
                ...(formCategoryId ? { categoryId: formCategoryId } : {}),
                ...(formBarcode.trim() ? { barcode: formBarcode.trim() } : {}),
                items: formItems.map((item) => ({ productId: item.productId, quantity: item.quantity })),
            };

            if (editing) {
                const result = await updateBundle(editing.id, payload);
                if (!result.bundle) { toast.error("Gagal mengupdate paket"); return; }
                toast.success("Paket berhasil diupdate");
            } else {
                const result = await createBundle(payload);
                if (!result.bundle) { toast.error("Gagal membuat paket"); return; }
                toast.success("Paket berhasil ditambahkan");
            }
            setOpen(false);
            setEditing(null);
            fetchData({});
        } catch {
            toast.error("Terjadi kesalahan");
        } finally {
            setSubmitting(false);
        }
    };

    // Delete handler
    const handleDelete = (id: string) => {
        if (!canDelete) { toast.error(cannotMessage("delete")); return; }
        setConfirmText("Yakin ingin menghapus paket ini?");
        setPendingConfirmAction(() => async () => {
            try {
                await deleteBundle(id);
                toast.success("Paket berhasil dihapus");
                fetchData({});
            } catch {
                toast.error("Gagal menghapus paket");
            }
            setConfirmOpen(false);
            setPendingConfirmAction(null);
        });
        setConfirmOpen(true);
    };

    // Columns
    const columns: SmartColumn<Bundle>[] = [
        {
            key: "code",
            header: "Kode",
            sortable: true,
            width: "120px",
            render: (row) => (
                <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                    {row.code}
                </span>
            ),
            exportValue: (row) => row.code,
        },
        {
            key: "name",
            header: "Nama Paket",
            sortable: true,
            render: (row) => (
                <div>
                    <span className="font-semibold text-sm text-slate-800">{row.name}</span>
                    {row.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{row.description}</p>
                    )}
                </div>
            ),
            exportValue: (row) => row.name,
        },
        {
            key: "items",
            header: "Isi Paket",
            render: (row) => {
                if (!row.items || row.items.length === 0) {
                    return <span className="text-xs text-muted-foreground italic">Kosong</span>;
                }
                const itemsText = row.items
                    .map((item) => `${item.quantity}x ${item.product.name}`)
                    .join(", ");
                return (
                    <div className="max-w-[250px]">
                        <p className="text-xs text-slate-600 line-clamp-2">{itemsText}</p>
                        <span className="text-[10px] text-muted-foreground">{row.items.length} produk</span>
                    </div>
                );
            },
            exportValue: (row) => row.items.map((item) => `${item.quantity}x ${item.product.name}`).join(", "),
        },
        {
            key: "sellingPrice",
            header: "Harga Paket",
            sortable: true,
            align: "right",
            render: (row) => (
                <span className="font-semibold text-sm text-blue-600">{formatCurrency(row.sellingPrice)}</span>
            ),
            exportValue: (row) => row.sellingPrice,
        },
        {
            key: "totalBasePrice",
            header: "Harga Normal",
            sortable: true,
            align: "right",
            render: (row) => (
                <span className={`text-sm text-slate-500 ${row.totalBasePrice !== row.sellingPrice ? "line-through" : ""}`}>
                    {formatCurrency(row.totalBasePrice)}
                </span>
            ),
            exportValue: (row) => row.totalBasePrice,
        },
        {
            key: "savings",
            header: "Hemat",
            align: "center",
            render: (row) => {
                const savingsAmount = row.totalBasePrice - row.sellingPrice;
                if (savingsAmount <= 0) {
                    return <span className="text-xs text-muted-foreground">-</span>;
                }
                const savingsPercent = ((savingsAmount / row.totalBasePrice) * 100).toFixed(0);
                return (
                    <Badge className="rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200/60 text-[11px] font-medium px-2">
                        {savingsPercent}% ({formatCurrency(savingsAmount)})
                    </Badge>
                );
            },
            exportValue: (row) => row.totalBasePrice - row.sellingPrice,
        },
        {
            key: "isActive",
            header: "Status",
            align: "center",
            render: (row) => (
                <Badge className={`rounded-full text-[11px] font-medium px-2.5 ${row.isActive
                    ? "bg-emerald-100 text-emerald-700 border border-emerald-200/60"
                    : "bg-slate-100 text-slate-500 border border-slate-200/60"
                }`}>
                    {row.isActive ? "Aktif" : "Nonaktif"}
                </Badge>
            ),
            exportValue: (row) => (row.isActive ? "Aktif" : "Nonaktif"),
        },
        {
            key: "actions",
            header: "Aksi",
            align: "right",
            sticky: true,
            width: "90px",
            render: (row) => (
                <div className="flex justify-end gap-0.5">
                    <DisabledActionTooltip disabled={!canUpdate} message={cannotMessage("update")}>
                        <Button disabled={!canUpdate} variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors" onClick={() => openDialog(row)}>
                            <Pencil className="w-3.5 h-3.5" />
                        </Button>
                    </DisabledActionTooltip>
                    <DisabledActionTooltip disabled={!canDelete} message={cannotMessage("delete")}>
                        <Button disabled={!canDelete} variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors" onClick={() => handleDelete(row.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                    </DisabledActionTooltip>
                </div>
            ),
        },
    ];

    // Filters
    const filters: SmartFilter[] = [
        {
            key: "status",
            label: "Status",
            type: "select",
            options: [
                { value: "", label: "Semua Status" },
                { value: "active", label: "Aktif" },
                { value: "inactive", label: "Nonaktif" },
            ],
        },
    ];

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-200">
                        <Package className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-800">Paket Produk</h1>
                        <p className="text-muted-foreground text-sm mt-0.5">Kelola paket bundling produk dengan harga spesial</p>
                    </div>
                </div>
                <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")}>
                    <Button
                        disabled={!canCreate}
                        className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all"
                        onClick={() => openDialog()}
                    >
                        <Plus className="w-4 h-4 mr-2" /> Tambah Paket
                    </Button>
                </DisabledActionTooltip>
            </div>

            {/* Stats Bar */}
            <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="rounded-full px-3.5 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200/60">
                    <Package className="w-3 h-3 mr-1.5" />
                    Total: {stats.total}
                </Badge>
                <Badge variant="secondary" className="rounded-full px-3.5 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                    <ShoppingCart className="w-3 h-3 mr-1.5" />
                    Aktif: {stats.active}
                </Badge>
                <Badge variant="secondary" className="rounded-full px-3.5 py-1.5 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
                    <AlertTriangle className="w-3 h-3 mr-1.5" />
                    Nonaktif: {stats.inactive}
                </Badge>
            </div>

            {/* Table */}
            <SmartTable<Bundle>
                data={data.bundles}
                columns={columns}
                totalItems={data.total}
                totalPages={data.totalPages}
                currentPage={page}
                pageSize={pageSize}
                loading={loading}
                title="Daftar Paket"
                titleIcon={<div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center"><Package className="w-4 h-4 text-white" /></div>}
                searchPlaceholder="Cari paket..."
                onSearch={(q) => { setSearch(q); setPage(1); fetchData({ search: q, page: 1 }); }}
                onPageChange={(p) => { setPage(p); fetchData({ page: p }); }}
                onPageSizeChange={(s) => { setPageSize(s); setPage(1); fetchData({ pageSize: s, page: 1 }); }}
                filters={filters}
                activeFilters={activeFilters}
                onFilterChange={(f) => { setActiveFilters(f); setPage(1); fetchData({ filters: f, page: 1 }); }}
                selectable
                selectedRows={selectedRows}
                onSelectionChange={setSelectedRows}
                rowKey={(r) => r.id}
                bulkActions={[{
                    label: "Hapus",
                    variant: "destructive",
                    icon: <Trash2 className="w-3 h-3" />,
                    onClick: async (ids) => {
                        if (!canDelete) { toast.error(cannotMessage("delete")); return; }
                        setConfirmText(`Hapus ${ids.length} paket?`);
                        setPendingConfirmAction(() => async () => {
                            for (const id of ids) await deleteBundle(id);
                            toast.success("Paket dihapus");
                            setSelectedRows(new Set());
                            fetchData({});
                            setConfirmOpen(false);
                            setPendingConfirmAction(null);
                        });
                        setConfirmOpen(true);
                    },
                }]}
                exportFilename="paket-produk"
                mobileRender={(row) => {
                    const savings = row.totalBasePrice - row.sellingPrice;
                    return (
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold truncate">{row.name}</p>
                                    <p className="text-[10px] text-muted-foreground font-mono">{row.code}</p>
                                </div>
                                <Badge className={`shrink-0 text-[10px] rounded-full ${row.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                                    {row.isActive ? "Aktif" : "Nonaktif"}
                                </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{row.items.map((i) => `${i.quantity}x ${i.product.name}`).join(", ")}</p>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-primary tabular-nums">{formatCurrency(row.sellingPrice)}</span>
                                {savings > 0 && (
                                    <>
                                        <span className="text-[10px] text-muted-foreground line-through tabular-nums">{formatCurrency(row.totalBasePrice)}</span>
                                        <span className="text-[10px] font-medium text-green-600">Hemat {formatCurrency(savings)}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    );
                }}
                emptyIcon={<PackageOpen className="w-10 h-10 text-muted-foreground/30" />}
                emptyTitle="Belum ada paket produk"
                emptyDescription="Buat paket bundling untuk menawarkan produk dengan harga spesial"
                emptyAction={
                    <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")}>
                        <Button disabled={!canCreate} variant="outline" size="sm" className="rounded-xl mt-2" onClick={() => openDialog()}>
                            <Plus className="w-3 h-3 mr-1" /> Tambah Paket
                        </Button>
                    </DisabledActionTooltip>
                }
            />

            {/* Create/Edit Dialog */}
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setProductSearch(""); setProductResults([]); } }}>
                <DialogContent className="rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto">
                    <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 rounded-t-2xl -mt-6 mb-2" />
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3 text-lg font-bold">
                            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-200/50">
                                <Package className="w-4 h-4 text-white" />
                            </div>
                            {editing ? "Edit Paket" : "Tambah Paket"}
                        </DialogTitle>
                    </DialogHeader>

                    <div className={`space-y-5 mt-1 ${editing ? (!canUpdate ? "pointer-events-none opacity-70" : "") : (!canCreate ? "pointer-events-none opacity-70" : "")}`}>
                        {/* Basic Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium">Kode Paket <span className="text-red-400">*</span></Label>
                                <Input
                                    value={formCode}
                                    onChange={(e) => setFormCode(e.target.value)}
                                    className="rounded-xl h-10 font-mono"
                                    placeholder="BDL-XXXXXX"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium">Nama Paket <span className="text-red-400">*</span></Label>
                                <Input
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    className="rounded-xl h-10"
                                    placeholder="Paket Hemat Makan Siang"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium">Deskripsi</Label>
                            <Textarea
                                value={formDescription}
                                onChange={(e) => setFormDescription(e.target.value)}
                                className="rounded-xl resize-none"
                                rows={2}
                                placeholder="Deskripsi singkat tentang paket ini..."
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium">Harga Paket <span className="text-red-400">*</span></Label>
                                <Input
                                    type="number"
                                    value={formSellingPrice}
                                    onChange={(e) => setFormSellingPrice(e.target.value)}
                                    className="rounded-xl h-10"
                                    placeholder="0"
                                    min={0}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium">Kategori</Label>
                                <Select value={formCategoryId} onValueChange={setFormCategoryId}>
                                    <SelectTrigger className="rounded-xl h-10">
                                        <SelectValue placeholder="Pilih kategori" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Tanpa Kategori</SelectItem>
                                        {categories.map((cat) => (
                                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium">Barcode</Label>
                                <Input
                                    value={formBarcode}
                                    onChange={(e) => setFormBarcode(e.target.value)}
                                    className="rounded-xl h-10"
                                    placeholder="Opsional"
                                />
                            </div>
                        </div>

                        {/* Product Items Section */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-semibold">Isi Paket <span className="text-red-400">*</span></Label>
                                <span className="text-xs text-muted-foreground">{formItems.length} produk</span>
                            </div>

                            {/* Product Search */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    value={productSearch}
                                    onChange={(e) => handleProductSearch(e.target.value)}
                                    className="rounded-xl h-10 pl-9"
                                    placeholder="Cari produk untuk ditambahkan..."
                                />
                                {searchingProducts && (
                                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                                )}

                                {/* Search Results Dropdown */}
                                {productResults.length > 0 && (
                                    <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                        {productResults.map((product) => {
                                            const alreadyAdded = formItems.some((item) => item.productId === product.id);
                                            return (
                                                <button
                                                    key={product.id}
                                                    type="button"
                                                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between gap-2 text-sm transition-colors"
                                                    onClick={() => addProductToItems(product)}
                                                >
                                                    <div>
                                                        <span className="font-medium text-slate-800">{product.name}</span>
                                                        <span className="text-xs text-muted-foreground ml-2 font-mono">{product.code}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-blue-600 font-medium">{formatCurrency(product.sellingPrice)}</span>
                                                        {alreadyAdded && (
                                                            <Badge className="rounded-full bg-blue-100 text-blue-700 border-0 text-[10px] px-1.5">+1</Badge>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Items List */}
                            {formItems.length === 0 ? (
                                <div className="rounded-xl border-2 border-dashed border-slate-200 p-6 text-center">
                                    <PackageOpen className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                                    <p className="text-sm text-muted-foreground">Belum ada produk ditambahkan</p>
                                    <p className="text-xs text-muted-foreground/70 mt-0.5">Cari dan tambahkan produk di atas</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {formItems.map((item) => (
                                        <div key={item.productId} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-800 truncate">{item.productName}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    <span className="font-mono">{item.productCode}</span>
                                                    <span className="mx-1.5">·</span>
                                                    {formatCurrency(item.productPrice)}/pcs
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-7 w-7 rounded-lg"
                                                    onClick={() => updateItemQuantity(item.productId, item.quantity - 1)}
                                                    disabled={item.quantity <= 1}
                                                >
                                                    <span className="text-sm font-bold">-</span>
                                                </Button>
                                                <Input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) => updateItemQuantity(item.productId, parseInt(e.target.value) || 1)}
                                                    className="w-14 h-7 rounded-lg text-center text-sm font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    min={1}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-7 w-7 rounded-lg"
                                                    onClick={() => updateItemQuantity(item.productId, item.quantity + 1)}
                                                >
                                                    <span className="text-sm font-bold">+</span>
                                                </Button>
                                            </div>
                                            <div className="text-right min-w-[80px]">
                                                <p className="text-sm font-semibold text-slate-700">
                                                    {formatCurrency(item.productPrice * item.quantity)}
                                                </p>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50"
                                                onClick={() => removeProductFromItems(item.productId)}
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Price Summary */}
                            {formItems.length > 0 && (
                                <div className="rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-4 space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-600">Harga Normal (Total Komponen)</span>
                                        <span className="font-semibold text-slate-700">{formatCurrency(calculatedBasePrice)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-600">Harga Paket</span>
                                        <span className="font-semibold text-blue-600">
                                            {formSellingPrice ? formatCurrency(parseFloat(formSellingPrice)) : "-"}
                                        </span>
                                    </div>
                                    {savings.amount > 0 && (
                                        <div className="flex items-center justify-between text-sm pt-1 border-t border-blue-200/50">
                                            <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                                                <BadgePercent className="w-3.5 h-3.5" />
                                                Hemat
                                            </span>
                                            <span className="font-bold text-emerald-600">
                                                {formatCurrency(savings.amount)} ({savings.percentage.toFixed(1)}%)
                                            </span>
                                        </div>
                                    )}
                                    {savings.amount < 0 && (
                                        <div className="flex items-center justify-between text-sm pt-1 border-t border-red-200/50">
                                            <span className="text-red-600 font-medium flex items-center gap-1.5">
                                                <AlertTriangle className="w-3.5 h-3.5" />
                                                Harga paket lebih mahal
                                            </span>
                                            <span className="font-bold text-red-600">
                                                +{formatCurrency(Math.abs(savings.amount))}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={() => { setOpen(false); setEditing(null); }} className="rounded-xl">
                                Batal
                            </Button>
                            <DisabledActionTooltip disabled={editing ? !canUpdate : !canCreate} message={cannotMessage(editing ? "update" : "create")}>
                                <Button
                                    disabled={(editing ? !canUpdate : !canCreate) || submitting}
                                    onClick={handleSubmit}
                                    className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all"
                                >
                                    {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    {editing ? "Update" : "Simpan"}
                                </Button>
                            </DisabledActionTooltip>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Confirm Delete Dialog */}
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent className="rounded-2xl max-w-sm">
                    <div className="h-1 w-full bg-gradient-to-r from-red-500 via-rose-500 to-orange-500 rounded-t-2xl -mt-6 mb-2" />
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3 text-lg font-bold">
                            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 shadow-md shadow-red-200/50">
                                <AlertTriangle className="w-4 h-4 text-white" />
                            </div>
                            Konfirmasi Hapus
                        </DialogTitle>
                    </DialogHeader>
                    <div className="rounded-xl bg-red-50/50 border border-red-100 p-3 mt-1">
                        <p className="text-sm text-red-700 font-medium">{confirmText}</p>
                        <p className="text-xs text-red-500/70 mt-1">Tindakan ini tidak dapat dibatalkan.</p>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => { setConfirmOpen(false); setPendingConfirmAction(null); }} className="rounded-xl">Batal</Button>
                        <DisabledActionTooltip disabled={!canDelete} message={cannotMessage("delete")}>
                            <Button disabled={!canDelete} variant="destructive" onClick={async () => { await pendingConfirmAction?.(); }} className="rounded-xl shadow-md shadow-red-200/50 hover:shadow-lg hover:shadow-red-300/50 transition-all">
                                Ya, Hapus
                            </Button>
                        </DisabledActionTooltip>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
