import { reportsService } from "@/features/reports";
import { ReportsContent } from "@/features/reports";

export default async function ReportsPage() {
    const [dailySales, monthlySales, topProducts, profitLoss, paymentMethods, hourlySales, overview] = await Promise.all([
        reportsService.getSalesReport("daily"),
        reportsService.getSalesReport("monthly"),
        reportsService.getTopProductsReport(),
        reportsService.getProfitLossReport(),
        reportsService.getPaymentMethodReport(),
        reportsService.getHourlySalesReport(),
        reportsService.getReportOverview(),
    ]);

    return (
        <ReportsContent
            dailySales={dailySales}
            monthlySales={monthlySales}
            topProducts={topProducts}
            profitLoss={profitLoss}
            paymentMethods={paymentMethods}
            hourlySales={hourlySales}
            overview={overview}
        />
    );
}
