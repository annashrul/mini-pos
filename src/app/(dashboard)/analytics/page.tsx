export const dynamic = "force-dynamic";

import { analyticsService } from "@/features/analytics";
import { AnalyticsContent } from "@/features/analytics";

export default async function AnalyticsPage() {
  const [
    marginData,
    categoryMargins,
    deadStock,
    slowMoving,
    peakHours,
    voidAbuse,
    cashierPerf,
    dailyProfit,
    shiftProfit,
    supplierRanking,
    supplierDebt,
    unusualDiscounts,
    promoEffectiveness,
    reorderRecommendations,
  ] = await Promise.all([
    analyticsService.getMarginAnalysis(),
    analyticsService.getCategoryMarginAnalysis(),
    analyticsService.getDeadStock(),
    analyticsService.getSlowMoving(),
    analyticsService.getPeakHours(),
    analyticsService.getVoidAbuseDetection(),
    analyticsService.getCashierPerformance(),
    analyticsService.getDailyProfit(),
    analyticsService.getShiftProfit(),
    analyticsService.getSupplierRanking(),
    analyticsService.getSupplierDebt(),
    analyticsService.getUnusualDiscounts(),
    analyticsService.getPromoEffectiveness(),
    analyticsService.getReorderRecommendations(),
  ]);

  return (
    <AnalyticsContent
      marginData={marginData}
      categoryMargins={categoryMargins}
      deadStock={deadStock}
      slowMoving={slowMoving}
      peakHours={peakHours}
      voidAbuse={voidAbuse}
      cashierPerf={cashierPerf}
      dailyProfit={dailyProfit}
      shiftProfit={shiftProfit}
      supplierRanking={supplierRanking}
      supplierDebt={supplierDebt}
      unusualDiscounts={unusualDiscounts}
      promoEffectiveness={promoEffectiveness}
      reorderRecommendations={reorderRecommendations}
    />
  );
}
