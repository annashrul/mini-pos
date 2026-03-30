export const dynamic = "force-dynamic";

import { purchasesService } from "@/features/purchases";
import { suppliersService } from "@/features/suppliers";
import { categoriesService } from "@/features/categories";
import { productsService } from "@/features/products";
import { branchesService } from "@/features/branches";
import { PurchasesContent } from "@/features/purchases";

export default async function PurchasesPage() {
    const [data, suppliers, categories, productsData, branches] = await Promise.all([
        purchasesService.getPurchaseOrders(),
        suppliersService.getAllSuppliers(),
        categoriesService.getAllCategories(),
        productsService.getProducts({ page: 1, limit: 300 }),
        branchesService.getAllBranches(),
    ]);
    return (
        <PurchasesContent
            initialData={data}
            suppliers={suppliers}
            categories={categories}
            branches={branches}
            products={productsData.products}
        />
    );
}
