export interface Product {
  id: string;
  code: string;
  name: string;
  categoryId: string;
  category: { id: string; name: string };
  brandId?: string | null;
  brand?: { id: string; name: string } | null;
  supplierId?: string | null;
  supplier?: { id: string; name: string } | null;
  purchasePrice: number;
  sellingPrice: number;
  stock: number;
  minStock: number;
  barcode: string | null;
  unit: string;
  isActive: boolean;
  description: string | null;
  imageUrl?: string | null;
  tierPrices?: ProductTierPrice[];
}

export interface ProductTierPrice {
  minQty: number;
  price: number;
}

export interface ProductUnitOption {
  id: string;
  name: string;
  conversionQty: number;
  sellingPrice: number;
  purchasePrice: number | null;
  barcode: string | null;
}

export interface ProductSearchResult {
  id: string;
  code: string;
  name: string;
  categoryId?: string;
  sellingPrice: number;
  purchasePrice: number;
  stock: number;
  minStock: number;
  unit: string;
  category: { name: string };
  imageUrl?: string | null;
  tierPrices?: ProductTierPrice[];
  units?: ProductUnitOption[];
  /** Set when scanned via unit barcode */
  matchedUnit?: {
    name: string;
    conversionQty: number;
    sellingPrice: number;
  } | null;
}

export interface CartItem {
  lineId?: string;
  productId: string;
  categoryId?: string;
  productName: string;
  productCode: string;
  quantity: number;
  unitPrice: number;
  purchasePrice: number;
  discount: number;
  subtotal: number;
  maxStock: number;
  baseUnitPrice?: number;
  tierPrices?: ProductTierPrice[];
  tebusPromoId?: string;
  tebusPromoName?: string;
  bundleId?: string;
  bundleItems?: {
    productId: string;
    productName: string;
    productCode: string;
    quantity: number;
    unitPrice: number;
    purchasePrice: number;
  }[];
  /** Unit name for display, e.g. "Karung", "Kg" */
  unitName?: string;
  /** How many base units per this unit, e.g. 1 Karung = 25 Kg => conversionQty=25 */
  conversionQty?: number;
}
