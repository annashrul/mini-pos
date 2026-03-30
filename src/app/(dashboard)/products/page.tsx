import { categoriesService } from "@/features/categories";
import { branchesService } from "@/features/branches";
import { brandsService } from "@/features/brands";
import { productsService } from "@/features/products";
import { ProductsContent } from "@/features/products";

export default async function ProductsPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string; search?: string; categoryId?: string; status?: string }>;
}) {
    const params = await searchParams;
    const page = Number(params.page) || 1;

    const [productsData, categories, brandsData, branches] = await Promise.all([
        productsService.getProducts({
            page,
            ...(params.search ? { search: params.search } : {}),
            ...(params.categoryId ? { categoryId: params.categoryId } : {}),
            ...(params.status ? { status: params.status } : {}),
        }),
        categoriesService.getAllCategories(),
        brandsService.getBrands({ perPage: 1000 }),
        branchesService.getAllBranches(),
    ]);

    return (
        <ProductsContent
            productsData={productsData}
            categories={categories}
            brands={brandsData.brands}
            branches={branches}
            filters={{
                search: params.search || "",
                categoryId: params.categoryId || "",
                status: params.status || "",
            }}
        />
    );
}
