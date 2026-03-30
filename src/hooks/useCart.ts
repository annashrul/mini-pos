"use client";

import { useState, useEffect, useCallback } from "react";
import type { CartItem, ProductSearchResult } from "@/types";
import { POS_DRAFT_KEY } from "@/lib/constants";
import { toast } from "sonner";

export function useCart() {
  const [cart, setCart] = useState<CartItem[]>([]);

  // Auto-save to localStorage
  useEffect(() => {
    if (cart.length > 0) {
      localStorage.setItem(POS_DRAFT_KEY, JSON.stringify(cart));
    } else {
      localStorage.removeItem(POS_DRAFT_KEY);
    }
  }, [cart]);

  // Recover draft
  const recoverDraft = useCallback(() => {
    const saved = localStorage.getItem(POS_DRAFT_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCart(parsed);
          return true;
        }
      } catch { /* ignore */ }
    }
    return false;
  }, []);

  const addItem = useCallback((product: ProductSearchResult) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          toast.error("Stok tidak mencukupi");
          return prev;
        }
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.unitPrice - item.discount }
            : item
        );
      }
      if (product.stock <= product.minStock) toast.warning(`Stok ${product.name} menipis!`);
      if (product.sellingPrice <= product.purchasePrice) toast.warning(`Margin negatif: ${product.name}`);
      return [...prev, {
        productId: product.id, productName: product.name, productCode: product.code,
        quantity: 1, unitPrice: product.sellingPrice, purchasePrice: product.purchasePrice,
        discount: 0, subtotal: product.sellingPrice, maxStock: product.stock,
      }];
    });
  }, []);

  const updateQuantity = useCallback((productId: string, delta: number) => {
    setCart((prev) => prev.map((item) => {
      if (item.productId !== productId) return item;
      const newQty = item.quantity + delta;
      if (newQty <= 0) return item;
      if (newQty > item.maxStock) { toast.error("Stok tidak mencukupi"); return item; }
      return { ...item, quantity: newQty, subtotal: newQty * item.unitPrice - item.discount };
    }));
  }, []);

  const removeItem = useCallback((productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    localStorage.removeItem(POS_DRAFT_KEY);
  }, []);

  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const negativeMarginItems = cart.filter((item) => item.unitPrice <= item.purchasePrice);
  const lowStockItems = cart.filter((item) => item.quantity >= item.maxStock - 2);

  return {
    cart,
    setCart,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    recoverDraft,
    subtotal,
    totalItems,
    negativeMarginItems,
    lowStockItems,
    isEmpty: cart.length === 0,
  };
}
