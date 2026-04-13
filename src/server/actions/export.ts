"use server";

import { getCurrentCompanyId } from "@/lib/company";
import { prisma } from "@/lib/prisma";
import { generateExportFile, type ExportColumn, type ExportFormat, type CompanyInfo } from "@/lib/export-generators";

// ─── Generic export (columns + rows from frontend) ─────────────────

export async function exportGenericData(params: {
  format: ExportFormat;
  title: string;
  columns: ExportColumn[];
  rows: Record<string, unknown>[];
}): Promise<{
  data: string;
  filename: string;
  contentType: string;
  pdfData?: { columns: ExportColumn[]; rows: Record<string, unknown>[]; title: string; company: CompanyInfo } | undefined;
}> {
  const companyId = await getCurrentCompanyId();
  const company = await getCompanyInfo(companyId);
  const slug = params.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  if (params.format === "pdf") {
    return {
      data: "",
      filename: await buildFilename(company.slug, slug, undefined, "pdf"),
      contentType: "application/pdf",
      pdfData: { columns: params.columns, rows: params.rows, title: params.title, company },
    };
  }

  const result = await generateExportFile(params.format, params.columns, params.rows, params.title);
  return {
    data: result.buffer.toString("base64"),
    filename: await buildFilename(company.slug, slug, undefined, result.extension),
    contentType: result.contentType,
  };
}

// ─── Module-specific export (fetch from DB) ─────────────────

interface ModuleExportParams {
  format: ExportFormat;
  module: string;
  filters?: Record<string, string | undefined> | undefined;
  branchId?: string | undefined;
}

type DataFetcher = (companyId: string, filters: Record<string, string | undefined>) => Promise<{
  columns: ExportColumn[];
  rows: Record<string, unknown>[];
  title: string;
}>;

// Registry of module fetchers — add new modules here
const MODULE_FETCHERS: Record<string, DataFetcher> = {
  stock: fetchStockData,
  purchases: fetchPurchasesData,
  "stock-opname": fetchStockOpnameData,
  "stock-transfers": fetchStockTransfersData,
  expenses: fetchExpensesData,
  debts: fetchDebtsData,
  promotions: fetchPromotionsData,
  "gift-cards": fetchGiftCardsData,
  transactions: fetchTransactionsData,
  coa: fetchCOAData,
  journals: fetchJournalsData,
  ledger: fetchLedgerData,
  periods: fetchPeriodsData,
  reports: fetchReportsData,
  "customer-intelligence": fetchCustomerIntelData,
  branches: fetchBranchesData,
  users: fetchUsersData,
  "employee-schedules": fetchEmployeeSchedulesData,
  tables: fetchTablesData,
  shifts: fetchShiftsData,
  "closing-reports": fetchClosingReportsData,
  returns: fetchReturnsData,
  products: fetchProductsData,
  categories: fetchCategoriesData,
  brands: fetchBrandsData,
  suppliers: fetchSuppliersData,
  customers: fetchCustomersData,
  bundles: fetchBundlesData,
  "price-schedules": fetchPriceSchedulesData,
  "audit-logs": fetchAuditLogsData,
  "branch-prices": fetchBranchPricesData,
};

async function getCompanyInfo(companyId: string): Promise<CompanyInfo & { slug: string }> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true, slug: true, address: true, phone: true, email: true, logo: true },
  });
  return { name: company?.name ?? "", slug: company?.slug ?? "", address: company?.address ?? null, phone: company?.phone ?? null, email: company?.email ?? null, logo: company?.logo ?? null };
}

async function buildFilename(companySlug: string, moduleName: string, branchId: string | undefined, extension: string): Promise<string> {
  const date = new Date().toISOString().split("T")[0];
  let branchCode = "ALL";
  if (branchId) {
    const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { code: true, name: true } });
    branchCode = (branch?.code ?? branch?.name ?? "BR").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
  }
  const companyCode = companySlug.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) || "CO";
  return `${moduleName}-${companyCode}-${branchCode}-${date}.${extension}`;
}


export async function exportModuleData(params: ModuleExportParams): Promise<{
  data: string;
  filename: string;
  contentType: string;
  pdfData?: { columns: ExportColumn[]; rows: Record<string, unknown>[]; title: string; company: CompanyInfo } | undefined;
}> {
  const companyId = await getCurrentCompanyId();
  const filters = { ...(params.filters ?? {}) };
  if (params.branchId) filters.branchId = params.branchId;

  const fetcher = MODULE_FETCHERS[params.module];
  if (!fetcher) throw new Error(`Module export "${params.module}" tidak tersedia`);

  const { columns, rows, title } = await fetcher(companyId, filters);
  const company = await getCompanyInfo(companyId);
  const branchId = filters.branchId;

  if (params.format === "pdf") {
    return {
      data: "",
      filename: await buildFilename(company.slug, params.module, branchId, "pdf"),
      contentType: "application/pdf",
      pdfData: { columns, rows, title, company },
    };
  }

  const result = await generateExportFile(params.format, columns, rows, title);
  return {
    data: result.buffer.toString("base64"),
    filename: await buildFilename(company.slug, params.module, branchId, result.extension),
    contentType: result.contentType,
  };
}

// Keep backward-compatible alias
export const exportInventoryData = exportModuleData;

// ─── Data fetchers ─────────────────────────────

