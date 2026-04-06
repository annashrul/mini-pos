import {
  getAccountCategories,
  getAccounts,
  getAccountTree,
  getAccountById,
  createAccount,
  updateAccount,
  deleteAccount,
  getAccountsByType,
  getJournalEntries,
  getJournalEntryById,
  createJournalEntry,
  updateJournalEntry,
  postJournalEntry,
  voidJournalEntry,
  getAccountingPeriods,
  createAccountingPeriod,
  closePeriod,
  reopenPeriod,
  lockPeriod,
} from "@/server/actions/accounting";

import {
  getGeneralLedger,
  getTrialBalance,
  getIncomeStatement,
  getBalanceSheet,
  getCashFlow,
  getAccountingDashboard,
} from "@/server/actions/accounting-reports";

export const accountingService = {
  // COA
  getAccountCategories,
  getAccounts,
  getAccountTree,
  getAccountById,
  createAccount,
  updateAccount,
  deleteAccount,
  getAccountsByType,
  // Journals
  getJournalEntries,
  getJournalEntryById,
  createJournalEntry,
  updateJournalEntry,
  postJournalEntry,
  voidJournalEntry,
  // Reports
  getGeneralLedger,
  getTrialBalance,
  getIncomeStatement,
  getBalanceSheet,
  getCashFlow,
  getAccountingDashboard,
  // Periods
  getAccountingPeriods,
  createAccountingPeriod,
  closePeriod,
  reopenPeriod,
  lockPeriod,
};
