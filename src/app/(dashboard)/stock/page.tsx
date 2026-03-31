import { stockService } from "@/features/stock";
import { StockContent } from "@/features/stock";
import { branchesService } from "@/features/branches";

export default async function StockPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string; type?: string; productId?: string }>;
}) {
    const params = await searchParams;
    const page = Number(params.page) || 1;

    const [movementsData, products, allBranches] = await Promise.all([
        stockService.getStockMovements({
            page,
            ...(params.type ? { type: params.type } : {}),
            ...(params.productId ? { productId: params.productId } : {}),
        }),
        stockService.getProductsForSelect(),
        branchesService.getAllBranches(),
    ]);

    const activeBranches = allBranches.filter((b) => b.isActive).map((b) => ({ id: b.id, name: b.name }));
    return <StockContent data={movementsData} products={products} branches={activeBranches} filters={params} />;
}
