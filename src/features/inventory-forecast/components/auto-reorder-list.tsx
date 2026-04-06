"use client";

import { useEffect, useState, useTransition } from "react";
import { formatCurrency } from "@/lib/utils";
import {
  generateAutoReorderList,
  type SupplierReorderGroup,
  type RiskLevel,
} from "@/server/actions/inventory-forecast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Building2,
  FileText,
  Mail,
  Phone,
  ShoppingCart,
  Truck,
} from "lucide-react";

interface Props {
  branchId?: string | undefined;
}

const riskColors: Record<RiskLevel, string> = {
  CRITICAL: "bg-red-50 text-red-700 border-red-200",
  WARNING: "bg-amber-50 text-amber-700 border-amber-200",
  LOW: "bg-blue-50 text-blue-700 border-blue-200",
  SAFE: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const riskLabels: Record<RiskLevel, string> = {
  CRITICAL: "Kritis",
  WARNING: "Peringatan",
  LOW: "Rendah",
  SAFE: "Aman",
};

export function AutoReorderList({ branchId }: Props) {
  const [groups, setGroups] = useState<SupplierReorderGroup[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const data = await generateAutoReorderList(branchId);
      setGroups(data);
    });
  }, [branchId]);

  if (isPending) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => (
          <Card key={i}>
            <CardContent className="py-12">
              <div className="flex items-center justify-center text-sm text-slate-400">Memuat data reorder...</div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <Card>
        <CardContent className="py-16">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <ShoppingCart className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-1">Semua Stok Aman</h3>
            <p className="text-sm text-slate-400">Tidak ada produk yang memerlukan pemesanan ulang saat ini.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalItems = groups.reduce((s, g) => s + g.items.length, 0);
  const totalCost = groups.reduce((s, g) => s + g.totalEstimatedCost, 0);

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-violet-50 border border-violet-100">
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-violet-600" />
          <span className="text-sm font-medium text-violet-700">{groups.length} supplier</span>
        </div>
        <div className="text-sm text-violet-600">{totalItems} produk perlu diorder</div>
        <div className="ml-auto text-sm font-semibold text-violet-700">
          Total estimasi: {formatCurrency(totalCost)}
        </div>
      </div>

      {/* Supplier groups */}
      {groups.map(group => (
        <Card key={group.supplierId} className="overflow-hidden">
          <CardHeader className="bg-slate-50/80 border-b border-slate-100 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold text-slate-800">
                    {group.supplierName}
                  </CardTitle>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                    {group.supplierContact && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {group.supplierContact}
                      </span>
                    )}
                    {group.supplierEmail && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {group.supplierEmail}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right mr-3">
                  <p className="text-xs text-slate-500">Estimasi</p>
                  <p className="text-sm font-bold text-slate-800">{formatCurrency(group.totalEstimatedCost)}</p>
                </div>
                <Button size="sm" className="gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-sm">
                  <FileText className="w-3.5 h-3.5" />
                  Buat PO
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Produk</TableHead>
                  <TableHead className="text-right">Stok</TableHead>
                  <TableHead className="text-right">Avg/Hari</TableHead>
                  <TableHead className="text-right">Sisa Hari</TableHead>
                  <TableHead>Risiko</TableHead>
                  <TableHead className="text-right">Order Qty</TableHead>
                  <TableHead className="text-right">Harga Beli</TableHead>
                  <TableHead className="text-right">Est. Biaya</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.items.map(item => (
                  <TableRow key={item.productId}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm text-slate-800">{item.productName}</p>
                        <p className="text-xs text-slate-400">{item.productCode}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-slate-700">{item.currentStock}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-slate-700">{item.avgDailySales}</TableCell>
                    <TableCell className="text-right">
                      <span className={`text-sm tabular-nums font-medium ${item.daysUntilStockout < 3 ? "text-red-600" : item.daysUntilStockout < 7 ? "text-amber-600" : "text-slate-700"}`}>
                        {item.daysUntilStockout >= 9999 ? "N/A" : `${item.daysUntilStockout}d`}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={riskColors[item.riskLevel]}>
                        {riskLabels[item.riskLevel]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold tabular-nums text-violet-700">{item.recommendedQty}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-slate-600">{formatCurrency(item.purchasePrice)}</TableCell>
                    <TableCell className="text-right text-sm font-medium tabular-nums text-slate-800">{formatCurrency(item.estimatedCost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
