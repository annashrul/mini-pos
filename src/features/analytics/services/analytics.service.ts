import * as actions from "@/server/actions/analytics";

export const analyticsService = {
  getMarginAnalysis: actions.getMarginAnalysis,
  getCategoryMarginAnalysis: actions.getCategoryMarginAnalysis,
  getDeadStock: actions.getDeadStock,
  getSlowMoving: actions.getSlowMoving,
  getPeakHours: actions.getPeakHours,
  getReorderAlerts: actions.getReorderAlerts,
  getVoidAbuseDetection: actions.getVoidAbuseDetection,
  getDailyProfit: actions.getDailyProfit,
  getShiftProfit: actions.getShiftProfit,
  getSupplierRanking: actions.getSupplierRanking,
  getSupplierDebt: actions.getSupplierDebt,
  getUnusualDiscounts: actions.getUnusualDiscounts,
  getPromoEffectiveness: actions.getPromoEffectiveness,
  getReorderRecommendations: actions.getReorderRecommendations,
  getCashierPerformance: actions.getCashierPerformance,
};
