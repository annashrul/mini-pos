import type { ProductSearchResult } from "@/types";
import type { PosProductCacheEntry, RawPosProduct } from "../types";

export const STORAGE_KEY = "pos-draft-cart";
export const POS_TERMINAL_KEY = "pos-terminal-session";
export const POS_PRODUCT_CACHE_KEY = "pos-product-cache";
export const POS_ALL_CATEGORY_KEY = "__all__";

export const PAYMENT_METHOD_OPTIONS = [
  { value: "CASH", label: "Cash" },
  { value: "TRANSFER", label: "Transfer Bank" },
  { value: "QRIS", label: "QRIS" },
  { value: "EWALLET", label: "E-Wallet" },
  { value: "DEBIT", label: "Debit" },
  { value: "CREDIT_CARD", label: "Kartu Kredit" },
  { value: "TERMIN", label: "Termin" },
] as const;

export function toProductSearchResult(
  product: RawPosProduct,
): ProductSearchResult {
  return {
    id: product.id,
    code: product.code,
    name: product.name,
    ...(product.categoryId ? { categoryId: product.categoryId } : {}),
    sellingPrice: product.sellingPrice,
    purchasePrice: product.purchasePrice,
    stock: product.stock,
    minStock: product.minStock,
    unit: product.unit,
    imageUrl: product.imageUrl ?? null,
    category: { name: product.category?.name ?? "" },
    ...(product.units && product.units.length > 0 ? { units: product.units } : {}),
    ...(product.matchedUnit ? { matchedUnit: product.matchedUnit } : {}),
  };
}

export function getPosCategoryCacheKey(selectedCategory: string) {
  return selectedCategory || POS_ALL_CATEGORY_KEY;
}

export function readPosProductCache(
  storageKey: string,
): Map<string, PosProductCacheEntry> {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (raw) return new Map(JSON.parse(raw));
  } catch {
    return new Map();
  }
  return new Map();
}

export function writePosProductCache(
  storageKey: string,
  cache: Map<string, PosProductCacheEntry>,
) {
  try {
    sessionStorage.setItem(
      storageKey,
      JSON.stringify(Array.from(cache.entries())),
    );
  } catch {
    return;
  }
}
