"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { deleteProduct, getProducts, getProductStats, bulkDeleteProducts } from "@/features/products";
import { useMenuActionAccess } from "@/features/access-control";
import { getAllCategories } from "@/features/categories";
import { getBrands } from "@/features/brands";
import { getAllBranches } from "@/features/branches";
import { getSuppliers } from "@/features/suppliers";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActionConfirmDialog } from "@/components/ui/action-confirm-dialog";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
import type { SmartColumn, SmartFilter } from "@/components/ui/smart-table";
import { SmartTable } from "@/components/ui/smart-table";
import { Plus, Pencil, Trash2, Package, Upload, PackageCheck, AlertTriangle, PackageX, Layers, Barcode, Tag, Truck } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { usePlanAccess } from "@/hooks/use-plan-access";
import { useBranch } from "@/components/providers/branch-provider";
import { toast } from "sonner";
import type { Product, Category, Branch } from "@/types";
import { ProductFormDialog } from "./product-form-dialog";
import { ProductImportDialog } from "./product-import-dialog";

export function ProductsContent() {
  const [data, setData] = useState<{ products: Product[]; total: number; totalPages: number; currentPage: number }>({ products: [], total: 0, totalPages: 0, currentPage: 1 });
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pendingConfirmAction, setPendingConfirmAction] = useState<null | (() => Promise<void>)>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({
    categoryId: "ALL",
    brandId: "ALL",
    status: "ALL",
    stockStatus: "ALL",
  });
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<string>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [loading, startTransition] = useTransition();
  const { selectedBranchId } = useBranch();
  const { canAction, cannotMessage } = useMenuActionAccess("products");
  const { canAction: canPlanAction } = usePlanAccess();
  const canCreate = canAction("create") && canPlanAction("products", "create");
  const canUpdate = canAction("update") && canPlanAction("products", "update");
  const canDelete = canAction("delete") && canPlanAction("products", "delete");
  const canImport = canAction("import") && canPlanAction("products", "import");

  const fetchData = (params: { search?: string; page?: number; pageSize?: number; filters?: Record<string, string>; sortKey?: string; sortDir?: "asc" | "desc"; refreshStats?: boolean }) => {
    startTransition(async () => {
      const f = params.filters ?? activeFilters;
      const sk = params.sortKey ?? sortKey;
      const sd = params.sortDir ?? sortDir;
      const query = {
        search: params.search ?? search,
        page: params.page ?? page,
        limit: params.pageSize ?? pageSize,
        ...(f.categoryId !== "ALL" ? { categoryId: f.categoryId } : {}),
        ...(f.brandId !== "ALL" ? { brandId: f.brandId } : {}),
        ...(f.status !== "ALL" ? { status: f.status } : {}),
        ...(f.stockStatus !== "ALL" ? { stockStatus: f.stockStatus } : {}),
        ...(selectedBranchId ? { branchId: selectedBranchId } : {}),
        ...(sk ? { sortBy: sk, sortDir: sd } : {}),
      };
      const promises: [ReturnType<typeof getProducts>, ...Promise<unknown>[]] = [getProducts(query)];
      if (params.refreshStats) promises.push(getProductStats(selectedBranchId || undefined));
      const results = await Promise.all(promises);
      setData(results[0]);
      if (params.refreshStats && results[1]) setStats(results[1] as typeof stats);
    });
  };

  useEffect(() => {
    startTransition(async () => {
      const [productsData, categoriesData, brandsData, suppliersData, branchesData, statsData] = await Promise.all([
        getProducts(selectedBranchId ? { branchId: selectedBranchId } : {}),
        getAllCategories(),
        getBrands({ perPage: 1000 }),
        getSuppliers({ perPage: 1000 }),
        getAllBranches(),
        getProductStats(selectedBranchId || undefined),
      ]);
      setData(productsData);
      setCategories(categoriesData);
      setBrands(brandsData.brands);
      setSuppliers(suppliersData.suppliers);
      setBranches(branchesData);
      setStats(statsData);
    });
  }, [selectedBranchId]);
  const fetchDataWithStats = (params: Record<string, unknown> = {}) => fetchData({ ...params, refreshStats: true } as Parameters<typeof fetchData>[0]);

  const openCreateDialog = () => {
    if (!canCreate) { toast.error(cannotMessage("create")); return; }
    setEditingProduct(null);
    setOpen(true);
  };

  const openEditDialog = (product: Product) => {
    if (!canUpdate) { toast.error(cannotMessage("update")); return; }
    setEditingProduct(product);
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!canDelete) { toast.error(cannotMessage("delete")); return; }
    setConfirmText("Yakin ingin menghapus produk ini?");
    setPendingConfirmAction(() => async () => {
      const result = await deleteProduct(id);
      if (result.error) toast.error(result.error);
      else { toast.success("Produk berhasil dihapus"); fetchDataWithStats(); }
      setConfirmOpen(false);
      setPendingConfirmAction(null);
    });
    setConfirmOpen(true);
  };

  const handleBulkDelete = async (ids: string[]) => {
    if (!canDelete) { toast.error(cannotMessage("delete")); return; }
    setConfirmText(`Yakin ingin menghapus ${ids.length} produk?`);
    setPendingConfirmAction(() => async () => {
      const { count } = await bulkDeleteProducts(ids);
      toast.success(`${count} produk dihapus`);
      setSelectedRows(new Set());
      fetchDataWithStats();
      setConfirmOpen(false);
      setPendingConfirmAction(null);
    });
    setConfirmOpen(true);
  };

  const handleFormSubmitted = () => {
    setOpen(false);
    setEditingProduct(null);
    fetchDataWithStats();
  };

  // --- Stats ---
  const [stats, setStats] = useState({ total: 0, active: 0, lowStock: 0, outOfStock: 0 });

  // --- Render helpers ---
  const renderStockBadge = (row: Product) => {
    if (row.stock === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-sm">
          Habis
        </span>
      );
    }
    if (row.stock <= row.minStock) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r from-amber-400 to-orange-400 text-white shadow-sm">
          {row.stock}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-sm">
        {row.stock}
      </span>
    );
  };

  const renderStatusBadge = (row: Product) => {
    if (row.isActive) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium text-emerald-700 bg-emerald-50 ring-1 ring-emerald-600/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Aktif
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium text-slate-500 bg-slate-50 ring-1 ring-slate-300/50">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
        Nonaktif
      </span>
    );
  };

  // --- Columns ---
  const columns: SmartColumn<Product>[] = [
    {
      key: "name", header: "Produk", sortable: true, stickyLeft: true, width: "220px",
      render: (row) => (
        <div className="flex items-center gap-2.5">
          {row.imageUrl ? (
            <Image
              src={row.imageUrl}
              alt={row.name}
              width={36}
              height={36}
              className="w-9 h-9 rounded-lg object-cover shrink-0 border border-border/40 shadow-sm"
            />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center shrink-0 shadow-sm">
              <span className="text-xs font-bold text-white">{row.name.charAt(0).toUpperCase()}</span>
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate text-foreground">{row.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="font-mono text-[10px] text-muted-foreground whitespace-nowrap">{row.code}</span>
              <span className="text-muted-foreground/30">·</span>
              <span className="text-[10px] text-muted-foreground">{row.unit}</span>
            </div>
          </div>
        </div>
      ),
      exportValue: (row) => `${row.name} (${row.code})`,
    },
    {
      key: "category", header: "Kategori", sortable: true,
      render: (row) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-indigo-50 to-blue-50 text-indigo-700 ring-1 ring-indigo-200/60">
          {row.category.name}
        </span>
      ),
      exportValue: (row) => row.category.name,
    },
    {
      key: "brand", header: "Brand",
      render: (row) => {
        const brand = (row as unknown as { brand?: { name: string } | null }).brand;
        return brand ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 ring-1 ring-amber-200/60">
            <Tag className="w-2.5 h-2.5 mr-1" />{brand.name}
          </span>
        ) : <span className="text-xs text-muted-foreground/40">—</span>;
      },
      exportValue: (row) => (row as unknown as { brand?: { name: string } | null }).brand?.name ?? "",
    },
    {
      key: "supplier", header: "Supplier",
      render: (row) => {
        const supplier = (row as unknown as { supplier?: { name: string } | null }).supplier;
        return supplier ? (
          <span className="flex items-center gap-1 text-xs text-foreground">
            <Truck className="w-3 h-3 text-muted-foreground/50 shrink-0" />{supplier.name}
          </span>
        ) : <span className="text-xs text-muted-foreground/40">—</span>;
      },
      exportValue: (row) => (row as unknown as { supplier?: { name: string } | null }).supplier?.name ?? "",
    },
    {
      key: "barcode", header: "Barcode",
      render: (row) => row.barcode ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 font-mono text-[11px]">
          <Barcode className="w-3 h-3 shrink-0" />{row.barcode}
        </span>
      ) : <span className="text-xs text-muted-foreground/40">—</span>,
      exportValue: (row) => row.barcode ?? "",
    },
    {
      key: "purchasePrice", header: "Harga Beli", sortable: true, align: "right",
      render: (row) => (
        <span className="text-xs tabular-nums text-muted-foreground">{formatCurrency(row.purchasePrice)}</span>
      ),
      exportValue: (row) => row.purchasePrice,
    },
    {
      key: "sellingPrice", header: "Harga Jual", sortable: true, align: "right",
      render: (row) => (
        <span className="text-xs tabular-nums font-semibold text-indigo-600">{formatCurrency(row.sellingPrice)}</span>
      ),
      exportValue: (row) => row.sellingPrice,
    },
    {
      key: "stock", header: "Stok", sortable: true, align: "center",
      render: renderStockBadge,
      exportValue: (row) => row.stock,
    },
    {
      key: "minStock", header: "Min. Stok", align: "center",
      render: (row) => <span className="text-xs font-mono tabular-nums text-muted-foreground">{row.minStock}</span>,
      exportValue: (row) => row.minStock,
    },
    {
      key: "margin", header: "Margin", align: "right",
      render: (row) => {
        const margin = row.purchasePrice > 0 ? ((row.sellingPrice - row.purchasePrice) / row.purchasePrice) * 100 : 0;
        return (
          <span className={`text-xs font-mono tabular-nums font-medium ${margin > 0 ? "text-emerald-600" : margin < 0 ? "text-red-500" : "text-muted-foreground"}`}>
            {margin > 0 ? "+" : ""}{margin.toFixed(1)}%
          </span>
        );
      },
      exportValue: (row) => row.purchasePrice > 0 ? (((row.sellingPrice - row.purchasePrice) / row.purchasePrice) * 100).toFixed(1) + "%" : "0%",
    },
    {
      key: "description", header: "Deskripsi",
      render: (row) => row.description ? (
        <span className="text-xs text-muted-foreground truncate max-w-[150px] block">{row.description}</span>
      ) : <span className="text-xs text-muted-foreground/40">—</span>,
      exportValue: (row) => row.description ?? "",
    },
    {
      key: "createdAt", header: "Dibuat",
      render: (row) => {
        const date = (row as unknown as { createdAt?: string | Date }).createdAt;
        return date ? (
          <span className="text-[11px] text-muted-foreground font-mono tabular-nums">{format(new Date(date), "dd MMM yy", { locale: idLocale })}</span>
        ) : <span className="text-xs text-muted-foreground/40">—</span>;
      },
      exportValue: (row) => {
        const date = (row as unknown as { createdAt?: string | Date }).createdAt;
        return date ? format(new Date(date), "dd/MM/yyyy") : "";
      },
    },
    {
      key: "status", header: "Status", align: "center",
      render: renderStatusBadge,
      exportValue: (row) => row.isActive ? "Aktif" : "Nonaktif",
    },
    {
      key: "actions", header: "Aksi", align: "right", sticky: true, width: "100px",
      render: (row) => (
        <div className="flex justify-end gap-1">
          <DisabledActionTooltip disabled={!canUpdate} message={cannotMessage("update")} menuKey="products" actionKey="update">
            <Button
              disabled={!canUpdate}
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
              onClick={() => openEditDialog(row)}
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          </DisabledActionTooltip>
          <DisabledActionTooltip disabled={!canDelete} message={cannotMessage("delete")} menuKey="products" actionKey="delete">
            <Button
              disabled={!canDelete}
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-xl text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
              onClick={() => handleDelete(row.id)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </DisabledActionTooltip>
        </div>
      ),
    },
  ];

  const filters: SmartFilter[] = [
    {
      key: "categoryId", label: "Kategori", type: "select",
      options: categories.map((c) => ({ value: c.id, label: c.name })),
    },
    {
      key: "brandId", label: "Brand", type: "select",
      options: brands.map((b) => ({ value: b.id, label: b.name })),
    },
    {
      key: "status", label: "Status", type: "select",
      options: [
        { value: "active", label: "Aktif" },
        { value: "inactive", label: "Nonaktif" },
      ],
    },
    {
      key: "stockStatus", label: "Stok", type: "select",
      options: [
        { value: "available", label: "Tersedia" },
        { value: "low", label: "Stok Rendah" },
        { value: "out", label: "Habis" },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* --- Header --- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center justify-center w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg shadow-indigo-500/20">
            <Package className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-3xl font-bold tracking-tight text-foreground">Master Produk</h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
              Kelola semua produk Anda{" "}
              <Badge variant="secondary" className="ml-1 rounded-full text-[10px] sm:text-xs tabular-nums font-medium">
                {data.total} produk
              </Badge>
            </p>
          </div>
        </div>
        <div className="hidden sm:flex gap-2">
          <DisabledActionTooltip disabled={!canImport} message={cannotMessage("import")} menuKey="products" actionKey="import">
            <Button disabled={!canImport} variant="outline" className="rounded-xl border-dashed" onClick={() => setImportOpen(true)}>
              <Upload className="w-4 h-4 mr-2" /> Import
            </Button>
          </DisabledActionTooltip>
          <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")} menuKey="products" actionKey="create">
            <Button disabled={!canCreate} className="rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 shadow-md shadow-indigo-500/20 text-white" onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" /> Tambah Produk
            </Button>
          </DisabledActionTooltip>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100/80 border border-slate-200/60">
          <div className="flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 shadow-sm">
            <Layers className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
          </div>
          <div>
            <p className="text-sm sm:text-lg font-bold tabular-nums text-foreground">{stats.total}</p>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground font-medium">Total Produk</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-emerald-50 to-green-50/80 border border-emerald-200/60">
          <div className="flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 shadow-sm">
            <PackageCheck className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
          </div>
          <div>
            <p className="text-sm sm:text-lg font-bold tabular-nums text-foreground">{stats.active}</p>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground font-medium">Produk Aktif</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50/80 border border-amber-200/60">
          <div className="flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-sm">
            <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
          </div>
          <div>
            <p className="text-sm sm:text-lg font-bold tabular-nums text-foreground">{stats.lowStock}</p>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground font-medium">Stok Menipis</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-red-50 to-rose-50/80 border border-red-200/60">
          <div className="flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-red-500 to-rose-500 shadow-sm">
            <PackageX className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
          </div>
          <div>
            <p className="text-sm sm:text-lg font-bold tabular-nums text-foreground">{stats.outOfStock}</p>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground font-medium">Stok Habis</p>
          </div>
        </div>
      </div>

      {/* --- Table --- */}
      <SmartTable<Product>
        data={data.products}
        columns={columns}
        totalItems={data.total}
        mobileRender={(row) => (
          <div className="flex items-start gap-3">
            {row.imageUrl ? (
              <Image src={row.imageUrl} alt={row.name} width={40} height={40} className="w-10 h-10 rounded-xl object-cover shrink-0 border-2 border-border/40 shadow-sm" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center shrink-0 shadow-sm">
                <span className="text-sm font-bold text-white">{row.name.charAt(0).toUpperCase()}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-sm truncate text-foreground">{row.name}</p>
                {renderStatusBadge(row)}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {row.code} &middot; {row.category.name}{row.brand ? ` \u00b7 ${row.brand.name}` : ""}
              </p>
              <p className="text-xs mt-1">
                <span className="font-semibold text-indigo-600">{formatCurrency(row.sellingPrice)}</span>
                <span className="text-muted-foreground"> &middot; Stok: </span>
                {renderStockBadge(row)}
              </p>
            </div>
          </div>
        )}
        totalPages={data.totalPages}
        currentPage={page}
        pageSize={pageSize}
        loading={loading}
        title="Daftar Produk"
        titleIcon={<Package className="w-4 h-4 text-indigo-500" />}
        searchPlaceholder="Cari produk..."
        onSearch={(q) => { setSearch(q); setPage(1); fetchData({ search: q, page: 1 }); }}
        onPageChange={(p) => { setPage(p); fetchData({ page: p }); }}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1); fetchData({ pageSize: s, page: 1 }); }}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={(key, dir) => { setSortKey(key); setSortDir(dir); setPage(1); fetchData({ page: 1, sortKey: key, sortDir: dir }); }}
        filters={filters}
        activeFilters={activeFilters}
        onFilterChange={(f) => { setActiveFilters(f); setPage(1); fetchData({ filters: f, page: 1 }); }}
        selectable
        selectedRows={selectedRows}
        onSelectionChange={setSelectedRows}
        rowKey={(row) => row.id}
        bulkActions={[
          { label: "Hapus", variant: "destructive", icon: <Trash2 className="w-3 h-3" />, onClick: handleBulkDelete },
        ]}
        filterColumns={2}
        planMenuKey="products" exportModule="products"
        emptyIcon={
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-blue-100 mx-auto">
            <Package className="w-8 h-8 text-indigo-400" />
          </div>
        }
        emptyTitle="Belum ada produk"
        emptyDescription="Mulai tambahkan produk pertama Anda untuk mengelola inventaris dengan mudah."
        emptyAction={
          <DisabledActionTooltip disabled={!canCreate} message={cannotMessage("create")} menuKey="products" actionKey="create">
            <Button disabled={!canCreate} className="rounded-xl mt-3 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 shadow-md shadow-indigo-500/20 text-white" onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" /> Tambah Produk Pertama
            </Button>
          </DisabledActionTooltip>
        }
      />

      <ProductFormDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEditingProduct(null);
        }}
        editingProduct={editingProduct}
        categories={categories}
        brands={brands}
        suppliers={suppliers}
        branches={branches}
        selectedBranchId={selectedBranchId || undefined}
        onSubmitted={handleFormSubmitted}
      />
      <ProductImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        branchId={selectedBranchId || undefined}
        onImported={() => fetchDataWithStats()}
      />

      {/* Floating button mobile */}
      {canCreate && (
        <button onClick={openCreateDialog} className="sm:hidden fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-lg shadow-indigo-500/30 flex items-center justify-center active:scale-95 transition-transform">
          <Plus className="w-6 h-6" />
        </button>
      )}

      <ActionConfirmDialog
        open={confirmOpen}
        onOpenChange={(v) => { setConfirmOpen(v); if (!v) setPendingConfirmAction(null); }}
        kind="delete"
        title="Konfirmasi"
        description={confirmText}
        confirmLabel="Ya, Lanjutkan"
        onConfirm={async () => { await pendingConfirmAction?.(); }}
        confirmDisabled={!canDelete}
      />
    </div>
  );
}
