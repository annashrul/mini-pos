"use client";

import { useState, useTransition } from "react";
import { createPromotion, updatePromotion, deletePromotion, getPromotions } from "@/features/promotions";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import type { SmartColumn, SmartFilter } from "@/components/ui/smart-table";
import { SmartTable } from "@/components/ui/smart-table";
import { Plus, Pencil, Trash2, Percent, Tag, Gift, Ticket, Package } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Promotion } from "@/types";

interface SimpleRef { id: string; name: string; code?: string }

interface Props {
  initialData: { promotions: Promotion[]; total: number; totalPages: number };
  categories: { id: string; name: string }[];
  products: SimpleRef[];
}

const typeLabels: Record<string, { label: string; icon: typeof Percent; color: string }> = {
  DISCOUNT_PERCENT: { label: "Diskon %", icon: Percent, color: "bg-blue-100 text-blue-700" },
  DISCOUNT_AMOUNT: { label: "Diskon Rp", icon: Tag, color: "bg-green-100 text-green-700" },
  BUY_X_GET_Y: { label: "Beli X Gratis Y", icon: Gift, color: "bg-purple-100 text-purple-700" },
  VOUCHER: { label: "Voucher", icon: Ticket, color: "bg-orange-100 text-orange-700" },
  BUNDLE: { label: "Bundle", icon: Package, color: "bg-pink-100 text-pink-700" },
};

const scopeLabels: Record<string, string> = { all: "Semua Produk", product: "Produk Tertentu", category: "Kategori Tertentu" };

