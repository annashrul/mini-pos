export interface RepeatCustomer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  memberLevel: string;
  totalSpending: number;
  points: number;
  transactionCount: number;
  isRepeat: boolean;
}

export interface CustomerFavorite {
  productName: string;
  productId: string;
  totalQty: number;
  totalSpent: number;
  purchaseCount: number;
}

export interface ShoppingFrequencyCustomer {
  id: string;
  name: string;
  phone: string | null;
  memberLevel: string;
  visitCount: number;
  totalSpent: number;
  avgSpending: number;
  lastVisit: Date | null;
}

export interface LoyaltySummary {
  level: string;
  count: number;
  totalSpending: number;
  totalPoints: number;
}

export interface FrequencyIndicator {
  color: string;
  label: string;
  textColor: string;
  bgLight: string;
}

export interface LoyaltyGradient {
  bg: string;
  icon: string;
  iconBg: string;
}

export const VALID_TABS = ["repeat", "frequency", "loyalty"] as const;
export type TabValue = (typeof VALID_TABS)[number];
