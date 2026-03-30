"use client";

import { useState, useTransition } from "react";
import { createSupplier, updateSupplier, deleteSupplier, getSuppliers } from "@/features/suppliers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import type { SmartColumn, SmartFilter } from "@/components/ui/smart-table";
import { SmartTable } from "@/components/ui/smart-table";
import { Plus, Pencil, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";
import type { Supplier } from "@/types";

interface Props {
  initialData: { suppliers: Supplier[]; total: number; totalPages: number };
}

export function SuppliersContent({ initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({ status: "ALL" });
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [loading, startTransition] = useTransition();

  const fetchData = (params: { search?: string; page?: number; pageSize?: number; filters?: Record<string, string> }) => {
    startTransition(async () => {
      const f = params.filters ?? activeFilters;
      const query = {
        search: params.search ?? search,
        page: params.page ?? page,
        perPage: params.pageSize ?? pageSize,
        ...(f.status !== "ALL" ? { status: f.status } : {}),
      };
      const result = await getSuppliers(query);
      setData(result);
    });
  };

  const handleSubmit = async (formData: FormData) => {
    if (!formData.get("isActive")) formData.set("isActive", "true");
    const result = editing ? await updateSupplier(editing.id, formData) : await createSupplier(formData);
    if (result.error) { toast.error(result.error); }
    else { toast.success(editing ? "Supplier berhasil diupdate" : "Supplier berhasil ditambahkan"); setOpen(false); setEditing(null); fetchData({}); }
  };

  const handleDelete = async (id: string) => {
    setPendingDeleteId(id);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    setConfirmOpen(false);
    const result = await deleteSupplier(id);
    if (result.error) toast.error(result.error);
    else { toast.success("Supplier berhasil dihapus"); fetchData({}); }
  };

  const columns: SmartColumn<Supplier>[] = [
    { key: "name", header: "Nama", sortable: true, render: (row) => <span className="font-medium text-sm">{row.name}</span>, exportValue: (row) => row.name },
    { key: "contact", header: "Kontak", render: (row) => <span className="text-xs text-muted-foreground">{row.contact || "-"}</span>, exportValue: (row) => row.contact || "-" },
    { key: "email", header: "Email", render: (row) => <span className="text-xs text-muted-foreground">{row.email || "-"}</span>, exportValue: (row) => row.email || "-" },
    { key: "products", header: "Produk", align: "center", render: (row) => <Badge variant="secondary" className="rounded-lg">{row._count.products}</Badge>, exportValue: (row) => row._count.products },
    { key: "status", header: "Status", align: "center", render: (row) => <Badge className={row.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>{row.isActive ? "Aktif" : "Nonaktif"}</Badge>, exportValue: (row) => row.isActive ? "Aktif" : "Nonaktif" },
    {
      key: "actions", header: "Aksi", align: "right", sticky: true, width: "90px",
      render: (row) => (
        <div className="flex justify-end gap-0.5">
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => { setEditing(row); setOpen(true); }}><Pencil className="w-3.5 h-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(row.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
        </div>
      ),
    },
  ];

  const filters: SmartFilter[] = [
    { key: "status", label: "Status", type: "select", options: [{ value: "active", label: "Aktif" }, { value: "inactive", label: "Nonaktif" }] },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Supplier</h1>
          <p className="text-muted-foreground text-sm">Kelola data supplier</p>
        </div>
        <Button className="rounded-lg" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Tambah Supplier
        </Button>
      </div>

      <SmartTable<Supplier>
        data={data.suppliers} columns={columns} totalItems={data.total} totalPages={data.totalPages}
        currentPage={page} pageSize={pageSize} loading={loading}
        title="Daftar Supplier" titleIcon={<Truck className="w-4 h-4 text-muted-foreground" />}
        searchPlaceholder="Cari supplier..."
        onSearch={(q) => { setSearch(q); setPage(1); fetchData({ search: q, page: 1 }); }}
        onPageChange={(p) => { setPage(p); fetchData({ page: p }); }}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1); fetchData({ pageSize: s, page: 1 }); }}
        filters={filters} activeFilters={activeFilters}
        onFilterChange={(f) => { setActiveFilters(f); setPage(1); fetchData({ filters: f, page: 1 }); }}
        selectable selectedRows={selectedRows} onSelectionChange={setSelectedRows} rowKey={(r) => r.id}
        exportFilename="supplier"
        emptyIcon={<Truck className="w-10 h-10 text-muted-foreground/30" />} emptyTitle="Belum ada supplier"
      />

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Supplier" : "Tambah Supplier"}</DialogTitle></DialogHeader>
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-1.5"><Label className="text-sm">Nama Supplier <span className="text-red-400">*</span></Label><Input name="name" defaultValue={editing?.name || ""} required className="rounded-lg" autoFocus /></div>
            <div className="space-y-1.5"><Label className="text-sm">Kontak</Label><Input name="contact" defaultValue={editing?.contact || ""} className="rounded-lg" /></div>
            <div className="space-y-1.5"><Label className="text-sm">Email</Label><Input name="email" type="email" defaultValue={editing?.email || ""} className="rounded-lg" /></div>
            <div className="space-y-1.5"><Label className="text-sm">Alamat</Label><Input name="address" defaultValue={editing?.address || ""} className="rounded-lg" /></div>
            <input type="hidden" name="isActive" value={editing ? String(editing.isActive) : "true"} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setOpen(false); setEditing(null); }} className="rounded-lg">Batal</Button>
              <Button type="submit" className="rounded-lg">{editing ? "Update" : "Simpan"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader><DialogTitle>Konfirmasi</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Yakin ingin menghapus supplier ini?</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setConfirmOpen(false); setPendingDeleteId(null); }} className="rounded-lg">Batal</Button>
            <Button variant="destructive" onClick={confirmDelete} className="rounded-lg">Ya, Hapus</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
