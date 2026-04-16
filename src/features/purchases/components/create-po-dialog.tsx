"use client";

import { useState, useEffect, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createPurchaseOrder } from "@/features/purchases";
import { getProducts } from "@/features/products";
import { getSuppliers } from "@/features/suppliers";
import { getBranches } from "@/features/branches";
import { createPurchaseOrderSchema, type CreatePurchaseOrderInput } from "@/features/purchases/schemas/purchases.schema";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SmartSelect } from "@/components/ui/smart-select";
import { BranchMultiSelect } from "@/components/ui/branch-multi-select";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Plus, Minus, Trash2, Package, ShoppingBasket, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Supplier = { id: string; name: string; isActive: boolean };
type Branch = { id: string; name: string; isActive: boolean };
type ProductOption = { id: string; name: string; code: string; purchasePrice: number; unit: string; stock: number };

interface CreatePODialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreatePODialog({ open, onOpenChange, onSuccess }: CreatePODialogProps) {
  const [isPending, startTransition] = useTransition();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [newQty, setNewQty] = useState(1);
  const [newPrice, setNewPrice] = useState(0);

  const form = useForm<CreatePurchaseOrderInput>({
    resolver: zodResolver(createPurchaseOrderSchema),
    defaultValues: { supplierId: "", branchIds: [], expectedDate: "", notes: "", items: [] },
  });

