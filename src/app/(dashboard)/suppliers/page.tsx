import { suppliersService } from "@/features/suppliers";
import { SuppliersContent } from "@/features/suppliers";

export default async function SuppliersPage() {
  const data = await suppliersService.getSuppliers();
  return <SuppliersContent initialData={data} />;
}
