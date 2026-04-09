// ===========================
// Shared model interfaces used by both server actions and UI components
// ===========================

// --- Core ---

export interface Branch {
  id: string;
  name: string;
  code?: string | null;
  address: string | null;
  phone: string | null;
  isActive: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  branchId?: string | null;
  branch?: { id: string; name: string } | null;
  isActive: boolean;
  createdAt: string | Date;
  _count: { transactions: number };
}

// --- Product ---

export interface Category {
  id: string;
  name: string;
  description: string | null;
  _count: { products: number };
}

export interface Brand {
  id: string;
  name: string;
  _count: { products: number };
}

export interface Supplier {
  id: string;
  name: string;
  contact: string | null;
  address: string | null;
  email: string | null;
  isActive: boolean;
  _count: { products: number };
}

export interface ProductBasic {
  id: string;
  name: string;
  code: string;
  stock: number;
}

// --- Customer ---

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  memberLevel: string;
  totalSpending: number;
  points: number;
  dateOfBirth: string | null;
  _count: { transactions: number };
}

// --- Transaction ---

export interface Transaction {
  id: string;
  invoiceNumber: string;
  grandTotal: number;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  paymentMethod: string;
  paymentAmount: number;
  changeAmount: number;
  status: string;
  createdAt: string | Date;
  user: { name: string };
  branch?: { name: string } | null;
  items: TransactionItem[];
  payments?: { id: string; method: string; amount: number }[];
}

export interface TransactionItem {
  id: string;
  productName: string;
  productCode?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  subtotal: number;
}

// --- Stock ---

export interface StockMovement {
  id: string;
  type: string;
  quantity: number;
  note: string | null;
  reference: string | null;
  createdAt: string | Date;
  product: { name: string; code: string; stock: number };
}

// --- Expense ---

export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string | Date;
}

// --- Shift ---

export interface Shift {
  id: string;
  userId: string;
  user: { name: string; email?: string };
  openedAt: string | Date;
  closedAt: string | Date | null;
  openingCash: number;
  closingCash: number | null;
  expectedCash: number | null;
  cashDifference: number | null;
  notes: string | null;
  isOpen: boolean;
}

// --- Promotion ---

export interface Promotion {
  id: string;
  name: string;
  type: string;
  value: number;
  scope: string;
  minPurchase: number | null;
  maxDiscount: number | null;
  categoryId: string | null;
  category: { name: string } | null;
  productId: string | null;
  product: { name: string; code?: string } | null;
  buyQty: number | null;
  getQty: number | null;
  getProductId: string | null;
  voucherCode: string | null;
  usageLimit: number | null;
  usageCount: number;
  description: string | null;
  isActive: boolean;
  startDate: string | Date;
  endDate: string | Date;
}

// --- Purchase ---

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplier: { name: string };
  status: string;
  totalAmount: number;
  notes: string | null;
  orderDate: string | Date;
  expectedDate: string | Date | null;
  receivedDate: string | Date | null;
  _count: { items: number };
}

export interface POCartItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

// --- Audit ---

export interface AuditLog {
  id: string;
  userId: string;
  user: { name: string; email: string };
  action: string;
  entity: string;
  entityId: string | null;
  details: string | null;
  createdAt: string | Date;
}

// --- Stock Opname ---

export interface StockOpname {
  id: string;
  opnameNumber: string;
  branchId: string | null;
  branch: { name: string } | null;
  status: string;
  notes: string | null;
  startedAt: string | Date;
  completedAt: string | Date | null;
  _count: { items: number };
}

// --- Stock Transfer ---

export interface StockTransfer {
  id: string;
  transferNumber: string;
  fromBranchId: string;
  fromBranch: { name: string };
  toBranchId: string;
  toBranch: { name: string };
  status: string;
  notes: string | null;
  requestedAt: string | Date;
  approvedAt: string | Date | null;
  receivedAt: string | Date | null;
  _count: { items: number };
}

export interface TransferCartItem {
  productId: string;
  productName: string;
  quantity: number;
}

// --- Reports ---

export interface SalesData {
  label: string;
  sales: number;
  transactions: number;
  discount: number;
  tax: number;
}

export interface TopProduct {
  productName: string;
  productCode: string;
  _sum: { quantity: number | null; subtotal: number | null };
}

export interface ProfitLoss {
  revenue: number;
  cost: number;
  grossProfit: number;
  discount: number;
  tax: number;
  netProfit: number;
  transactionCount: number;
  period: string;
}

export interface PaymentMethodReport {
  method: string;
  total: number;
  transactions: number;
}

export interface HourlySalesReport {
  hour: string;
  total: number;
  transactions: number;
}

export interface ReportCashierPerformance {
  userId: string;
  name: string;
  transactions: number;
  revenue: number;
}

export interface ReportCategorySales {
  category: string;
  total: number;
  quantity: number;
}

export interface ReportOverview {
  totalRevenue?: number;
  totalTransactions?: number;
  averageTransaction?: number;
  totalRevetotalTransactionsue?: number;
  revenue: number;
  transactions: number;
  totalItemsSold: number;
  averageTicket: number;
  totalDiscount: number;
  totalTax: number;
  topCashiers: ReportCashierPerformance[];
  categorySales: ReportCategorySales[];
}

// --- Dashboard ---