  const watchedItems = form.watch("items");
  const cartTotal = watchedItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      const [suppData, branchData, prodData] = await Promise.all([
        getSuppliers({ page: 1, perPage: 500 }),
        getBranches(),
        getProducts({ page: 1, limit: 1000 }),
      ]);
      setSuppliers(suppData.suppliers.map((s) => ({ id: s.id, name: s.name, isActive: s.isActive })));
      setBranches(branchData.branches.map((b) => ({ id: b.id, name: b.name, isActive: b.isActive })));
      setProductOptions(
        prodData.products.map((p) => ({
          id: p.id, name: p.name, code: p.code,
          purchasePrice: p.purchasePrice, unit: p.unit, stock: p.stock,
        }))
      );
    });
    form.reset();
    setSelectedProductId("");
    setNewQty(1);
    setNewPrice(0);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const addItem = () => {
    if (!selectedProductId) return;
    const product = productOptions.find((p) => p.id === selectedProductId);
    if (!product) return;
    const existing = form.getValues("items");
    if (existing.some((i) => i.productId === selectedProductId)) {
      toast.error("Produk sudah ada di daftar");
      return;
    }
    form.setValue("items", [...existing, {
      productId: product.id,
      productName: product.name,
      quantity: newQty,
      unitPrice: newPrice,
    }], { shouldValidate: true });
    setSelectedProductId("");
    setNewQty(1);
    setNewPrice(0);
  };

  const removeItem = (idx: number) => {
    const items = form.getValues("items");
    form.setValue("items", items.filter((_, i) => i !== idx), { shouldValidate: true });
  };

  const handleSubmit = async (data: CreatePurchaseOrderInput) => {
    const result = await createPurchaseOrder({
      supplierId: data.supplierId,
      ...(data.branchIds.length > 0 ? { branchIds: data.branchIds } : {}),
      items: data.items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice })),
      ...(data.expectedDate ? { expectedDate: data.expectedDate } : {}),
      ...(data.notes ? { notes: data.notes } : {}),
    });
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Purchase Order berhasil dibuat");
      onOpenChange(false);
      form.reset();
      onSuccess?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) form.reset(); }}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-4xl rounded-xl sm:rounded-2xl max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0">
        <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 shrink-0" />
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 shrink-0">
          <DialogTitle className="text-base sm:text-lg font-bold">Buat Purchase Order</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-3 sm:space-y-5 overflow-x-hidden px-4 sm:px-6">
          {/* Supplier, Location, Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm font-medium">Supplier <span className="text-red-400">*</span></Label>
              <Controller name="supplierId" control={form.control} render={({ field }) => (
                <SmartSelect value={field.value} onChange={field.onChange} placeholder="Pilih supplier"
                  onSearch={async (q) => suppliers.filter((s) => s.isActive && s.name.toLowerCase().includes(q.toLowerCase())).map((s) => ({ value: s.id, label: s.name }))} />
              )} />
              {form.formState.errors.supplierId && <p className="text-xs text-red-500">{form.formState.errors.supplierId.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm font-medium">Lokasi <span className="text-red-400">*</span></Label>
              <Controller name="branchIds" control={form.control} render={({ field }) => (
                <BranchMultiSelect branches={branches.filter((b) => b.isActive)} value={field.value} onChange={field.onChange} placeholder="Pilih lokasi" />
              )} />
              {form.formState.errors.branchIds && <p className="text-xs text-red-500">{form.formState.errors.branchIds.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm font-medium">Tgl Diharapkan</Label>
              <Controller name="expectedDate" control={form.control} render={({ field }) => (
                <DatePicker value={field.value ?? ""} onChange={field.onChange} className="rounded-xl" />
              )} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs sm:text-sm font-medium">Catatan</Label>
            <Input {...form.register("notes")} className="rounded-xl" placeholder="Catatan tambahan..." />
          </div>

          {/* Add item */}
          <div className="sticky top-0 z-10 py-2 bg-white/95 backdrop-blur-sm border-y border-slate-200/60">
            <div className="rounded-xl bg-slate-50 border border-slate-200/60 p-2 sm:p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Package className="w-3.5 h-3.5 text-emerald-600" />
                <Label className="font-semibold text-xs sm:text-sm">Tambah Produk</Label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                <div className="sm:col-span-5">
                  <SmartSelect value={selectedProductId}
                    onChange={(v) => { setSelectedProductId(v); const p = productOptions.find((i) => i.id === v); if (p) setNewPrice(p.purchasePrice); }}
                    placeholder="Pilih produk"
                    onSearch={async (q) => productOptions.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.code.toLowerCase().includes(q.toLowerCase())).map((p) => ({ value: p.id, label: p.name, description: `${p.code} • Stok ${p.stock}` }))} />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:contents">
                  <div className="sm:col-span-2">
                    <Input type="number" value={newQty} onChange={(e) => setNewQty(Number(e.target.value))} className="rounded-xl" min={1} placeholder="Qty" />
                  </div>
                  <div className="sm:col-span-3">
                    <Input type="number" value={newPrice} onChange={(e) => setNewPrice(Number(e.target.value))} className="rounded-xl" min={0} placeholder="Harga" />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <Button onClick={addItem} className="rounded-xl w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
                    <Plus className="w-3.5 h-3.5 mr-1" /> Tambah
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Items */}
          {form.formState.errors.items?.message && <p className="text-xs text-red-500">{form.formState.errors.items.message}</p>}
          {watchedItems.length > 0 ? (
            <div className="space-y-1.5">
              {watchedItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 sm:p-3 group">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium truncate">{item.productName}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">{formatCurrency(item.unitPrice)} / unit</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg"
                      onClick={() => { const items = form.getValues("items"); form.setValue("items", items.map((ci, idx) => idx === i && ci.quantity > 1 ? { ...ci, quantity: ci.quantity - 1 } : ci), { shouldValidate: true }); }}>
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="w-7 text-center text-xs font-semibold tabular-nums">{item.quantity}</span>
                    <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg"
                      onClick={() => { const items = form.getValues("items"); form.setValue("items", items.map((ci, idx) => idx === i ? { ...ci, quantity: ci.quantity + 1 } : ci), { shouldValidate: true }); }}>
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                  <span className="text-xs sm:text-sm font-semibold tabular-nums min-w-[60px] text-right">{formatCurrency(item.quantity * item.unitPrice)}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => removeItem(i)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Package className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-xs text-muted-foreground">Belum ada item. Pilih produk di atas.</p>
            </div>
          )}
        </DialogBody>

        <DialogFooter className="px-4 sm:px-6 py-3 sm:py-4 shrink-0 border-t">
          <div className="flex items-center justify-between w-full gap-2">
            {watchedItems.length > 0 ? (
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[10px] sm:text-sm font-medium text-emerald-700">Total:</span>
                <span className="font-mono text-sm sm:text-lg font-bold text-emerald-700 tabular-nums truncate">{formatCurrency(cartTotal)}</span>
              </div>
            ) : <div />}
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Batal</Button>
              <Button onClick={form.handleSubmit(handleSubmit)} disabled={isPending} className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
                {isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ShoppingBasket className="w-4 h-4 mr-1.5" />}
                {isPending ? "Menyimpan..." : "Buat PO"}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
