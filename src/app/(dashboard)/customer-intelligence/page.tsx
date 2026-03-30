export const dynamic = "force-dynamic";

import { customerIntelligenceService } from "@/features/customer-intelligence";
import { CustomerIntelligenceContent } from "@/features/customer-intelligence";

export default async function CustomerIntelligencePage() {
  const [repeatCustomers, shoppingFreq, loyaltySummary] = await Promise.all([
    customerIntelligenceService.getRepeatCustomers(),
    customerIntelligenceService.getShoppingFrequency(),
    customerIntelligenceService.getLoyaltySummary(),
  ]);

  return (
    <CustomerIntelligenceContent
      repeatCustomers={repeatCustomers}
      shoppingFrequency={shoppingFreq}
      loyaltySummary={loyaltySummary}
    />
  );
}
