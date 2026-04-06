import * as actions from "@/server/actions/customer-intelligence";

export const customerIntelligenceService = {
  getRepeatCustomers: actions.getRepeatCustomers,
  getCustomerFavorites: actions.getCustomerFavorites,
  getShoppingFrequency: actions.getShoppingFrequency,
  getLoyaltySummary: actions.getLoyaltySummary,
};
