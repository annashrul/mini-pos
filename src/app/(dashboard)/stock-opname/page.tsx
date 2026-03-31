export const dynamic = "force-dynamic";
import { stockOpnameService } from "@/features/stock-opname";
import { StockOpnameContent } from "@/features/stock-opname";
import { branchesService } from "@/features/branches";

export default async function StockOpnamePage() {
    const [data, allBranches] = await Promise.all([
        stockOpnameService.getStockOpnames(),
        branchesService.getAllBranches(),
    ]);
    const activeBranches = allBranches.filter((b) => b.isActive).map((b) => ({ id: b.id, name: b.name }));
    return <StockOpnameContent initialData={data} branches={activeBranches} />;
}