async function fetchStockData(companyId: string, filters: Record<string, string | undefined>) {
  const where: Record<string, unknown> = { product: { companyId } };
  if (filters.branchId) where.branchId = filters.branchId;
  if (filters.type && filters.type !== "ALL") where.type = filters.type;
  if (filters.dateFrom) where.createdAt = { ...(where.createdAt as Record<string, unknown> ?? {}), gte: new Date(filters.dateFrom + "T00:00:00") };
  if (filters.dateTo) where.createdAt = { ...(where.createdAt as Record<string, unknown> ?? {}), lte: new Date(filters.dateTo + "T23:59:59") };

  const data = await prisma.stockMovement.findMany({
    where, include: { product: { select: { name: true, code: true } }, branch: { select: { name: true } } },
    orderBy: { createdAt: "desc" }, take: 5000,
  });

  return {
    columns: [
      { key: "date", header: "Tanggal", width: 18 },
      { key: "productCode", header: "Kode Produk", width: 15 },
      { key: "productName", header: "Nama Produk", width: 25 },
      { key: "type", header: "Tipe", width: 12 },
      { key: "quantity", header: "Qty", width: 10 },
      { key: "branch", header: "Lokasi", width: 18 },
      { key: "note", header: "Catatan", width: 30 },
      { key: "reference", header: "Referensi", width: 18 },
    ] as ExportColumn[],
    rows: data.map((d) => ({ date: d.createdAt.toISOString().split("T")[0], productCode: d.product.code, productName: d.product.name, type: d.type, quantity: d.quantity, branch: d.branch?.name ?? "-", note: d.note ?? "", reference: d.reference ?? "" })),
    title: "Pergerakan Stok",
  };
}

async function fetchPurchasesData(companyId: string, filters: Record<string, string | undefined>) {
  const where: Record<string, unknown> = { companyId };
  if (filters.branchId) where.branchId = filters.branchId;
  if (filters.status && filters.status !== "ALL") where.status = filters.status;

  const data = await prisma.purchaseOrder.findMany({
    where, include: { supplier: { select: { name: true } }, branch: { select: { name: true } }, _count: { select: { items: true } } },
    orderBy: { createdAt: "desc" }, take: 5000,
  });

  return {
    columns: [
      { key: "orderNumber", header: "No. PO", width: 18 }, { key: "date", header: "Tanggal", width: 15 },
      { key: "supplier", header: "Supplier", width: 22 }, { key: "branch", header: "Lokasi", width: 18 },
      { key: "status", header: "Status", width: 12 }, { key: "itemCount", header: "Jumlah Item", width: 12 },
      { key: "totalAmount", header: "Total", width: 18 },
    ] as ExportColumn[],
    rows: data.map((d) => ({ orderNumber: d.orderNumber, date: d.orderDate.toISOString().split("T")[0], supplier: d.supplier.name, branch: d.branch?.name ?? "-", status: d.status, itemCount: d._count.items, totalAmount: d.totalAmount })),
    title: "Purchase Order",
  };
}

async function fetchStockOpnameData(companyId: string, filters: Record<string, string | undefined>) {
  const where: Record<string, unknown> = { companyId };
  if (filters.branchId) where.branchId = filters.branchId;
  if (filters.status && filters.status !== "ALL") where.status = filters.status;

  const data = await prisma.stockOpname.findMany({
    where, include: { branch: { select: { name: true } }, _count: { select: { items: true } } },
    orderBy: { createdAt: "desc" }, take: 5000,
  });

  return {
    columns: [
      { key: "opnameNumber", header: "No. Opname", width: 18 }, { key: "date", header: "Tanggal", width: 15 },
      { key: "branch", header: "Lokasi", width: 18 }, { key: "status", header: "Status", width: 14 },
      { key: "itemCount", header: "Jumlah Item", width: 12 }, { key: "notes", header: "Catatan", width: 30 },
    ] as ExportColumn[],
    rows: data.map((d) => ({ opnameNumber: d.opnameNumber, date: d.startedAt.toISOString().split("T")[0], branch: d.branch?.name ?? "-", status: d.status, itemCount: d._count.items, notes: d.notes ?? "" })),
    title: "Stock Opname",
  };
}

async function fetchStockTransfersData(companyId: string, filters: Record<string, string | undefined>) {
  const where: Record<string, unknown> = { companyId };
  if (filters.branchId) where.OR = [{ fromBranchId: filters.branchId }, { toBranchId: filters.branchId }];
  if (filters.status && filters.status !== "ALL") where.status = filters.status;

  const data = await prisma.stockTransfer.findMany({
    where, include: { fromBranch: { select: { name: true } }, toBranch: { select: { name: true } }, _count: { select: { items: true } } },
    orderBy: { createdAt: "desc" }, take: 5000,
  });

  return {
    columns: [
      { key: "transferNumber", header: "No. Transfer", width: 18 }, { key: "date", header: "Tanggal", width: 15 },
      { key: "fromBranch", header: "Cabang Asal", width: 18 }, { key: "toBranch", header: "Cabang Tujuan", width: 18 },
      { key: "status", header: "Status", width: 14 }, { key: "itemCount", header: "Jumlah Item", width: 12 },
    ] as ExportColumn[],
    rows: data.map((d) => ({ transferNumber: d.transferNumber, date: d.requestedAt.toISOString().split("T")[0], fromBranch: d.fromBranch.name, toBranch: d.toBranch.name, status: d.status, itemCount: d._count.items })),
    title: "Transfer Stok",
  };
}

