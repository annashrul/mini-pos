"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import { Search, Loader2, PackageOpen, X } from "lucide-react";
import { searchProductsByBranch } from "@/server/actions/products";

export interface ProductPickerItem {
  productId: string;
  productName: string;
  productCode: string;
  productPrice: number;
  productStock?: number;
  quantity: number;
}

interface ProductPickerProps {
  /** Selected items */
  items: ProductPickerItem[];
  /** Callback when items change */
  onChange: (items: ProductPickerItem[]) => void;
  /** Single branch ID for filtering products */
  branchId?: string | null | undefined;
  /** Multiple branch IDs for filtering products */
  branchIds?: string[] | undefined;
  /** Category ID for filtering (optional) */
  categoryId?: string | null;
  /** Label text */
  label?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Placeholder for search input */
  searchPlaceholder?: string;
  /** Empty state text */
  emptyText?: string;
  /** Show price in item list */
  showPrice?: boolean;
  /** Show stock in search results */
  showStock?: boolean;
  /** Show quantity controls */
  showQuantity?: boolean;
  /** Show subtotal per item */
  showSubtotal?: boolean;
  /** Single select mode (only 1 item allowed) */
  single?: boolean;
  /** Use purchase price instead of selling price */
  usePurchasePrice?: boolean;
  /** Allow editing price per item */
  editablePrice?: boolean;
  /** Make search bar sticky when scrolling */
  stickySearch?: boolean;
  /** Skip BranchStock filter — show all products regardless of branch stock (useful for PO) */
  skipBranchStockFilter?: boolean;
  /** Render extra content per item (e.g. type selector) */
  renderItemExtra?: (productId: string) => React.ReactNode;
  /** Error message */
  error?: string | undefined;
  /** Disabled state */
  disabled?: boolean;
}

