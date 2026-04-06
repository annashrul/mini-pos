"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { createPriceSchedule } from "@/features/price-schedules";
import { searchProducts } from "@/server/actions/products";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import {
  CalendarIcon,
  Check,
  ChevronsUpDown,
  Loader2,
  TrendingDown,
  TrendingUp,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Branch {
  id: string;
  name: string;
  isActive: boolean;
}

interface ProductOption {
  id: string;
  name: string;
  code: string;
  sellingPrice: number;
}

interface NewScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  branches: Branch[];
}

export function NewScheduleDialog({
  open,
  onOpenChange,
  onCreated,
  branches,
}: NewScheduleDialogProps) {
  const [productOpen, setProductOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(
    null
  );
  const [newPrice, setNewPrice] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [reason, setReason] = useState("");
  const [branchId, setBranchId] = useState("none");
  const [saving, startSaving] = useTransition();
  const [searching, setSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Search products with debounce
  useEffect(() => {
    if (!productSearch || productSearch.length < 1) {
      setProductOptions([]);
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    setSearching(true);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchProducts(productSearch);
        setProductOptions(
          (results as ProductOption[]).map((p) => ({
            id: p.id,
            name: p.name,
            code: p.code,
            sellingPrice: p.sellingPrice,
          }))
        );
      } catch {
        setProductOptions([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [productSearch]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedProduct(null);
      setNewPrice("");
      setStartDate(undefined);
      setEndDate(undefined);
      setReason("");
      setBranchId("none");
      setProductSearch("");
      setProductOptions([]);
    }
  }, [open]);

  const currentPrice = selectedProduct?.sellingPrice ?? 0;
  const newPriceNum = parseFloat(newPrice) || 0;
  const discountPercent =
    currentPrice > 0
      ? Math.round(((currentPrice - newPriceNum) / currentPrice) * 100)
      : 0;
  const isIncrease = newPriceNum > currentPrice;

  const handleSubmit = () => {
    if (!selectedProduct) {
      toast.error("Pilih produk terlebih dahulu");
      return;
    }
    if (!newPriceNum || newPriceNum <= 0) {
      toast.error("Masukkan harga baru yang valid");
      return;
    }
    if (!startDate) {
      toast.error("Pilih tanggal mulai");
      return;
    }
    if (!endDate) {
      toast.error("Pilih tanggal selesai");
      return;
    }
    if (endDate <= startDate) {
      toast.error("Tanggal selesai harus setelah tanggal mulai");
      return;
    }

    startSaving(async () => {
      const payload: {
        productId: string;
        newPrice: number;
        startDate: string;
        endDate: string;
        reason?: string;
        branchId?: string;
      } = {
        productId: selectedProduct.id,
        newPrice: newPriceNum,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };
      if (reason) payload.reason = reason;
      if (branchId !== "none") payload.branchId = branchId;

      const result = await createPriceSchedule(payload);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Jadwal harga berhasil dibuat");
        onCreated();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Jadwal Harga Baru
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Product Search Combobox */}
          <div className="space-y-2">
            <Label>Produk</Label>
            <Popover open={productOpen} onOpenChange={setProductOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={productOpen}
                  className="w-full justify-between font-normal"
                >
                  {selectedProduct
                    ? `${selectedProduct.name} (${selectedProduct.code})`
                    : "Cari produk..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[460px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Ketik nama atau kode produk..."
                    value={productSearch}
                    onValueChange={setProductSearch}
                  />
                  <CommandList>
                    {searching ? (
                      <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Mencari...
                      </div>
                    ) : productOptions.length === 0 ? (
                      <CommandEmpty>
                        {productSearch
                          ? "Produk tidak ditemukan"
                          : "Ketik untuk mencari produk"}
                      </CommandEmpty>
                    ) : (
                      <CommandGroup>
                        {productOptions.map((product) => (
                          <CommandItem
                            key={product.id}
                            value={product.id}
                            onSelect={() => {
                              setSelectedProduct(product);
                              setProductOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedProduct?.id === product.id
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            <div className="flex-1">
                              <p className="font-medium">{product.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {product.code} &middot;{" "}
                                {formatCurrency(product.sellingPrice)}
                              </p>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Current Price Display */}
          {selectedProduct && (
            <div className="rounded-lg border bg-gray-50 p-3">
              <p className="text-xs text-muted-foreground mb-1">Harga Saat Ini</p>
              <p className="text-lg font-bold">
                {formatCurrency(selectedProduct.sellingPrice)}
              </p>
            </div>
          )}

          {/* New Price */}
          <div className="space-y-2">
            <Label>Harga Baru</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                Rp
              </span>
              <Input
                type="number"
                placeholder="0"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="pl-10"
              />
            </div>
            {selectedProduct && newPriceNum > 0 && (
              <div className="flex items-center gap-2">
                {isIncrease ? (
                  <Badge
                    variant="outline"
                    className="bg-red-50 text-red-600 border-red-200 gap-1"
                  >
                    <TrendingUp className="h-3 w-3" />
                    Naik {Math.abs(discountPercent)}%
                  </Badge>
                ) : discountPercent > 0 ? (
                  <Badge
                    variant="outline"
                    className="bg-emerald-50 text-emerald-600 border-emerald-200 gap-1"
                  >
                    <TrendingDown className="h-3 w-3" />
                    Diskon {discountPercent}%
                  </Badge>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  Selisih: {formatCurrency(Math.abs(currentPrice - newPriceNum))}
                </span>
              </div>
            )}
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tanggal Mulai</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd MMM yyyy") : "Pilih tanggal"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Tanggal Selesai</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd MMM yyyy") : "Pilih tanggal"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    disabled={(date) =>
                      startDate ? date <= startDate : false
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label>Alasan / Catatan (opsional)</Label>
            <Textarea
              placeholder="Contoh: Promo akhir tahun, penyesuaian harga supplier..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>

          {/* Branch */}
          {branches.length > 0 && (
            <div className="space-y-2">
              <Label>Cabang (opsional)</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger>
                  <SelectValue placeholder="Semua cabang" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Semua Cabang</SelectItem>
                  {branches
                    .filter((b) => b.isActive)
                    .map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Batal
            </Button>
            <Button onClick={handleSubmit} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan Jadwal
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
