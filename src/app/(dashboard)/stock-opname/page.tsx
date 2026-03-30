export const dynamic = "force-dynamic";
import { stockOpnameService } from "@/features/stock-opname";
import { StockOpnameContent } from "@/features/stock-opname";

export default async function StockOpnamePage() {
    const data = await stockOpnameService.getStockOpnames();
    return <StockOpnameContent initialData={data} />;
}
