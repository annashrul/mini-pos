"use client";

import { useState, useTransition } from "react";
import {
    createPurchaseOrder,
    getPurchaseOrders,
    getPurchaseOrderById,
    receivePurchaseOrder,
    updatePurchaseOrderStatus,
} from "@/features/purchases";
import { getProducts } from "@/features/products";
import { formatCurrency } from "@/lib/utils";
import type { SmartColumn, SmartFilter } from "@/components/ui/smart-table";
import { SmartTable } from "@/components/ui/smart-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SmartSelect } from "@/components/ui/smart-select";
import { DatePicker } from "@/components/ui/date-picker";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    Plus, Eye, ShoppingBasket,
    Send, XCircle, PackageCheck, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { PurchaseOrder, Supplier, POCartItem, PurchaseOrderDetail, Category, Branch } from "@/types";
import { ProductFormDialog } from "@/features/products";

interface CreatedProductResult {
  id: string;
  name: string;
  code: string;
  purchasePrice: number;
  unit: string;
  stock: number;
}

interface Props {
    initialData: { orders: PurchaseOrder[]; total: number; totalPages: number };
    suppliers: Supplier[];
    categories: Category[];
    branches: Branch[];
    products: Array<{
        id: string;
        name: string;
        code: string;
        purchasePrice: number;
        unit: string;
        stock: number;
    }>;
}

const statusColors: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-700",
    ORDERED: "bg-blue-100 text-blue-700",
    PARTIAL: "bg-yellow-100 text-yellow-700",
    RECEIVED: "bg-green-100 text-green-700",
    CANCELLED: "bg-red-100 text-red-700",
};

const statusLabels: Record<string, string> = {
    DRAFT: "Draft",
    ORDERED: "Dipesan",
    PARTIAL: "Sebagian",
    RECEIVED: "Diterima",
    CANCELLED: "Dibatalkan",
};

