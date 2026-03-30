import { brandsService } from "@/features/brands";
import { BrandsContent } from "@/features/brands";

export default async function BrandsPage() {
  const data = await brandsService.getBrands();
  return <BrandsContent initialData={data} />;
}