async function fetchExpensesData(companyId: string, filters: Record<string, string | undefined>) {
  const where: Record<string, unknown> = { companyId };
  if (filters.branchId) where.branchId = filters.branchId;

  const data = await prisma.expense.findMany({
    where, include: { branch: { select: { name: true } } },
    orderBy: { date: "desc" }, take: 5000,
  });

  return {
    columns: [
      { key: "date", header: "Tanggal", width: 15 }, { key: "category", header: "Kategori", width: 18 },
      { key: "description", header: "Deskripsi", width: 30 }, { key: "amount", header: "Jumlah", width: 18 },
      { key: "branch", header: "Lokasi", width: 18 },
    ] as ExportColumn[],
    rows: data.map((d) => ({ date: d.date.toISOString().split("T")[0], category: d.category, description: d.description, amount: d.amount, branch: d.branch?.name ?? "-" })),
    title: "Pengeluaran",
  };
}

async function fetchDebtsData(companyId: string, filters: Record<string, string | undefined>) {
  const where: Record<string, unknown> = { companyId };
  if (filters.branchId) where.branchId = filters.branchId;

  const data = await prisma.debt.findMany({
    where, include: { branch: { select: { name: true } } },
    orderBy: { createdAt: "desc" }, take: 5000,
  });

  return {
    columns: [
      { key: "type", header: "Tipe", width: 12 }, { key: "partyName", header: "Pihak", width: 22 },
      { key: "description", header: "Deskripsi", width: 25 }, { key: "totalAmount", header: "Total", width: 18 },
      { key: "paidAmount", header: "Dibayar", width: 18 }, { key: "remainingAmount", header: "Sisa", width: 18 },
      { key: "status", header: "Status", width: 12 }, { key: "branch", header: "Lokasi", width: 18 },
    ] as ExportColumn[],
    rows: data.map((d) => ({ type: d.type, partyName: d.partyName, description: d.description ?? "", totalAmount: d.totalAmount, paidAmount: d.paidAmount, remainingAmount: d.remainingAmount, status: d.status, branch: d.branch?.name ?? "-" })),
    title: "Hutang Piutang",
  };
}

async function fetchPromotionsData(companyId: string, filters: Record<string, string | undefined>) {
  const where: Record<string, unknown> = { companyId };
  if (filters.branchId) where.branchId = filters.branchId;

  const data = await prisma.promotion.findMany({
    where, include: { branch: { select: { name: true } }, product: { select: { name: true } }, category: { select: { name: true } } },
    orderBy: { createdAt: "desc" }, take: 5000,
  });

  return {
    columns: [
      { key: "name", header: "Nama", width: 22 }, { key: "type", header: "Tipe", width: 15 },
      { key: "value", header: "Nilai", width: 12 }, { key: "scope", header: "Berlaku", width: 20 },
      { key: "startDate", header: "Mulai", width: 12 }, { key: "endDate", header: "Berakhir", width: 12 },
      { key: "isActive", header: "Aktif", width: 8 }, { key: "branch", header: "Lokasi", width: 18 },
    ] as ExportColumn[],
    rows: data.map((d) => ({ name: d.name, type: d.type, value: d.value, scope: d.product?.name ?? d.category?.name ?? "Semua", startDate: d.startDate.toISOString().split("T")[0], endDate: d.endDate.toISOString().split("T")[0], isActive: d.isActive ? "Ya" : "Tidak", branch: d.branch?.name ?? "Semua" })),
    title: "Promosi",
  };
}

async function fetchGiftCardsData(companyId: string, filters: Record<string, string | undefined>) {
  const where: Record<string, unknown> = { companyId };
  if (filters.branchId) where.branchId = filters.branchId;

  const data = await prisma.giftCard.findMany({
    where, include: { branch: { select: { name: true } } },
    orderBy: { createdAt: "desc" }, take: 5000,
  });

  return {
    columns: [
      { key: "code", header: "Kode", width: 18 }, { key: "initialBalance", header: "Saldo Awal", width: 15 },
      { key: "currentBalance", header: "Saldo Saat Ini", width: 15 }, { key: "status", header: "Status", width: 12 },
      { key: "branch", header: "Lokasi", width: 18 }, { key: "createdAt", header: "Dibuat", width: 15 },
    ] as ExportColumn[],
    rows: data.map((d) => ({ code: d.code, initialBalance: d.initialBalance, currentBalance: d.currentBalance, status: d.status, branch: d.branch?.name ?? "-", createdAt: d.createdAt.toISOString().split("T")[0] })),
    title: "Gift Card",
  };
}

async function fetchTransactionsData(companyId: string, filters: Record<string, string | undefined>) {
  const where: Record<string, unknown> = { user: { companyId } };
  if (filters.branchId) where.branchId = filters.branchId;
  if (filters.status && filters.status !== "ALL") where.status = filters.status;

  const data = await prisma.transaction.findMany({
    where, include: { branch: { select: { name: true } }, customer: { select: { name: true } } },
    orderBy: { createdAt: "desc" }, take: 5000,
  });

  return {
    columns: [
      { key: "invoiceNumber", header: "No. Invoice", width: 20 }, { key: "date", header: "Tanggal", width: 15 },
      { key: "customer", header: "Customer", width: 20 }, { key: "grandTotal", header: "Total", width: 18 },
      { key: "status", header: "Status", width: 12 }, { key: "branch", header: "Lokasi", width: 18 },
    ] as ExportColumn[],
    rows: data.map((d) => ({ invoiceNumber: d.invoiceNumber, date: d.createdAt.toISOString().split("T")[0], customer: d.customer?.name ?? "Walk-in", grandTotal: d.grandTotal, status: d.status, branch: d.branch?.name ?? "-" })),
    title: "Transaksi",
  };
}

