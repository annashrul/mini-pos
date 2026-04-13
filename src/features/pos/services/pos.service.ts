import { searchProducts, findByBarcode, browseProducts } from "@/server/actions/products";
import { getAllCategories } from "@/server/actions/categories";
import { getAllBranches } from "@/server/actions/branches";
import { createTransaction } from "@/server/actions/transactions";
import { getActiveShift, hasClosedShiftToday, openShift, closeShift, getShiftSummary } from "@/server/actions/shifts";
import { calculateAutoPromo, validateVoucher, findCustomerByPhone, getTebusMurahOptions } from "@/server/actions/promo-engine";
import { redeemPoints } from "@/server/actions/points";
import { getReceiptConfig, getPosConfig } from "@/server/actions/settings";
import { getActiveBundles } from "@/server/actions/bundles";

export const posService = {
  searchProducts,
  findByBarcode,
  browseProducts,
  getAllCategories,
  getAllBranches,
  createTransaction,
  getActiveShift,
  hasClosedShiftToday,
  openShift,
  closeShift,
  getShiftSummary,
  calculateAutoPromo,
  getTebusMurahOptions,
  validateVoucher,
  findCustomerByPhone,
  redeemPoints,
  getReceiptConfig,
  getPosConfig,
  getActiveBundles,
};
