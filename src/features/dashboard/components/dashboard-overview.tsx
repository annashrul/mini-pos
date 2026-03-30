import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardSummary } from "../types/dashboard.types";

interface Props {
  summary: DashboardSummary;
}

export function DashboardOverview({ summary }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-xs">Penjualan</CardTitle></CardHeader>
        <CardContent className="text-lg font-bold">{summary.totalSales}</CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-xs">Transaksi</CardTitle></CardHeader>
        <CardContent className="text-lg font-bold">{summary.totalTransactions}</CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-xs">Customer</CardTitle></CardHeader>
        <CardContent className="text-lg font-bold">{summary.totalCustomers}</CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-xs">Produk</CardTitle></CardHeader>
        <CardContent className="text-lg font-bold">{summary.totalProducts}</CardContent>
      </Card>
    </div>
  );
}