export function PurchasesContent({ initialData, suppliers, categories, branches, products }: Props) {
    const [data, setData] = useState(initialData);
    const [createOpen, setCreateOpen] = useState(false);
    const [detailOpen, setDetailOpen] = useState(false);
    const [receiveOpen, setReceiveOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const [pendingConfirmAction, setPendingConfirmAction] = useState<null | (() => Promise<void>)>(null);
    const [selectedPO, setSelectedPO] = useState<PurchaseOrderDetail | null>(null);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [activeFilters, setActiveFilters] = useState<Record<string, string>>({ status: "ALL" });
    const [sortKey, setSortKey] = useState<string>("");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
    const [loading, startTransition] = useTransition();

    // Create PO state
    const [selectedSupplier, setSelectedSupplier] = useState("");
    const [expectedDate, setExpectedDate] = useState("");
    const [poNotes, setPoNotes] = useState("");
    const [cartItems, setCartItems] = useState<POCartItem[]>([]);
    const [productOptions, setProductOptions] = useState(products);
    const [selectedProductId, setSelectedProductId] = useState("");
    const [newQty, setNewQty] = useState(1);
    const [newPrice, setNewPrice] = useState(0);
    const [productModalOpen, setProductModalOpen] = useState(false);

    // Receive state
    const [receiveQtys, setReceiveQtys] = useState<Record<string, number>>({});

    const fetchData = (params: { search?: string; page?: number; pageSize?: number; filters?: Record<string, string>; sortKey?: string; sortDir?: "asc" | "desc" }) => {
        startTransition(async () => {
            const f = params.filters ?? activeFilters;
            const sk = params.sortKey ?? sortKey;
            const sd = params.sortDir ?? sortDir;
            const query = {
                search: params.search ?? search,
                page: params.page ?? page,
                ...(f.status !== "ALL" ? { status: f.status } : {}),
                ...(f.date_from ? { dateFrom: f.date_from } : {}),
                ...(f.date_to ? { dateTo: f.date_to } : {}),
                ...(sk ? { sortBy: sk, sortDir: sd } : {}),
            };
            const result = await getPurchaseOrders(query);
            setData(result);
        });
    };

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
        setCartItems((prev) => {
            const existing = prev.find((item) => item.productId === selectedProductId);
            if (existing) {
                return prev.map((item) =>
                    item.productId === selectedProductId
                        ? { ...item, quantity: item.quantity + newQty, unitPrice: newPrice }
                        : item
                );
            }
            return [...prev, {
                productId: selectedProduct.id,
                productName: selectedProduct.name,
                quantity: newQty,
                unitPrice: newPrice,
            }];
        });
        setSelectedProductId("");
        setNewQty(1);
        setNewPrice(0);
    };

    const removeCartItem = (index: number) => {
        setCartItems(cartItems.filter((_, i) => i !== index));
    };

    const openProductModal = () => {
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

    const handleCreatePO = async () => {
        if (!selectedSupplier) { toast.error("Pilih supplier"); return; }
        if (cartItems.length === 0) { toast.error("Tambahkan minimal 1 item"); return; }

        const payload = {
            supplierId: selectedSupplier,
            items: cartItems.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
            })),
            ...(expectedDate ? { expectedDate } : {}),
            ...(poNotes ? { notes: poNotes } : {}),
        };

        const result = await createPurchaseOrder(payload);

        if (result.error) {
            toast.error(result.error);
        } else {
            toast.success("Purchase Order berhasil dibuat");
            setCreateOpen(false);
            setCartItems([]);
            setSelectedSupplier("");
            setExpectedDate("");
            setPoNotes("");
            setSelectedProductId("");
            fetchData({});
        }
    };

    const handleReceive = async () => {
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
        const label = status === "ORDERED" ? "mengirim" : "membatalkan";
        setConfirmText(`Yakin ingin ${label} PO ini?`);
        setPendingConfirmAction(() => async () => {
            const result = await updatePurchaseOrderStatus(id, status);
            if (result.error) toast.error(result.error);
            else { toast.success(`PO berhasil di-${label}`); fetchData({}); }
            setConfirmOpen(false);
            setPendingConfirmAction(null);
        });
        setConfirmOpen(true);
    };

    const cartTotal = cartItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

    const columns: SmartColumn<PurchaseOrder>[] = [
        {
            key: "orderNumber", header: "No. PO", sortable: true, width: "140px",
            render: (row) => <span className="font-mono text-sm font-medium">{row.orderNumber}</span>,
            exportValue: (row) => row.orderNumber,
        },
        {
            key: "supplier", header: "Supplier", sortable: true,
            render: (row) => <span className="text-sm">{row.supplier.name}</span>,
            exportValue: (row) => row.supplier.name,
        },
        {
            key: "orderDate", header: "Tanggal", sortable: true,
            render: (row) => <span className="text-sm">{format(new Date(row.orderDate), "dd MMM yy", { locale: idLocale })}</span>,
            exportValue: (row) => format(new Date(row.orderDate), "dd/MM/yyyy"),
        },
        {
            key: "items", header: "Items", align: "center",
            render: (row) => <Badge variant="secondary" className="rounded-lg">{row._count.items}</Badge>,
            exportValue: (row) => row._count.items,
        },
        {
            key: "totalAmount", header: "Total", sortable: true, align: "right",
            render: (row) => <span className="text-sm font-medium">{formatCurrency(row.totalAmount)}</span>,
            exportValue: (row) => row.totalAmount,
        },
        {
            key: "status", header: "Status", align: "center",
            render: (row) => <Badge className={statusColors[row.status]}>{statusLabels[row.status]}</Badge>,
            exportValue: (row) => statusLabels[row.status] || row.status,
        },
        {
            key: "actions", header: "Aksi", align: "right", sticky: true, width: "120px",
            render: (row) => (
                <div className="flex justify-end gap-0.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => handleViewDetail(row.id)} title="Detail">
                        <Eye className="w-3.5 h-3.5" />
                    </Button>
                    {row.status === "DRAFT" && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-blue-500" onClick={() => handleStatusChange(row.id, "ORDERED")} title="Kirim Order">
                            <Send className="w-3.5 h-3.5" />
                        </Button>
                    )}
                    {(row.status === "ORDERED" || row.status === "PARTIAL") && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-green-500" onClick={() => handleOpenReceive(row.id)} title="Terima Barang">
                            <PackageCheck className="w-3.5 h-3.5" />
                        </Button>
                    )}
                    {(row.status === "DRAFT" || row.status === "ORDERED") && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-red-500" onClick={() => handleStatusChange(row.id, "CANCELLED")} title="Batalkan">
                            <XCircle className="w-3.5 h-3.5" />
                        </Button>
                    )}
                </div>
            ),
        },
    ];

    const filters: SmartFilter[] = [
        {
            key: "status", label: "Status", type: "select",
            options: [
                { value: "DRAFT", label: "Draft" },
                { value: "ORDERED", label: "Dipesan" },
                { value: "PARTIAL", label: "Sebagian" },
                { value: "RECEIVED", label: "Diterima" },
                { value: "CANCELLED", label: "Dibatalkan" },
            ],
        },
        { key: "date", label: "Tanggal", type: "daterange" },
    ];

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Purchase Order</h1>
                    <p className="text-muted-foreground text-sm">Kelola pemesanan barang ke supplier</p>
                </div>
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                        <Button className="rounded-lg">
                            <Plus className="w-4 h-4 mr-2" />
                            Buat PO
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="rounded-2xl max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Buat Purchase Order</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Supplier</Label>
                                    <SmartSelect
                                        value={selectedSupplier}
                                        onChange={setSelectedSupplier}
                                        placeholder="Pilih supplier"
                                        onSearch={async (query) =>
                                            suppliers
                                                .filter((s) => s.isActive && s.name.toLowerCase().includes(query.toLowerCase()))
                                                .map((s) => ({ value: s.id, label: s.name }))
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Tanggal Diharapkan</Label>
                                    <DatePicker value={expectedDate} onChange={setExpectedDate} className="rounded-xl" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Catatan</Label>
                                <Input value={poNotes} onChange={(e) => setPoNotes(e.target.value)} className="rounded-xl" placeholder="Opsional" />
                            </div>

                            <div className="border rounded-xl p-4 space-y-4 bg-muted/20">
                                <div className="flex items-center justify-between">
                                    <Label className="font-semibold">Tambah Item Produk</Label>
                                    <Button variant="outline" size="sm" className="rounded-lg" onClick={openProductModal}>
                                        <Plus className="w-4 h-4 mr-1" />
                                        Produk Baru
                                    </Button>
                                </div>
                                <div className="grid grid-cols-12 gap-2 items-end">
                                    <div className="col-span-6 space-y-1">
                                        <Label className="text-xs">Produk</Label>
                                        <SmartSelect
                                            value={selectedProductId}
                                            onChange={(value) => {
                                                setSelectedProductId(value);
                                                const selected = productOptions.find((item) => item.id === value);
                                                if (selected) setNewPrice(selected.purchasePrice);
                                            }}
                                            placeholder="Pilih produk"
                                            onSearch={async (query) =>
                                                productOptions
                                                    .filter((item) => {
                                                        if (!query) return true;
                                                        const q = query.toLowerCase();
                                                        return item.name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q);
                                                    })
                                                    .map((item) => ({
                                                        value: item.id,
                                                        label: item.name,
                                                        description: `${item.code} • Stok ${item.stock} • ${item.unit}`,
                                                    }))
                                            }
                                        />
                                    </div>
                                    <div className="col-span-2 space-y-1">
                                        <Label className="text-xs">Qty</Label>
                                        <Input type="number" value={newQty} onChange={(e) => setNewQty(Number(e.target.value))} className="rounded-xl" min={1} />
                                    </div>
                                    <div className="col-span-2 space-y-1">
                                        <Label className="text-xs">Harga Beli</Label>
                                        <Input type="number" value={newPrice} onChange={(e) => setNewPrice(Number(e.target.value))} className="rounded-xl" min={0} />
                                    </div>
                                    <div className="col-span-2">
                                        <Button onClick={addCartItem} className="rounded-xl w-full" size="sm">
                                            Tambah
                                        </Button>
                                    </div>
                                </div>

                                {cartItems.length > 0 && (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Produk</TableHead>
                                                <TableHead className="text-center">Qty</TableHead>
                                                <TableHead className="text-right">Harga</TableHead>
                                                <TableHead className="text-right">Subtotal</TableHead>
                                                <TableHead></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {cartItems.map((item, i) => (
                                                <TableRow key={i}>
                                                    <TableCell className="text-sm">{item.productName}</TableCell>
                                                    <TableCell className="text-center text-sm">{item.quantity}</TableCell>
                                                    <TableCell className="text-right text-sm">{formatCurrency(item.unitPrice)}</TableCell>
                                                    <TableCell className="text-right text-sm font-medium">{formatCurrency(item.quantity * item.unitPrice)}</TableCell>
                                                    <TableCell>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeCartItem(i)}>
                                                            <Trash2 className="w-3 h-3 text-red-500" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-right font-bold">Total</TableCell>
                                                <TableCell className="text-right font-bold">{formatCurrency(cartTotal)}</TableCell>
                                                <TableCell></TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                )}
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setCreateOpen(false)} className="rounded-xl">Batal</Button>
                                <Button onClick={handleCreatePO} className="rounded-xl">Buat PO</Button>
                            </div>
                        </div>
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

            <SmartTable<PurchaseOrder>
                data={data.orders}
                columns={columns}
                totalItems={data.total}
                totalPages={data.totalPages}
                currentPage={page}
                pageSize={pageSize}
                loading={loading}
                title="Daftar Purchase Order"
                titleIcon={<ShoppingBasket className="w-4 h-4 text-muted-foreground" />}
                searchPlaceholder="Cari PO..."
                onSearch={(q) => { setSearch(q); setPage(1); fetchData({ search: q, page: 1 }); }}
                onPageChange={(p) => { setPage(p); fetchData({ page: p }); }}
                onPageSizeChange={(s) => { setPageSize(s); setPage(1); fetchData({ pageSize: s, page: 1 }); }}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={(key, dir) => { setSortKey(key); setSortDir(dir); setPage(1); fetchData({ page: 1, sortKey: key, sortDir: dir }); }}
                filters={filters}
                activeFilters={activeFilters}
                onFilterChange={(f) => { setActiveFilters(f); setPage(1); fetchData({ filters: f, page: 1 }); }}
                rowKey={(row) => row.id}
                exportFilename="purchase-orders"
                emptyIcon={<ShoppingBasket className="w-10 h-10 text-muted-foreground/30" />}
                emptyTitle="Belum ada purchase order"
            />

            {/* Detail Dialog */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="rounded-2xl max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Detail Purchase Order</DialogTitle>
                    </DialogHeader>
                    {selectedPO && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div><p className="text-slate-500">No. PO</p><p className="font-mono font-medium">{selectedPO.orderNumber}</p></div>
                                <div><p className="text-slate-500">Supplier</p><p>{selectedPO.supplier.name}</p></div>
                                <div><p className="text-slate-500">Status</p><Badge className={statusColors[selectedPO.status]}>{statusLabels[selectedPO.status]}</Badge></div>
                                <div><p className="text-slate-500">Tanggal Order</p><p>{format(new Date(selectedPO.orderDate), "dd MMM yyyy", { locale: idLocale })}</p></div>
                            </div>
                            <div className="border rounded-xl overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Produk</TableHead>
                                            <TableHead className="text-center">Order</TableHead>
                                            <TableHead className="text-center">Diterima</TableHead>
                                            <TableHead className="text-right">Subtotal</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedPO.items.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell className="text-sm">{item.product.name}</TableCell>
                                                <TableCell className="text-center text-sm">{item.quantity}</TableCell>
                                                <TableCell className="text-center text-sm">
                                                    <Badge variant={item.receivedQty >= item.quantity ? "default" : "secondary"} className="rounded-lg">
                                                        {item.receivedQty}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right text-sm">{formatCurrency(item.subtotal)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="flex justify-between font-bold">
                                <span>Total</span><span>{formatCurrency(selectedPO.totalAmount)}</span>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Receive Dialog */}
            <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
                <DialogContent className="rounded-2xl max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Terima Barang - {selectedPO?.orderNumber}</DialogTitle>
                    </DialogHeader>
                    {selectedPO && (
                        <div className="space-y-4">
                            <p className="text-sm text-slate-500">Masukkan jumlah barang yang diterima untuk setiap item.</p>
                            <div className="border rounded-xl overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Produk</TableHead>
                                            <TableHead className="text-center">Order</TableHead>
                                            <TableHead className="text-center">Sudah</TableHead>
                                            <TableHead className="text-center">Terima</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedPO.items.map((item) => {
                                            const remaining = item.quantity - item.receivedQty;
                                            return (
                                                <TableRow key={item.id}>
                                                    <TableCell className="text-sm">{item.product.name}</TableCell>
                                                    <TableCell className="text-center text-sm">{item.quantity}</TableCell>
                                                    <TableCell className="text-center text-sm">{item.receivedQty}</TableCell>
                                                    <TableCell className="text-center">
                                                        <Input
                                                            type="number"
                                                            min={0}
                                                            max={remaining}
                                                            value={receiveQtys[item.id] || 0}
                                                            onChange={(e) => setReceiveQtys({ ...receiveQtys, [item.id]: Number(e.target.value) })}
                                                            className="w-20 mx-auto rounded-lg text-center text-sm"
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
                                <Button onClick={handleReceive} className="rounded-xl bg-green-600 hover:bg-green-700">Terima Barang</Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent className="rounded-2xl max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Konfirmasi</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">{confirmText}</p>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => { setConfirmOpen(false); setPendingConfirmAction(null); }} className="rounded-xl">Batal</Button>
                        <Button
                            variant="destructive"
                            onClick={async () => { await pendingConfirmAction?.(); }}
                            className="rounded-xl"
                        >
                            Ya, Lanjutkan
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
