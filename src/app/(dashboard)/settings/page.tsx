import { settingsService } from "@/features/settings";
import { SettingsContent } from "@/features/settings";

export default async function SettingsPage() {
  const [pointConfig, receiptConfig] = await Promise.all([
    settingsService.getPointConfig(),
    settingsService.getReceiptConfig(),
  ]);
  return <SettingsContent pointConfig={pointConfig} receiptConfig={receiptConfig} />;
}