export interface DashboardStats {
  todaySales: number;
  todayTransactionCount: number;
  yesterdaySales: number;
  monthRevenue: number;
  monthTransactionCount: number;
  prevMonthRevenue: number;
  prevMonthTransactionCount: number;
  totalProducts: number;
  totalCustomers: number;
  salesGrowthDay: number;
  salesGrowthMonth: number;
  txGrowthMonth: number;
  lowStockProducts: {
    id: string;
    name: string;
    stock: number;
    minStock: number;
    category: { name: string };
  }[];
  recentTransactions: {
    id: string;
    invoiceNumber: string;
    grandTotal: number;
    paymentMethod: string;
    status: string;
    createdAt: Date;
    user: { name: string };
  }[];
  topProducts: {
    productName: string;
    _sum: { quantity: number | null; subtotal: number | null };
  }[];
  dailySales: { date: string; total: number; count: number }[];
  yearlyComparison: {
    month: string;
    thisYear: number;
    lastYear: number;
    thisYearCount: number;
    lastYearCount: number;
  }[];
  paymentBreakdown: { method: string; total: number; count: number }[];
  topCashiers: { name: string; total: number; count: number }[];
  categoryBreakdown: { name: string; total: number; qty: number }[];
  hourlySales: { hour: string; total: number; count: number }[];
  avgTransactionValue: number;
  todayProfit: number;
  weekSales: number;
  refundCount: number;
  voidCount: number;
  activePromotions: number;
  pendingPurchaseOrders: number;
  branchPerformance: {
    branchId: string;
    branchName: string;
    periodSales: number;
    periodTransactions: number;
    prevPeriodSales: number;
    prevPeriodTransactions: number;
  }[];
  upcomingDebts: {
    id: string;
    type: "PAYABLE" | "RECEIVABLE";
    partyName: string;
    totalAmount: number;
    remainingAmount: number;
    status: string;
    dueDate: Date | null;
  }[];
}

// --- Detail types (for getXxxById responses) ---

export interface StockOpnameDetail {
  id: string;
  opnameNumber: string;
  branchId: string | null;
  branch: { name: string } | null;
  status: string;
  notes: string | null;
  startedAt: string | Date;
  completedAt: string | Date | null;
  createdBy: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  items: StockOpnameItemDetail[];
}

export interface StockOpnameItemDetail {
  id: string;
  stockOpnameId: string;
  productId: string;
  product: { name: string; code: string; stock: number };
  systemStock: number;
  actualStock: number;
  difference: number;
  notes: string | null;
}

export interface StockTransferDetail {
  id: string;
  transferNumber: string;
  fromBranchId: string;
  fromBranch: { name: string };
  toBranchId: string;
  toBranch: { name: string };
  status: string;
  notes: string | null;
  requestedBy: string | null;
  approvedBy: string | null;
  requestedAt: string | Date;
  approvedAt: string | Date | null;
  receivedAt: string | Date | null;
  items: StockTransferItemDetail[];
}

export interface StockTransferItemDetail {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  receivedQty: number;
}

export interface PurchaseOrderDetail {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplier: {
    id: string;
    name: string;
    contact: string | null;
    address: string | null;
    email: string | null;
  };
  status: string;
  totalAmount: number;
  paidAmount: number;
  notes: string | null;
  orderDate: string | Date;
  expectedDate: string | Date | null;
  receivedDate: string | Date | null;
  items: PurchaseOrderItemDetail[];
}

export interface PurchaseOrderItemDetail {
  id: string;
  productId: string;
  product: { name: string; code: string; stock: number };
  quantity: number;
  receivedQty: number;
  unitPrice: number;
  subtotal: number;
}

export interface TransactionDetail {
  id: string;
  invoiceNumber: string;
  userId: string;
  user: { name: string; email: string };
  customerId: string | null;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
  paymentMethod: string;
  paymentAmount: number;
  changeAmount: number;
  status: string;
  voidReason: string | null;
  promoApplied: string | null;
  notes: string | null;
  createdAt: string | Date;
  items: TransactionItemDetail[];
  payments?: { id: string; method: string; amount: number }[];
}

export interface TransactionItemDetail {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
  unitName?: string | undefined;
  conversionQty?: number | undefined;
  baseQty?: number | undefined;
}

// --- Promo ---

export interface AppliedPromo {
  promoId: string;
  promoName: string;
  type: string;
  discountAmount: number;
  appliedTo: string;
}

export interface DetectedCustomer {
  id: string;
  name: string;
  phone: string | null;
  memberLevel: string;
  points: number;
  totalSpending: number;
}

export interface AccessMenuAction {
  id: string;
  key: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  permissions: Record<string, boolean>;
}

export interface CategorySalesReport {
  categoryId: string;
  categoryName: string;
  totalQuantity: number;
  totalRevenue: number;
  totalCost: number;
  profit: number;
  transactionCount: number;
  topProducts: { name: string; quantity: number; revenue: number }[];
}

export interface SupplierSalesReport {
  supplierId: string | null;
  supplierName: string;
  totalQuantity: number;
  totalRevenue: number;
  totalCost: number;
  profit: number;
  productCount: number;
  topProducts: { name: string; quantity: number; revenue: number }[];
}

export interface CashierSalesReport {
  userId: string;
  name: string;
  email: string;
  role: string;
  totalRevenue: number;
  totalCost: number;
  profit: number;
  totalDiscount: number;
  transactionCount: number;
  itemsSold: number;
  averageTicket: number;
}

export interface AccessMenu {
  id: string;
  key: string;
  name: string;
  path: string;
  group: string;
  sortOrder: number;
  isActive: boolean;
  permissions: Record<string, boolean>;
  actions: AccessMenuAction[];
}
