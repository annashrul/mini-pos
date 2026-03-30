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

export interface ProductSearchResult {
  id: string;
  code: string;
  name: string;
  sellingPrice: number;
  purchasePrice: number;
  stock: number;
  minStock: number;
  unit: string;
  category: { name: string };
  imageUrl?: string | null;
  tierPrices?: ProductTierPrice[];
}

export interface CartItem {
  productId: string;
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
}
