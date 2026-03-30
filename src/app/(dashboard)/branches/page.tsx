export const dynamic = "force-dynamic";

import { branchesService } from "@/features/branches";
import { BranchesContent } from "@/features/branches";

export default async function BranchesPage() {
  const data = await branchesService.getBranches();
  return <BranchesContent initialData={data} />;
}