export function PromotionsContent({ initialData, categories, products }: Props) {
  const [data, setData] = useState(initialData);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({ type: "ALL" });
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [loading, startTransition] = useTransition();

  // Form state
  const [formType, setFormType] = useState("DISCOUNT_PERCENT");
  const [formScope, setFormScope] = useState("all");

  const fetchData = (params: { search?: string; page?: number; pageSize?: number; filters?: Record<string, string>; sortKey?: string; sortDir?: "asc" | "desc" }) => {
    startTransition(async () => {
      const f = params.filters ?? activeFilters;
      const sk = params.sortKey ?? sortKey;
      const sd = params.sortDir ?? sortDir;
      const result = await getPromotions({
        search: params.search ?? search,
        ...(f.type !== "ALL" ? { type: f.type } : {}),
        page: params.page ?? page,
        perPage: params.pageSize ?? pageSize,
        ...(sk ? { sortBy: sk, sortDir: sd } : {}),
      });
      setData(result as never);
    });
  };

  const openForm = (promo: Promotion | null) => {
    setEditing(promo);
    setFormType(promo?.type || "DISCOUNT_PERCENT");
    setFormScope((promo as Promotion & { scope?: string })?.scope || "all");
    setOpen(true);
  };

  const handleSubmit = async (formData: FormData) => {
    formData.set("scope", formScope);
    if (!formData.get("isActive")) formData.set("isActive", "true");
    const result = editing ? await updatePromotion(editing.id, formData) : await createPromotion(formData);
    if (result.error) { toast.error(result.error); return; }
    toast.success(editing ? "Promo berhasil diupdate" : "Promo berhasil ditambahkan");
    setOpen(false); setEditing(null); fetchData({});
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus promo ini?")) return;
    const result = await deletePromotion(id);
    if (result.error) toast.error(result.error);
    else { toast.success("Promo dihapus"); fetchData({}); }
  };

  const columns: SmartColumn<Promotion>[] = [
    {
      key: "name", header: "Nama Promo", sortable: true,
      render: (row) => (
        <div>
          <p className="text-sm font-medium">{row.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {row.product ? `Produk: ${row.product.name}` : row.category ? `Kategori: ${row.category.name}` : "Semua produk"}
          </p>
        </div>
      ),
      exportValue: (row) => row.name,
    },
    {
      key: "type", header: "Tipe",
      render: (row) => {
        const t = typeLabels[row.type];
        return <Badge className={t?.color || ""}>{t?.label || row.type}</Badge>;
      },
      exportValue: (row) => typeLabels[row.type]?.label || row.type,
    },
    {
      key: "value", header: "Nilai", sortable: true, align: "right",
      render: (row) => {
        if (row.type === "BUY_X_GET_Y") return <span className="text-xs">Beli {(row as Promotion & { buyQty?: number }).buyQty || 1} Gratis {(row as Promotion & { getQty?: number }).getQty || 1}</span>;
        return <span className="text-xs">{row.type === "DISCOUNT_PERCENT" ? `${row.value}%` : formatCurrency(row.value)}</span>;
      },
      exportValue: (row) => row.value,
    },
    {
      key: "period", header: "Periode",
      render: (row) => <span className="text-xs text-muted-foreground">{format(new Date(row.startDate), "dd/MM/yy")} - {format(new Date(row.endDate), "dd/MM/yy")}</span>,
      exportValue: (row) => `${format(new Date(row.startDate), "dd/MM/yy")} - ${format(new Date(row.endDate), "dd/MM/yy")}`,
    },
    {
      key: "status", header: "Status", align: "center",
      render: (row) => {
        const expired = new Date(row.endDate) < new Date();
        return <Badge className={expired ? "bg-red-100 text-red-700" : row.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-700"}>
          {expired ? "Expired" : row.isActive ? "Aktif" : "Nonaktif"}
        </Badge>;
      },
    },
    {
      key: "actions", header: "Aksi", align: "right", sticky: true, width: "90px",
      render: (row) => (
        <div className="flex justify-end gap-0.5">
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => openForm(row)}><Pencil className="w-3.5 h-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(row.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
        </div>
      ),
    },
  ];

  const filters: SmartFilter[] = [
    { key: "type", label: "Tipe Promo", type: "select", options: Object.entries(typeLabels).map(([k, v]) => ({ value: k, label: v.label })) },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Promo</h1>
          <p className="text-muted-foreground text-sm">Kelola promo, diskon, dan voucher</p>
        </div>
        <Button className="rounded-lg" onClick={() => openForm(null)}><Plus className="w-4 h-4 mr-2" /> Tambah Promo</Button>
      </div>

      <SmartTable<Promotion>
        data={data.promotions} columns={columns} totalItems={data.total} totalPages={data.totalPages}
        currentPage={page} pageSize={pageSize} loading={loading}
        title="Daftar Promo" titleIcon={<Percent className="w-4 h-4 text-muted-foreground" />}
        searchPlaceholder="Cari promo..."
        onSearch={(q) => { setSearch(q); setPage(1); fetchData({ search: q, page: 1 }); }}
        onPageChange={(p) => { setPage(p); fetchData({ page: p }); }}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1); fetchData({ pageSize: s, page: 1 }); }}
        sortKey={sortKey} sortDir={sortDir} onSort={(k, d) => { setSortKey(k); setSortDir(d); setPage(1); fetchData({ page: 1, sortKey: k, sortDir: d }); }}
        filters={filters} activeFilters={activeFilters}
        onFilterChange={(f) => { setActiveFilters(f); setPage(1); fetchData({ filters: f, page: 1 }); }}
        selectable selectedRows={selectedRows} onSelectionChange={setSelectedRows} rowKey={(r) => r.id}
        exportFilename="promo" emptyIcon={<Percent className="w-10 h-10 text-muted-foreground/30" />} emptyTitle="Belum ada promo"
      />

      {/* Promo Form Dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="rounded-2xl max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Promo" : "Tambah Promo Baru"}</DialogTitle></DialogHeader>
          <form action={handleSubmit} className="space-y-4">
            {/* Basic Info */}
            <div className="space-y-1.5">
              <Label className="text-sm">Nama Promo <span className="text-red-400">*</span></Label>
              <Input name="name" defaultValue={editing?.name || ""} required className="rounded-lg" autoFocus placeholder="cth: Diskon Weekend 20%" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Deskripsi</Label>
              <Input name="description" defaultValue={(editing as Promotion & { description?: string })?.description || ""} className="rounded-lg" placeholder="Opsional" />
            </div>

            {/* Tipe Promo */}
            <div className="space-y-2">
              <Label className="text-sm">Tipe Promo <span className="text-red-400">*</span></Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.entries(typeLabels).filter(([k]) => k !== "BUNDLE").map(([key, meta]) => {
                  const Icon = meta.icon;
                  return (
                    <label key={key} className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border cursor-pointer transition-all
                      ${formType === key ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>
                      <input type="radio" name="type" value={key} checked={formType === key} onChange={() => setFormType(key)} className="sr-only" />
                      <Icon className={`w-5 h-5 ${formType === key ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="text-xs font-medium text-center">{meta.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Scope - berlaku untuk */}
            <div className="space-y-2">
              <Label className="text-sm">Berlaku Untuk</Label>
              <div className="flex gap-2">
                {(["all", "product", "category"] as const).map((s) => (
                  <button key={s} type="button" onClick={() => setFormScope(s)}
                    className={`flex-1 text-xs py-2 rounded-lg border font-medium transition-all
                      ${formScope === s ? "border-primary bg-primary/5 text-primary" : "border-border/50 text-muted-foreground hover:border-border"}`}>
                    {scopeLabels[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* Product/Category selector based on scope */}
            {formScope === "product" && (
              <div className="space-y-1.5">
                <Label className="text-sm">Pilih Produk <span className="text-red-400">*</span></Label>
                <select name="productId" defaultValue={editing?.productId || ""} required className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm">
                  <option value="">Pilih produk</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
                </select>
              </div>
            )}

            {formScope === "category" && (
              <div className="space-y-1.5">
                <Label className="text-sm">Pilih Kategori <span className="text-red-400">*</span></Label>
                <select name="categoryId" defaultValue={editing?.categoryId || ""} required className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm">
                  <option value="">Pilih kategori</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            <Separator />

            {/* Type-specific fields */}
            {(formType === "DISCOUNT_PERCENT" || formType === "DISCOUNT_AMOUNT") && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">{formType === "DISCOUNT_PERCENT" ? "Diskon (%)" : "Diskon (Rp)"} <span className="text-red-400">*</span></Label>
                  <Input name="value" type="number" defaultValue={editing?.value || ""} required className="rounded-lg" min={0} />
                </div>
                {formType === "DISCOUNT_PERCENT" && (
                  <div className="space-y-1.5">
                    <Label className="text-sm">Maks. Diskon (Rp)</Label>
                    <Input name="maxDiscount" type="number" defaultValue={(editing as Promotion & { maxDiscount?: number })?.maxDiscount || ""} className="rounded-lg" min={0} placeholder="Tanpa batas" />
                  </div>
                )}
              </div>
            )}

            {formType === "BUY_X_GET_Y" && (
              <div className="space-y-3">
                <div className="bg-muted/30 rounded-xl p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Beli X Gratis Y</p>
                  <p>Pelanggan beli sejumlah produk dan mendapat produk gratis</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm">Beli (qty) <span className="text-red-400">*</span></Label>
                    <Input name="buyQty" type="number" defaultValue={(editing as Promotion & { buyQty?: number })?.buyQty || 1} required className="rounded-lg" min={1} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Gratis (qty) <span className="text-red-400">*</span></Label>
                    <Input name="getQty" type="number" defaultValue={(editing as Promotion & { getQty?: number })?.getQty || 1} required className="rounded-lg" min={1} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Produk Gratis</Label>
                  <select name="getProductId" defaultValue={(editing as Promotion & { getProductId?: string })?.getProductId || ""} className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm">
                    <option value="">Sama dengan produk yang dibeli</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
                  </select>
                  <p className="text-[11px] text-muted-foreground">Kosongkan jika produk gratis sama dengan produk yang dibeli</p>
                </div>
                <input type="hidden" name="value" value="0" />
              </div>
            )}

            {formType === "VOUCHER" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">Kode Voucher <span className="text-red-400">*</span></Label>
                  <Input name="voucherCode" defaultValue={editing?.voucherCode || ""} required className="rounded-lg font-mono" placeholder="HEMAT20" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Nilai Diskon (Rp) <span className="text-red-400">*</span></Label>
                  <Input name="value" type="number" defaultValue={editing?.value || ""} required className="rounded-lg" min={0} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Batas Penggunaan</Label>
                  <Input name="usageLimit" type="number" defaultValue={(editing as Promotion & { usageLimit?: number })?.usageLimit || ""} className="rounded-lg" min={1} placeholder="Tanpa batas" />
                </div>
              </div>
            )}

            {/* Min purchase */}
            <div className="space-y-1.5">
              <Label className="text-sm">Min. Pembelian (Rp)</Label>
              <Input name="minPurchase" type="number" defaultValue={editing?.minPurchase || ""} className="rounded-lg" min={0} placeholder="Tanpa minimum" />
            </div>

            {/* Period */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Mulai <span className="text-red-400">*</span></Label>
                <Input name="startDate" type="date" defaultValue={editing ? format(new Date(editing.startDate), "yyyy-MM-dd") : ""} required className="rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Berakhir <span className="text-red-400">*</span></Label>
                <Input name="endDate" type="date" defaultValue={editing ? format(new Date(editing.endDate), "yyyy-MM-dd") : ""} required className="rounded-lg" />
              </div>
            </div>

            <input type="hidden" name="isActive" value={editing ? String(editing.isActive) : "true"} />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => { setOpen(false); setEditing(null); }} className="rounded-lg">Batal</Button>
              <Button type="submit" className="rounded-lg">{editing ? "Update" : "Simpan"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
