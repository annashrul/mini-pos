import { stockService } from "@/features/stock";
import { StockContent } from "@/features/stock";

export default async function StockPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string; type?: string; productId?: string }>;
}) {
    const params = await searchParams;
    const page = Number(params.page) || 1;

    const [movementsData, products] = await Promise.all([
        stockService.getStockMovements({
            page,
            ...(params.type ? { type: params.type } : {}),
            ...(params.productId ? { productId: params.productId } : {}),
        }),
        stockService.getProductsForSelect(),
    ]);

    return <StockContent data={movementsData} products={products} filters={params} />;
}
