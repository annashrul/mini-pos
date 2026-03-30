/**
 * Loyalty Point System - default values (used as fallback if DB not yet seeded)
 */

export const POINT_DEFAULTS = {
  earnRate: 10000,        // Rp per 1 poin
  redeemValue: 1000,      // 1 poin = Rp
  redeemMin: 10,          // minimum poin untuk redeem
  multiplierRegular: 1,
  multiplierSilver: 1.5,
  multiplierGold: 2,
  multiplierPlatinum: 3,
  levelSilver: 1_000_000,   // min spending untuk Silver
  levelGold: 5_000_000,     // min spending untuk Gold
  levelPlatinum: 10_000_000, // min spending untuk Platinum
  pointsEnabled: true,
};

export type PointConfig = typeof POINT_DEFAULTS;

/**
 * Helper functions yang bisa dipakai tanpa DB (fallback / client-side calculation)
 */

export function calculateEarnedPoints(grandTotal: number, memberLevel: string, config: PointConfig): number {
  if (!config.pointsEnabled) return 0;
  const basePoints = Math.floor(grandTotal / config.earnRate);
  const multiplierKey = `multiplier${memberLevel.charAt(0) + memberLevel.slice(1).toLowerCase()}` as keyof PointConfig;
  const multiplier = (config[multiplierKey] as number) || 1;
  return Math.floor(basePoints * multiplier);
}

export function calculateRedeemValue(points: number, config: PointConfig): number {
  return points * config.redeemValue;
}

export function determineLevel(totalSpending: number, config: PointConfig): string {
  if (totalSpending >= config.levelPlatinum) return "PLATINUM";
  if (totalSpending >= config.levelGold) return "GOLD";
  if (totalSpending >= config.levelSilver) return "SILVER";
  return "REGULAR";
}
