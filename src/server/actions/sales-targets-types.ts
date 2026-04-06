export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  avatarInitial: string;
  revenue: number;
  target: number;
  percentage: number;
  transactions: number;
  itemsSold: number;
  badges: { badge: string; title: string }[];
}

export interface BadgeDefinition {
  key: string;
  title: string;
  description: string;
  icon: string;
  color: string;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  { key: "TOP_SELLER", title: "Top Seller", description: "Pendapatan tertinggi dalam periode", icon: "Crown", color: "from-yellow-400 to-amber-500" },
  { key: "ZERO_VOID", title: "Zero Void", description: "Tidak ada transaksi void dalam periode", icon: "ShieldCheck", color: "from-emerald-400 to-green-500" },
  { key: "TARGET_CRUSHER", title: "Target Crusher", description: "Melampaui target 120%+", icon: "Rocket", color: "from-purple-400 to-violet-500" },
  { key: "STREAK_7", title: "7-Day Streak", description: "Mencapai target 7 hari berturut-turut", icon: "Flame", color: "from-orange-400 to-red-500" },
  { key: "SPEED_DEMON", title: "Speed Demon", description: "Transaksi terbanyak dalam periode", icon: "Zap", color: "from-blue-400 to-cyan-500" },
  { key: "EARLY_BIRD", title: "Early Bird", description: "Transaksi terbanyak sebelum jam 10 pagi", icon: "Sunrise", color: "from-amber-300 to-yellow-500" },
  { key: "NIGHT_OWL", title: "Night Owl", description: "Transaksi terbanyak setelah jam 8 malam", icon: "Moon", color: "from-indigo-400 to-purple-500" },
  { key: "TEAM_PLAYER", title: "Team Player", description: "Membantu banyak cabang (multi-branch)", icon: "Users", color: "from-pink-400 to-rose-500" },
];
