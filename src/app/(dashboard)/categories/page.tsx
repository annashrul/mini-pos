import { categoriesService } from "@/features/categories";
import { CategoriesContent } from "@/features/categories";

export default async function CategoriesPage() {
  const data = await categoriesService.getCategories();
  return <CategoriesContent initialData={data} />;
}
