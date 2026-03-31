import { settingsService } from "@/features/settings";
import { SettingsContent } from "@/features/settings";

export default async function SettingsPage() {
  const [pointConfig, receiptConfig, posConfig] = await Promise.all([
    settingsService.getPointConfig(),
    settingsService.getReceiptConfig(),
    settingsService.getPosConfig(),
  ]);
  return <SettingsContent pointConfig={pointConfig} receiptConfig={receiptConfig} posConfig={posConfig} />;
}
