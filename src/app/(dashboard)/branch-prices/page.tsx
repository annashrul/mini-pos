import { branchPricesService } from "@/features/branch-prices";
import { branchesService } from "@/features/branches";
import { BranchPricesContent } from "@/features/branch-prices";

export default async function BranchPricesPage() {
  const branches = await branchesService.getAllBranches();
  const firstBranchId = branches[0]?.id;
  const data = firstBranchId ? await branchPricesService.getBranchPrices({ branchId: firstBranchId }) : { items: [], total: 0, totalPages: 0 };

  return <BranchPricesContent branches={branches} initialData={data} initialBranchId={firstBranchId || ""} />;
}