// ─── Accounting fetchers ─────────────────────────────

async function fetchCOAData(companyId: string, _filters: Record<string, string | undefined>) {
  const data = await prisma.account.findMany({
    where: { category: { companyId } },
    include: { category: { select: { name: true, type: true } }, branch: { select: { name: true } } },
    orderBy: { code: "asc" },
    take: 5000,
  });

  return {
    columns: [
      { key: "code", header: "Kode Akun", width: 15 }, { key: "name", header: "Nama Akun", width: 25 },
      { key: "category", header: "Kategori", width: 18 }, { key: "type", header: "Tipe", width: 12 },
      { key: "openingBalance", header: "Saldo Awal", width: 18 }, { key: "branch", header: "Lokasi", width: 15 },
      { key: "isActive", header: "Aktif", width: 8 },
    ] as ExportColumn[],
    rows: data.map((d) => ({ code: d.code, name: d.name, category: d.category.name, type: d.category.type, openingBalance: d.openingBalance, branch: d.branch?.name ?? "Global", isActive: d.isActive ? "Ya" : "Tidak" })),
    title: "Chart of Accounts",
  };
}

async function fetchJournalsData(companyId: string, filters: Record<string, string | undefined>) {
  const where: Record<string, unknown> = {};
  if (filters.branchId) where.branchId = filters.branchId;
  if (filters.status && filters.status !== "ALL") where.status = filters.status;
  // Filter by company through branch or createdBy user
  where.createdByUser = { companyId };

  const data = await prisma.journalEntry.findMany({
    where,
    include: {
      branch: { select: { name: true } },
      createdByUser: { select: { name: true } },
      lines: { include: { account: { select: { code: true, name: true } } }, orderBy: { sortOrder: "asc" } },
    },
    orderBy: { date: "desc" },
    take: 5000,
  });

  return {
    columns: [
      { key: "entryNumber", header: "No. Jurnal", width: 18 }, { key: "date", header: "Tanggal", width: 12 },
      { key: "description", header: "Deskripsi", width: 30 }, { key: "reference", header: "Referensi", width: 15 },
      { key: "totalDebit", header: "Total Debit", width: 18 }, { key: "totalCredit", header: "Total Kredit", width: 18 },
      { key: "status", header: "Status", width: 10 }, { key: "branch", header: "Lokasi", width: 15 },
      { key: "createdBy", header: "Dibuat Oleh", width: 15 },
    ] as ExportColumn[],
    rows: data.map((d) => ({ entryNumber: d.entryNumber, date: d.date.toISOString().split("T")[0], description: d.description, reference: d.reference ?? "", totalDebit: d.totalDebit, totalCredit: d.totalCredit, status: d.status, branch: d.branch?.name ?? "-", createdBy: d.createdByUser.name })),
    title: "Jurnal Umum",
  };
}

async function fetchLedgerData(companyId: string, filters: Record<string, string | undefined>) {
  const where: Record<string, unknown> = {};
  if (filters.branchId) where.journal = { branchId: filters.branchId };
  if (filters.accountId) where.accountId = filters.accountId;
  // Filter by company
  where.account = { category: { companyId } };

  const data = await prisma.journalEntryLine.findMany({
    where,
    include: {
      account: { select: { code: true, name: true } },
      journal: { select: { entryNumber: true, date: true, description: true, branch: { select: { name: true } } } },
    },
    orderBy: { journal: { date: "desc" } },
    take: 5000,
  });

  return {
    columns: [
      { key: "date", header: "Tanggal", width: 12 }, { key: "entryNumber", header: "No. Jurnal", width: 18 },
      { key: "accountCode", header: "Kode Akun", width: 12 }, { key: "accountName", header: "Nama Akun", width: 22 },
      { key: "description", header: "Deskripsi", width: 25 }, { key: "debit", header: "Debit", width: 18 },
      { key: "credit", header: "Kredit", width: 18 }, { key: "branch", header: "Lokasi", width: 15 },
    ] as ExportColumn[],
    rows: data.map((d) => ({ date: d.journal.date.toISOString().split("T")[0], entryNumber: d.journal.entryNumber, accountCode: d.account.code, accountName: d.account.name, description: d.description ?? d.journal.description, debit: d.debit, credit: d.credit, branch: d.journal.branch?.name ?? "-" })),
    title: "Buku Besar",
  };
}

async function fetchPeriodsData(companyId: string, _filters: Record<string, string | undefined>) {
  const data = await prisma.accountingPeriod.findMany({
    where: { companyId },
    orderBy: { startDate: "desc" },
    take: 500,
  });

  return {
    columns: [
      { key: "name", header: "Nama Periode", width: 20 }, { key: "startDate", header: "Mulai", width: 15 },
      { key: "endDate", header: "Berakhir", width: 15 }, { key: "status", header: "Status", width: 12 },
      { key: "closedAt", header: "Ditutup", width: 15 },
    ] as ExportColumn[],
    rows: data.map((d) => ({ name: d.name, startDate: d.startDate.toISOString().split("T")[0], endDate: d.endDate.toISOString().split("T")[0], status: d.status, closedAt: d.closedAt?.toISOString().split("T")[0] ?? "-" })),
    title: "Periode Akuntansi",
  };
}

// ─── Analytics fetchers ─────────────────────────────

