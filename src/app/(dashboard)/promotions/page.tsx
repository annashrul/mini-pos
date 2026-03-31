import { promotionsService } from "@/features/promotions";
import type { Promotion } from "@/types";
import { PromotionsContent } from "@/features/promotions";

export default async function PromotionsPage() {
    const data = await promotionsService.getPromotions();
    return (
        <PromotionsContent
            initialData={data as unknown as { promotions: Promotion[]; total: number; totalPages: number }}
        />
    );
}
