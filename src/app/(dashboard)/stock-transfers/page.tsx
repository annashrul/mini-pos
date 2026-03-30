export const dynamic = "force-dynamic";
import { stockTransfersService } from "@/features/stock-transfers";
import { branchesService } from "@/features/branches";
import { StockTransfersContent } from "@/features/stock-transfers";

export default async function StockTransfersPage() {
  const [data, branches] = await Promise.all([stockTransfersService.getStockTransfers(), branchesService.getAllBranches()]);
  return <StockTransfersContent initialData={data} branches={branches} />;
}