export function ProductPicker({
  items,
  onChange,
  branchId,
  branchIds,
  categoryId,
  label = "Produk",
  required = false,
  searchPlaceholder = "Cari produk...",
  emptyText = "Belum ada produk",
  showPrice = true,
  showStock = true,
  showQuantity = true,
  showSubtotal = true,
  single = false,
  usePurchasePrice = false,
  editablePrice = false,
  stickySearch = false,
  skipBranchStockFilter = false,
  renderItemExtra,
  error,
  disabled = false,
}: ProductPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{ id: string; code: string; name: string; sellingPrice: number; purchasePrice?: number; stock?: number }>
  >([]);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const currentQueryRef = useRef("");

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchResults([]);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  // Always use latest props via ref to avoid stale closures
  const branchIdRef = useRef(branchId);
  branchIdRef.current = branchId;
  const branchIdsRef = useRef(branchIds);
  branchIdsRef.current = branchIds;
  const categoryIdRef = useRef(categoryId);
  categoryIdRef.current = categoryId;

  const fetchProducts = useCallback(async (query: string, page: number, append = false) => {
    if (append) setLoadingMore(true);
    else setSearching(true);
    try {
      const result = await searchProductsByBranch({
        branchId: branchIdRef.current || undefined,
        branchIds: branchIdsRef.current?.length ? branchIdsRef.current : undefined,
        categoryId: categoryIdRef.current ?? undefined,
        search: query,
        page,
        limit: 10,
        skipBranchStockFilter,
      });
      if (append) {
        setSearchResults((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          return [...prev, ...result.items.filter((p) => !existingIds.has(p.id))];
        });
      } else {
        setSearchResults(result.items);
      }
      setHasMore(result.hasMore);
      setSearchPage(page);
    } catch {
      if (!append) setSearchResults([]);
      setHasMore(false);
    } finally {
      setSearching(false);
      setLoadingMore(false);
    }
  }, []);

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      currentQueryRef.current = query;
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      if (!query || query.length < 1) {
        setSearchResults([]);
        setHasMore(false);
        return;
      }
      searchTimeout.current = setTimeout(() => { fetchProducts(query, 1); }, 300);
    },
    [fetchProducts],
  );

  // Clear results when branch filter changes
  const branchKey = branchId || branchIds?.join(",") || "";
  useEffect(() => {
    setSearchResults([]);
    setSearchQuery("");
    setHasMore(false);
    setSearchPage(1);
  }, [branchKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Infinite scroll handler
  const handleDropdownScroll = useCallback(() => {
    const el = dropdownRef.current;
    if (!el || !hasMore || loadingMore || searching) return;
    const threshold = 24;
    if (el.scrollHeight - el.scrollTop - el.clientHeight <= threshold) {
      fetchProducts(currentQueryRef.current, searchPage + 1, true);
    }
  }, [hasMore, loadingMore, searching, searchPage, fetchProducts]);

  const [lastAddedId, setLastAddedId] = useState<string | null>(null);

  const addProduct = (product: (typeof searchResults)[number]) => {
    const price = usePurchasePrice ? (product.purchasePrice ?? product.sellingPrice) : product.sellingPrice;
    const newItem: ProductPickerItem = {
      productId: product.id,
      productName: product.name,
      productCode: product.code,
      productPrice: price,
      productStock: product.stock ?? 0,
      quantity: 1,
    };

    setLastAddedId(product.id);

    if (single) {
      onChange([newItem]);
      setSearchQuery("");
      setSearchResults([]);
      return;
    }

    const existing = items.find((i) => i.productId === product.id);
    if (existing) {
      onChange(items.map((i) => (i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i)));
    } else {
      onChange([...items, newItem]);
    }
  };

  // Auto-focus qty input of last added product
  useEffect(() => {
    if (!lastAddedId) return;
    requestAnimationFrame(() => {
      const el = document.querySelector(`input[data-qty-product="${lastAddedId}"]`) as HTMLInputElement | null;
      if (el) { el.focus(); el.select(); }
      setLastAddedId(null);
    });
  }, [lastAddedId, items]);

  const removeProduct = (productId: string) => {
    onChange(items.filter((i) => i.productId !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity < 1) return;
    onChange(items.map((i) => (i.productId === productId ? { ...i, quantity } : i)));
  };

  return (
    <div className="space-y-2 sm:space-y-3">
      {/* Header + Search — optionally sticky */}
      <div className={stickySearch ? "sticky top-[-10px] z-10 bg-white/95 backdrop-blur-sm py-2 -my-2 space-y-2" : "space-y-2"}>
        <div className="flex items-center justify-between">
          <Label className="text-xs sm:text-sm font-semibold">
            {label} {required && <span className="text-red-400">*</span>}
          </Label>
          {items.length > 0 && (
            <span className="text-[10px] sm:text-xs text-muted-foreground">{items.length} produk</span>
          )}
        </div>

        {/* Search */}
        <div className="relative" ref={searchContainerRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="rounded-xl h-9 sm:h-10 pl-9 text-sm"
            placeholder={searchPlaceholder}
            disabled={disabled}
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
          )}

          {/* Search Results Dropdown */}
          {searchResults.length > 0 && (
            <div ref={dropdownRef} onScroll={handleDropdownScroll} className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border rounded-xl shadow-lg max-h-48 overflow-y-auto">
              {searchResults.map((product) => {
                const alreadyAdded = items.some((i) => i.productId === product.id);
                return (
                  <button
                    key={product.id}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between gap-2 text-xs sm:text-sm transition-colors"
                    onClick={() => addProduct(product)}
                  >
                    <div className="min-w-0 truncate">
                      <span className="font-medium text-slate-800">{product.name}</span>
                      <span className="text-muted-foreground ml-1.5 font-mono hidden sm:inline">{product.code}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {showStock && (
                        <span className="text-[10px] text-muted-foreground tabular-nums">stok: {product.stock ?? 0}</span>
                      )}
                      {showPrice && (
                        <span className="text-xs text-blue-600 font-medium">{formatCurrency(usePurchasePrice ? (product.purchasePrice ?? product.sellingPrice) : product.sellingPrice)}</span>
                      )}
                      {alreadyAdded && !single && (
                        <Badge className="rounded-full bg-blue-100 text-blue-700 border-0 text-[10px] px-1.5">+1</Badge>
                      )}
                    </div>
                  </button>
                );
              })}
              {loadingMore && (
                <div className="py-2 text-center text-xs text-muted-foreground">
                  <Loader2 className="inline-block h-3.5 w-3.5 animate-spin mr-1" />
                  Memuat...
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Items List */}
      {items.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 p-4 sm:p-6 text-center">
          <PackageOpen className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-xs sm:text-sm text-muted-foreground">{emptyText}</p>
        </div>
      ) : (
        <div className="space-y-1.5 sm:space-y-2">
          {items.map((item) => (
            <div
              key={item.productId}
              className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-xl bg-slate-50 border border-slate-100"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-slate-800 truncate">{item.productName}</p>
                <div className="flex items-center gap-2 text-[10px] sm:text-xs text-muted-foreground">
                  {showPrice && !editablePrice && <span>{formatCurrency(item.productPrice)}/{single ? "" : "pcs"}</span>}
                  {showStock && item.productStock !== undefined && (
                    <span className="tabular-nums">stok: {item.productStock}</span>
                  )}
                </div>
              </div>

              {renderItemExtra && renderItemExtra(item.productId)}

              {editablePrice && (
                <div className="shrink-0">
                  <Input
                    type="number"
                    tabIndex={-1}
                    value={item.productPrice}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      onChange(items.map((i) => (i.productId === item.productId ? { ...i, productPrice: val } : i)));
                    }}
                    onFocus={(e) => e.target.select()}
                    className="w-24 sm:w-28 h-7 rounded-lg text-xs text-right tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    min={0}
                    disabled={disabled}
                  />
                </div>
              )}

              {showQuantity && !single && (
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    tabIndex={-1}
                    className="h-6 w-6 sm:h-7 sm:w-7 rounded-md sm:rounded-lg"
                    onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                    disabled={item.quantity <= 1 || disabled}
                  >
                    <span className="text-xs sm:text-sm font-bold">-</span>
                  </Button>
                  <Input
                    type="number"
                    data-qty-product={item.productId}
                    value={item.quantity}
                    onChange={(e) => updateQuantity(item.productId, parseInt(e.target.value) || 1)}
                    onFocus={(e) => e.target.select()}
                    className="w-10 sm:w-14 h-6 sm:h-7 rounded-md sm:rounded-lg text-center text-xs sm:text-sm font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    min={1}
                    disabled={disabled}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    tabIndex={-1}
                    className="h-6 w-6 sm:h-7 sm:w-7 rounded-md sm:rounded-lg"
                    onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                    disabled={disabled}
                  >
                    <span className="text-xs sm:text-sm font-bold">+</span>
                  </Button>
                </div>
              )}

              {showSubtotal && showQuantity && !single && (
                <span className="text-xs sm:text-sm font-semibold text-slate-700 tabular-nums shrink-0 hidden sm:block min-w-[70px] text-right">
                  {formatCurrency(item.productPrice * item.quantity)}
                </span>
              )}

              <Button
                type="button"
                variant="ghost"
                size="icon"
                tabIndex={-1}
                className="h-6 w-6 sm:h-7 sm:w-7 rounded-md sm:rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                onClick={() => removeProduct(item.productId)}
                disabled={disabled}
              >
                <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
