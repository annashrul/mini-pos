"use client";

import { useState, useTransition } from "react";
import { createCategory, updateCategory, deleteCategory, getCategories } from "@/features/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { SmartColumn } from "@/components/ui/smart-table";
import { SmartTable } from "@/components/ui/smart-table";
import { Plus, Pencil, Trash2, FolderTree } from "lucide-react";
import { toast } from "sonner";
import type { Category } from "@/types";

interface Props { initialData: { categories: Category[]; total: number; totalPages: number }; }

export function CategoriesContent({ initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [loading, startTransition] = useTransition();

  const fetchData = (params: { search?: string; page?: number; pageSize?: number }) => {
    startTransition(async () => {
      const result = await getCategories({ search: params.search ?? search, page: params.page ?? page, perPage: params.pageSize ?? pageSize });
      setData(result);
    });
  };

  const handleSubmit = async (formData: FormData) => {
    const result = editing ? await updateCategory(editing.id, formData) : await createCategory(formData);
    if (result.error) { toast.error(result.error); }
    else { toast.success(editing ? "Kategori berhasil diupdate" : "Kategori berhasil ditambahkan"); setOpen(false); setEditing(null); fetchData({}); }
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
    const result = await deleteCategory(id);
    if (result.error) toast.error(result.error); else { toast.success("Kategori berhasil dihapus"); fetchData({}); }
  };

  const columns: SmartColumn<Category>[] = [
    { key: "name", header: "Nama Kategori", sortable: true, render: (row) => <span className="font-medium text-sm">{row.name}</span>, exportValue: (row) => row.name },
    { key: "description", header: "Deskripsi", render: (row) => <span className="text-xs text-muted-foreground">{row.description || "-"}</span>, exportValue: (row) => row.description || "-" },
    { key: "products", header: "Jumlah Produk", align: "center", sortable: true, render: (row) => <Badge variant="secondary" className="rounded-lg">{row._count.products}</Badge>, exportValue: (row) => row._count.products },
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-foreground">Kategori Produk</h1><p className="text-muted-foreground text-sm">Kelola kategori produk</p></div>
        <Button className="rounded-lg" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="w-4 h-4 mr-2" /> Tambah Kategori</Button>
      </div>
      <SmartTable<Category> data={data.categories} columns={columns} totalItems={data.total} totalPages={data.totalPages}
        currentPage={page} pageSize={pageSize} loading={loading} title="Daftar Kategori" titleIcon={<FolderTree className="w-4 h-4 text-muted-foreground" />}
        searchPlaceholder="Cari kategori..." onSearch={(q) => { setSearch(q); setPage(1); fetchData({ search: q, page: 1 }); }}
        onPageChange={(p) => { setPage(p); fetchData({ page: p }); }} onPageSizeChange={(s) => { setPageSize(s); setPage(1); fetchData({ pageSize: s, page: 1 }); }}
        selectable selectedRows={selectedRows} onSelectionChange={setSelectedRows} rowKey={(r) => r.id} exportFilename="kategori"
        emptyIcon={<FolderTree className="w-10 h-10 text-muted-foreground/30" />} emptyTitle="Belum ada kategori"
        emptyAction={<Button variant="outline" size="sm" className="rounded-lg mt-2" onClick={() => setOpen(true)}><Plus className="w-3 h-3 mr-1" /> Tambah Kategori</Button>}
      />
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader><DialogTitle>{editing ? "Edit Kategori" : "Tambah Kategori"}</DialogTitle></DialogHeader>
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-1.5"><Label className="text-sm">Nama Kategori <span className="text-red-400">*</span></Label><Input name="name" defaultValue={editing?.name || ""} required className="rounded-lg" autoFocus /></div>
            <div className="space-y-1.5"><Label className="text-sm">Deskripsi</Label><Input name="description" defaultValue={editing?.description || ""} className="rounded-lg" /></div>
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
          <p className="text-sm text-muted-foreground">Yakin ingin menghapus kategori ini?</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setConfirmOpen(false); setPendingDeleteId(null); }} className="rounded-lg">Batal</Button>
            <Button variant="destructive" onClick={confirmDelete} className="rounded-lg">Ya, Hapus</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
