"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProductForm } from "@/components/forms/product-form";
import type { Product, Category, Branch } from "@/types";

interface ProductFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editingProduct: Product | null;
    categories: Category[];
    brands?: { id: string; name: string }[];
    suppliers?: { id: string; name: string }[];
    branches: Branch[];
    selectedBranchId?: string | undefined;
    onSubmitted: () => void;
}

export function ProductFormDialog({ open, onOpenChange, editingProduct, categories, brands, suppliers, branches, selectedBranchId, onSubmitted }: ProductFormDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex h-[92vh] max-h-[92vh] max-w-[calc(100vw-1rem)] sm:max-w-3xl flex-col overflow-hidden rounded-xl sm:rounded-2xl p-0">
                <div className="sticky top-0 z-10 shrink-0 bg-background px-4 sm:px-6 py-3 sm:py-4">
                    <DialogHeader>
                        <DialogTitle className="text-base sm:text-lg">{editingProduct ? "Edit Produk" : "Tambah Produk Baru"}</DialogTitle>
                    </DialogHeader>
                </div>
                <div className="min-h-0 flex-1 overflow-hidden">
                    {open && (
                        <ProductForm
                            key={editingProduct?.id || "new"}
                            product={editingProduct}
                            categories={categories}
                            brands={brands ?? []}
                            suppliers={suppliers ?? []}
                            branches={branches}
                            selectedBranchId={selectedBranchId}
                            onSuccess={() => { onOpenChange(false); onSubmitted(); }}
                            onCancel={() => onOpenChange(false)}
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
