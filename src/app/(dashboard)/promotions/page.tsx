import { promotionsService } from "@/features/promotions";
import { categoriesService } from "@/features/categories";
import { productsService } from "@/features/products";
import type { Promotion } from "@/types";
import { PromotionsContent } from "@/features/promotions";

export default async function PromotionsPage() {
    const [data, categories, productsData] = await Promise.all([
        promotionsService.getPromotions(),
        categoriesService.getAllCategories(),
        productsService.getProducts({ limit: 500 }),
    ]);
    return (
        <PromotionsContent
            initialData={data as unknown as { promotions: Promotion[]; total: number; totalPages: number }}
            categories={categories.map((c) => ({ id: c.id, name: c.name }))}
            products={productsData.products.map((p) => ({ id: p.id, name: p.name, code: p.code }))}
        />
    );
}
