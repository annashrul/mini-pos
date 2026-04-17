import { getAccountingDashboard, getTrialBalance, getIncomeStatement, getBalanceSheet, getCashFlow } from "@/server/actions/accounting-reports";
import { getAccountingPeriods } from "@/server/actions/accounting";

// ── Account Types (COA) ────────────────────────────────────────────────

export interface Account {
  id: string;
  code: string;
  name: string;
  category: string;
  type: string;
  balance: number;
  isActive: boolean;
  description?: string | null | undefined;
  parentId?: string | null | undefined;
  branchId?: string | null | undefined;
  children?: Account[] | undefined;
}

export interface AccountTree {
  category: string;
  accounts: Account[];
  total: number;
}

export interface AccountSimple {
  id: string;
  code: string;
  name: string;
  category: string;
}

// ── Journal Types ──────────────────────────────────────────────────────

export interface JournalLine {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  description: string;
  debit: number;
  credit: number;
}

export interface Journal {
  id: string;
  number: string;
  date: string;
  description: string;
  reference: string | null;
  type: string;
  status: string;
  createdBy: string;
  createdByName: string;
  totalDebit: number;
  totalCredit: number;
  notes: string | null;
  rejectionNote?: string | null;
  approvedBy?: string | null;
  branchId: string | null;
  lines: JournalLine[];
}

export interface JournalFormLine {
  id: string;
  accountId: string;
  description: string;
  debit: string;
  credit: string;
}

export interface JournalsData {
  journals: Journal[];
  total: number;
  totalPages: number;
}

// ── Ledger Types ───────────────────────────────────────────────────────

export interface LedgerEntry {
  date: Date;
  entryNumber: string;
  description: string;
  lineDescription: string | null;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface LedgerData {
  account: {
    id: string;
    code: string;
    name: string;
    categoryType: string;
    categoryName: string;
    normalSide: string;
  };
  openingBalance: number;
  closingBalance: number;
  totalDebit: number;
  totalCredit: number;
  entries: LedgerEntry[];
}

// ── Reports Types ──────────────────────────────────────────────────────

export type TrialBalanceData = Awaited<ReturnType<typeof getTrialBalance>>;
export type IncomeStatementData = Awaited<ReturnType<typeof getIncomeStatement>>;
export type BalanceSheetData = Awaited<ReturnType<typeof getBalanceSheet>>;
export type CashFlowData = Awaited<ReturnType<typeof getCashFlow>>;

export type Tab = "trial-balance" | "income" | "balance-sheet" | "cash-flow";

// ── Periods Types ──────────────────────────────────────────────────────

export type AccountingPeriod = Awaited<ReturnType<typeof getAccountingPeriods>>[number];
export type AccountingPeriods = Awaited<ReturnType<typeof getAccountingPeriods>>;

// ── Dashboard Types ────────────────────────────────────────────────────

export type DashboardData = Awaited<ReturnType<typeof getAccountingDashboard>>;

// ── Dialog Props ───────────────────────────────────────────────────────

export interface AccountDialogProps {
  open: boolean;
  onClose: (saved?: boolean) => void;
  account: Account | null;
  accounts: Account[];
}

export interface JournalFormDialogProps {
  open: boolean;
  onClose: (saved?: boolean) => void;
}

export interface JournalDetailDialogProps {
  open: boolean;
  onClose: () => void;
  journal: Journal | null;
}
