import { reportsService } from "@/features/reports";
import { ReportsContent } from "@/features/reports";

export default async function ReportsPage() {
  const [dailySales, monthlySales, topProducts, profitLoss] = await Promise.all([
    reportsService.getSalesReport("daily"),
    reportsService.getSalesReport("monthly"),
    reportsService.getTopProductsReport(),
    reportsService.getProfitLossReport(),
  ]);

  return (
    <ReportsContent
      dailySales={dailySales}
      monthlySales={monthlySales}
      topProducts={topProducts}
      profitLoss={profitLoss}
    />
  );
}