async function fetchReportsData(companyId: string, filters: Record<string, string | undefined>) {
  const where: Record<string, unknown> = { user: { companyId }, status: "COMPLETED" };
  if (filters.branchId) where.branchId = filters.branchId;
  if (filters.dateFrom) where.createdAt = { ...(where.createdAt as Record<string, unknown> ?? {}), gte: new Date(filters.dateFrom + "T00:00:00") };
  if (filters.dateTo) where.createdAt = { ...(where.createdAt as Record<string, unknown> ?? {}), lte: new Date(filters.dateTo + "T23:59:59") };

  const data = await prisma.transaction.findMany({
    where,
    include: {
      branch: { select: { name: true } },
      customer: { select: { name: true } },
      items: { include: { product: { select: { name: true, purchasePrice: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  return {
    columns: [
      { key: "invoiceNumber", header: "No. Invoice", width: 20 }, { key: "date", header: "Tanggal", width: 12 },
      { key: "customer", header: "Customer", width: 18 }, { key: "itemCount", header: "Item", width: 8 },
      { key: "subtotal", header: "Subtotal", width: 15 }, { key: "discount", header: "Diskon", width: 12 },
      { key: "tax", header: "Pajak", width: 12 }, { key: "grandTotal", header: "Grand Total", width: 15 },
      { key: "cogs", header: "HPP", width: 15 }, { key: "profit", header: "Laba", width: 15 },
      { key: "branch", header: "Lokasi", width: 15 },
    ] as ExportColumn[],
    rows: data.map((d) => {
      const cogs = d.items.reduce((s, i) => s + i.quantity * (i.product?.purchasePrice ?? 0), 0);
      return {
        invoiceNumber: d.invoiceNumber, date: d.createdAt.toISOString().split("T")[0],
        customer: d.customer?.name ?? "Walk-in", itemCount: d.items.length,
        subtotal: d.subtotal, discount: d.discountAmount, tax: d.taxAmount,
        grandTotal: d.grandTotal, cogs, profit: d.grandTotal - cogs,
        branch: d.branch?.name ?? "-",
      };
    }),
    title: "Laporan Penjualan",
  };
}

async function fetchCustomerIntelData(companyId: string, _filters: Record<string, string | undefined>) {
  const data = await prisma.customer.findMany({
    where: { companyId },
    select: {
      name: true, phone: true, email: true, memberLevel: true, points: true,
      totalSpending: true, totalTransactions: true,
    },
    orderBy: { totalSpending: "desc" },
    take: 5000,
  });

  return {
    columns: [
      { key: "name", header: "Nama", width: 22 }, { key: "phone", header: "Telepon", width: 15 },
      { key: "email", header: "Email", width: 22 }, { key: "memberLevel", header: "Level", width: 12 },
      { key: "points", header: "Poin", width: 10 }, { key: "totalSpending", header: "Total Belanja", width: 18 },
      { key: "totalTransactions", header: "Jumlah Transaksi", width: 15 },
    ] as ExportColumn[],
    rows: data.map((d) => ({
      name: d.name, phone: d.phone ?? "-", email: d.email ?? "-",
      memberLevel: d.memberLevel, points: d.points, totalSpending: d.totalSpending,
      totalTransactions: d.totalTransactions,
    })),
    title: "Customer Intelligence",
  };
}

// ─── Admin fetchers ─────────────────────────────

async function fetchBranchesData(companyId: string, _filters: Record<string, string | undefined>) {
  const data = await prisma.branch.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
  });
  return {
    columns: [
      { key: "name", header: "Nama Cabang", width: 22 }, { key: "code", header: "Kode", width: 12 },
      { key: "address", header: "Alamat", width: 30 }, { key: "phone", header: "Telepon", width: 15 },
      { key: "isActive", header: "Aktif", width: 8 },
    ] as ExportColumn[],
    rows: data.map((d) => ({ name: d.name, code: d.code ?? "-", address: d.address ?? "-", phone: d.phone ?? "-", isActive: d.isActive ? "Ya" : "Tidak" })),
    title: "Cabang",
  };
}

async function fetchUsersData(companyId: string, _filters: Record<string, string | undefined>) {
  const data = await prisma.user.findMany({
    where: { companyId },
    select: { name: true, email: true, role: true, isActive: true, branch: { select: { name: true } }, createdAt: true },
    orderBy: { name: "asc" },
  });
  return {
    columns: [
      { key: "name", header: "Nama", width: 22 }, { key: "email", header: "Email", width: 25 },
      { key: "role", header: "Role", width: 15 }, { key: "branch", header: "Cabang", width: 18 },
      { key: "isActive", header: "Aktif", width: 8 }, { key: "createdAt", header: "Bergabung", width: 12 },
    ] as ExportColumn[],
    rows: data.map((d) => ({ name: d.name, email: d.email, role: d.role, branch: d.branch?.name ?? "-", isActive: d.isActive ? "Ya" : "Tidak", createdAt: d.createdAt.toISOString().split("T")[0] })),
    title: "Pengguna",
  };
}

async function fetchEmployeeSchedulesData(companyId: string, filters: Record<string, string | undefined>) {
  const where: Record<string, unknown> = { user: { companyId } };
  if (filters.branchId) where.branchId = filters.branchId;

  const data = await prisma.employeeSchedule.findMany({
    where,
    include: { user: { select: { name: true } }, branch: { select: { name: true } } },
    orderBy: { date: "desc" },
    take: 5000,
  });
  return {
    columns: [
      { key: "date", header: "Tanggal", width: 12 }, { key: "employee", header: "Karyawan", width: 22 },
      { key: "branch", header: "Cabang", width: 18 }, { key: "shiftStart", header: "Mulai", width: 10 },
      { key: "shiftEnd", header: "Selesai", width: 10 }, { key: "notes", header: "Catatan", width: 25 },
    ] as ExportColumn[],
    rows: data.map((d) => ({ date: d.date.toISOString().split("T")[0], employee: d.user.name, branch: d.branch?.name ?? "-", shiftStart: d.shiftStart, shiftEnd: d.shiftEnd, notes: d.notes ?? "" })),
    title: "Jadwal Karyawan",
  };
}

async function fetchTablesData(companyId: string, filters: Record<string, string | undefined>) {
  const where: Record<string, unknown> = { branch: { companyId } };
  if (filters.branchId) where.branchId = filters.branchId;

  const data = await prisma.restaurantTable.findMany({
    where,
    include: { branch: { select: { name: true } } },
    orderBy: { number: "asc" },
  });
  return {
    columns: [
      { key: "number", header: "No. Meja", width: 10 }, { key: "name", header: "Nama", width: 18 },
      { key: "capacity", header: "Kapasitas", width: 10 }, { key: "status", header: "Status", width: 12 },
      { key: "branch", header: "Cabang", width: 18 }, { key: "isActive", header: "Aktif", width: 8 },
    ] as ExportColumn[],
    rows: data.map((d) => ({ number: d.number, name: d.name ?? "-", capacity: d.capacity, status: d.status, branch: d.branch?.name ?? "-", isActive: d.isActive ? "Ya" : "Tidak" })),
    title: "Manajemen Meja",
  };
}

// ─── Utama fetchers ─────────────────────────────

async function fetchShiftsData(companyId: string, filters: Record<string, string | undefined>) {
  const where: Record<string, unknown> = { user: { companyId } };
  if (filters.branchId) where.branchId = filters.branchId;

  const data = await prisma.cashierShift.findMany({
    where,
    include: { user: { select: { name: true } }, branch: { select: { name: true } } },
    orderBy: { openedAt: "desc" },
    take: 5000,
  });
  return {
    columns: [
      { key: "user", header: "Kasir", width: 20 }, { key: "branch", header: "Cabang", width: 18 },
      { key: "openedAt", header: "Dibuka", width: 18 }, { key: "closedAt", header: "Ditutup", width: 18 },
      { key: "openingCash", header: "Kas Awal", width: 15 }, { key: "closingCash", header: "Kas Akhir", width: 15 },
      { key: "cashDifference", header: "Selisih", width: 12 }, { key: "isOpen", header: "Status", width: 10 },
    ] as ExportColumn[],
    rows: data.map((d) => ({
      user: d.user.name, branch: d.branch?.name ?? "-",
      openedAt: d.openedAt.toISOString().replace("T", " ").slice(0, 16),
      closedAt: d.closedAt ? d.closedAt.toISOString().replace("T", " ").slice(0, 16) : "-",
      openingCash: d.openingCash, closingCash: d.closingCash ?? "-",
      cashDifference: d.cashDifference ?? "-", isOpen: d.isOpen ? "Aktif" : "Ditutup",
    })),
    title: "Shift Kasir",
  };
}

async function fetchClosingReportsData(companyId: string, filters: Record<string, string | undefined>) {
  const where: Record<string, unknown> = { companyId };
  if (filters.branchId) where.branchId = filters.branchId;

  const data = await prisma.closingReport.findMany({
    where,
    include: { branch: { select: { name: true } } },
    orderBy: { date: "desc" },
    take: 5000,
  });
  return {
    columns: [
      { key: "cashier", header: "Kasir", width: 20 }, { key: "branch", header: "Cabang", width: 18 },
      { key: "date", header: "Tanggal", width: 12 },
      { key: "openingCash", header: "Kas Awal", width: 15 }, { key: "closingCash", header: "Kas Akhir", width: 15 },
      { key: "expectedCash", header: "Kas Seharusnya", width: 15 }, { key: "cashDifference", header: "Selisih", width: 12 },
      { key: "totalSales", header: "Total Penjualan", width: 18 }, { key: "totalTransactions", header: "Transaksi", width: 10 },
      { key: "voidCount", header: "Void", width: 8 }, { key: "refundCount", header: "Refund", width: 8 },
      { key: "notes", header: "Catatan", width: 25 },
    ] as ExportColumn[],
    rows: data.map((d) => ({
      cashier: d.cashierName, branch: d.branch?.name ?? "-",
      date: d.date.toISOString().split("T")[0],
      openingCash: d.openingCash, closingCash: d.closingCash,
      expectedCash: d.expectedCash, cashDifference: d.cashDifference,
      totalSales: d.totalSales, totalTransactions: d.totalTransactions,
      voidCount: d.voidCount, refundCount: d.refundCount,
      notes: d.notes ?? "",
    })),
    title: "Laporan Closing",
  };
}

async function fetchReturnsData(companyId: string, filters: Record<string, string | undefined>) {
  const where: Record<string, unknown> = { user: { companyId } };
  if (filters.branchId) where.branchId = filters.branchId;
  if (filters.status && filters.status !== "ALL") where.status = filters.status;

  const data = await prisma.returnExchange.findMany({
    where,
    include: {
      branch: { select: { name: true } },
      transaction: { select: { invoiceNumber: true } },
      customer: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
  return {
    columns: [
      { key: "returnNumber", header: "No. Return", width: 18 }, { key: "date", header: "Tanggal", width: 12 },
      { key: "invoice", header: "No. Invoice", width: 18 }, { key: "customer", header: "Customer", width: 18 },
      { key: "type", header: "Tipe", width: 12 }, { key: "status", header: "Status", width: 12 },
      { key: "totalAmount", header: "Total", width: 15 }, { key: "branch", header: "Lokasi", width: 15 },
    ] as ExportColumn[],
    rows: data.map((d) => ({
      returnNumber: d.returnNumber, date: d.createdAt.toISOString().split("T")[0],
      invoice: d.transaction?.invoiceNumber ?? "-", customer: d.customer?.name ?? "-",
      type: d.type, status: d.status, totalAmount: d.totalRefund,
      branch: d.branch?.name ?? "-",
    })),
    title: "Return & Exchange",
  };
}

// ─── Master Data fetchers ─────────────────────────────

async function fetchProductsData(companyId: string, filters: Record<string, string | undefined>) {
  const where: Record<string, unknown> = { companyId };
  if (filters.status === "active") where.isActive = true;
  if (filters.status === "inactive") where.isActive = false;
  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.brandId) where.brandId = filters.brandId;
  if (filters.stockStatus === "out") where.stock = 0;
  if (filters.stockStatus === "low") where.stock = { gt: 0, lte: 10 };
  if (filters.stockStatus === "available") where.stock = { gt: 0 };
  const data = await prisma.product.findMany({
    where,
    include: {
      category: { select: { name: true } },
      brand: { select: { name: true } },
      supplier: { select: { name: true } },
    },
    orderBy: { name: "asc" }, take: 10000,
  });
  return {
    columns: [
      { key: "code", header: "Kode", width: 16 },
      { key: "name", header: "Nama Produk", width: 28 },
      { key: "category", header: "Kategori", width: 15 },
      { key: "brand", header: "Brand", width: 15 },
      { key: "supplier", header: "Supplier", width: 18 },
      { key: "unit", header: "Satuan", width: 8 },
      { key: "barcode", header: "Barcode", width: 16 },
      { key: "purchasePrice", header: "Harga Beli", width: 14 },
      { key: "sellingPrice", header: "Harga Jual", width: 14 },
      { key: "margin", header: "Margin (%)", width: 10 },
      { key: "stock", header: "Stok", width: 8 },
      { key: "minStock", header: "Min. Stok", width: 10 },
      { key: "description", header: "Deskripsi", width: 25 },
      { key: "isActive", header: "Status", width: 8 },
      { key: "createdAt", header: "Dibuat", width: 12 },
    ] as ExportColumn[],
    rows: data.map((d) => {
      const margin = d.purchasePrice > 0 ? ((d.sellingPrice - d.purchasePrice) / d.purchasePrice * 100).toFixed(1) : "0";
      return {
        code: d.code,
        name: d.name,
        category: d.category?.name ?? "-",
        brand: (d as unknown as { brand?: { name: string } | null }).brand?.name ?? "-",
        supplier: (d as unknown as { supplier?: { name: string } | null }).supplier?.name ?? "-",
        unit: d.unit,
        barcode: d.barcode ?? "-",
        purchasePrice: d.purchasePrice,
        sellingPrice: d.sellingPrice,
        margin: `${margin}%`,
        stock: d.stock,
        minStock: d.minStock,
        description: d.description ?? "-",
        isActive: d.isActive ? "Aktif" : "Nonaktif",
        createdAt: d.createdAt ? new Date(d.createdAt).toLocaleDateString("id-ID") : "-",
      };
    }),
    title: "Produk",
  };
}

async function fetchCategoriesData(companyId: string, _filters: Record<string, string | undefined>) {
  const data = await prisma.category.findMany({ where: { companyId }, orderBy: { name: "asc" } });
  return {
    columns: [
      { key: "name", header: "Nama Kategori", width: 25 }, { key: "description", header: "Deskripsi", width: 35 },
      { key: "productCount", header: "Jumlah Produk", width: 12 },
    ] as ExportColumn[],
    rows: data.map((d) => ({ name: d.name, description: d.description ?? "", productCount: 0 })),
    title: "Kategori",
  };
}

async function fetchBrandsData(companyId: string, _filters: Record<string, string | undefined>) {
  const data = await prisma.brand.findMany({ where: { companyId }, orderBy: { name: "asc" } });
  return {
    columns: [
      { key: "name", header: "Nama Brand", width: 25 },
    ] as ExportColumn[],
    rows: data.map((d) => ({ name: d.name })),
    title: "Brand",
  };
}

async function fetchSuppliersData(companyId: string, _filters: Record<string, string | undefined>) {
  const data = await prisma.supplier.findMany({ where: { companyId }, orderBy: { name: "asc" } });
  return {
    columns: [
      { key: "name", header: "Nama", width: 22 }, { key: "contact", header: "Kontak", width: 15 },
      { key: "email", header: "Email", width: 22 }, { key: "address", header: "Alamat", width: 30 },
      { key: "isActive", header: "Aktif", width: 8 },
    ] as ExportColumn[],
    rows: data.map((d) => ({ name: d.name, contact: d.contact ?? "-", email: d.email ?? "-", address: d.address ?? "-", isActive: d.isActive ? "Ya" : "Tidak" })),
    title: "Supplier",
  };
}

async function fetchCustomersData(companyId: string, _filters: Record<string, string | undefined>) {
  const data = await prisma.customer.findMany({ where: { companyId }, orderBy: { name: "asc" }, take: 5000 });
  return {
    columns: [
      { key: "name", header: "Nama", width: 22 }, { key: "phone", header: "Telepon", width: 15 },
      { key: "email", header: "Email", width: 22 }, { key: "memberLevel", header: "Level", width: 12 },
      { key: "points", header: "Poin", width: 10 }, { key: "totalSpending", header: "Total Belanja", width: 18 },
    ] as ExportColumn[],
    rows: data.map((d) => ({ name: d.name, phone: d.phone ?? "-", email: d.email ?? "-", memberLevel: d.memberLevel, points: d.points, totalSpending: d.totalSpending })),
    title: "Customer",
  };
}

async function fetchBundlesData(companyId: string, filters: Record<string, string | undefined>) {
  const where: Record<string, unknown> = { companyId };
  if (filters.branchId) where.branchId = filters.branchId;
  const data = await prisma.productBundle.findMany({
    where, include: { branch: { select: { name: true } }, _count: { select: { items: true } } },
    orderBy: { name: "asc" }, take: 5000,
  });
  return {
    columns: [
      { key: "code", header: "Kode", width: 15 }, { key: "name", header: "Nama Paket", width: 25 },
      { key: "sellingPrice", header: "Harga Paket", width: 15 }, { key: "totalBasePrice", header: "Harga Normal", width: 15 },
      { key: "itemCount", header: "Item", width: 8 }, { key: "branch", header: "Lokasi", width: 15 },
      { key: "isActive", header: "Aktif", width: 8 },
    ] as ExportColumn[],
    rows: data.map((d) => ({ code: d.code, name: d.name, sellingPrice: d.sellingPrice, totalBasePrice: d.totalBasePrice, itemCount: d._count.items, branch: d.branch?.name ?? "-", isActive: d.isActive ? "Ya" : "Tidak" })),
    title: "Paket Produk",
  };
}

async function fetchPriceSchedulesData(companyId: string, filters: Record<string, string | undefined>) {
  const where: Record<string, unknown> = { companyId };
  if (filters.branchId) where.branchId = filters.branchId;
  const data = await prisma.priceSchedule.findMany({
    where, include: { product: { select: { name: true, code: true } }, branch: { select: { name: true } } },
    orderBy: { createdAt: "desc" }, take: 5000,
  });
  return {
    columns: [
      { key: "productCode", header: "Kode Produk", width: 12 }, { key: "productName", header: "Produk", width: 22 },
      { key: "originalPrice", header: "Harga Awal", width: 15 }, { key: "newPrice", header: "Harga Baru", width: 15 },
      { key: "startDate", header: "Mulai", width: 12 }, { key: "endDate", header: "Berakhir", width: 12 },
      { key: "branch", header: "Lokasi", width: 15 }, { key: "isActive", header: "Aktif", width: 8 },
    ] as ExportColumn[],
    rows: data.map((d) => ({ productCode: d.product.code, productName: d.product.name, originalPrice: d.originalPrice, newPrice: d.newPrice, startDate: d.startDate.toISOString().split("T")[0], endDate: d.endDate.toISOString().split("T")[0], branch: d.branch?.name ?? "-", isActive: d.isActive ? "Ya" : "Tidak" })),
    title: "Jadwal Harga",
  };
}

async function fetchAuditLogsData(companyId: string, filters: Record<string, string | undefined>) {
  const where: Record<string, unknown> = { user: { companyId } };
  if (filters.branchId) where.branchId = filters.branchId;
  const data = await prisma.auditLog.findMany({
    where, include: { user: { select: { name: true } }, branch: { select: { name: true } } },
    orderBy: { createdAt: "desc" }, take: 5000,
  });
  return {
    columns: [
      { key: "date", header: "Tanggal", width: 18 }, { key: "user", header: "User", width: 18 },
      { key: "action", header: "Aksi", width: 10 }, { key: "entity", header: "Entitas", width: 15 },
      { key: "entityId", header: "ID", width: 15 }, { key: "branch", header: "Lokasi", width: 15 },
    ] as ExportColumn[],
    rows: data.map((d) => ({ date: d.createdAt.toISOString().replace("T", " ").slice(0, 19), user: d.user?.name ?? "-", action: d.action, entity: d.entity, entityId: d.entityId ?? "-", branch: d.branch?.name ?? "-" })),
    title: "Audit Log",
  };
}

async function fetchBranchPricesData(companyId: string, filters: Record<string, string | undefined>) {
  const where: Record<string, unknown> = { branch: { companyId } };
  if (filters.branchId) where.branchId = filters.branchId;
  const data = await prisma.branchProductPrice.findMany({
    where, include: { product: { select: { code: true, name: true } }, branch: { select: { name: true } } },
    orderBy: { product: { name: "asc" } }, take: 5000,
  });
  return {
    columns: [
      { key: "productCode", header: "Kode Produk", width: 12 }, { key: "productName", header: "Produk", width: 25 },
      { key: "branch", header: "Cabang", width: 18 }, { key: "sellingPrice", header: "Harga Jual", width: 15 },
      { key: "purchasePrice", header: "Harga Beli", width: 15 },
    ] as ExportColumn[],
    rows: data.map((d) => ({ productCode: d.product.code, productName: d.product.name, branch: d.branch.name, sellingPrice: d.sellingPrice, purchasePrice: d.purchasePrice ?? "-" })),
    title: "Harga per Cabang",
  };
}
