"use client";

import { useState, useTransition } from "react";
import { createBranch, updateBranch, deleteBranch, getBranches } from "@/features/branches";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { SmartColumn } from "@/components/ui/smart-table";
import { SmartTable } from "@/components/ui/smart-table";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { toast } from "sonner";
import type { Branch } from "@/types";

interface Props { initialData: { branches: Branch[]; total: number; totalPages: number }; }

export function BranchesContent({ initialData }: Props) {
    const [data, setData] = useState(initialData);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<Branch | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [search, setSearch] = useState("");
    const [loading, startTransition] = useTransition();

    const fetchData = (params: { search?: string; page?: number; pageSize?: number }) => {
        startTransition(async () => {
            const result = await getBranches({ search: params.search ?? search, page: params.page ?? page, perPage: params.pageSize ?? pageSize });
            setData(result);
        });
    };

    const handleSubmit = async (formData: FormData) => {
        if (!formData.get("isActive")) formData.set("isActive", "true");
        const result = editing ? await updateBranch(editing.id, formData) : await createBranch(formData);
        if (result.error) { toast.error(result.error); }
        else { toast.success(editing ? "Cabang berhasil diupdate" : "Cabang berhasil ditambahkan"); setOpen(false); setEditing(null); fetchData({}); }
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
        const result = await deleteBranch(id);
        if (result.error) toast.error(result.error); else { toast.success("Cabang berhasil dihapus"); fetchData({}); }
    };

    const columns: SmartColumn<Branch>[] = [
        { key: "name", header: "Nama Cabang", sortable: true, render: (row) => <span className="font-medium text-sm">{row.name}</span>, exportValue: (row) => row.name },
        { key: "address", header: "Alamat", render: (row) => <span className="text-xs text-muted-foreground">{row.address || "-"}</span>, exportValue: (row) => row.address || "-" },
        { key: "phone", header: "Telepon", render: (row) => <span className="text-xs text-muted-foreground">{row.phone || "-"}</span>, exportValue: (row) => row.phone || "-" },
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

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div><h1 className="text-2xl font-bold text-foreground">Cabang / Store</h1><p className="text-muted-foreground text-sm">Kelola cabang toko</p></div>
                <Button className="rounded-lg" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="w-4 h-4 mr-2" /> Tambah Cabang</Button>
            </div>
            <SmartTable<Branch> data={data.branches} columns={columns} totalItems={data.total} totalPages={data.totalPages}
                currentPage={page} pageSize={pageSize} loading={loading} title="Daftar Cabang" titleIcon={<Building2 className="w-4 h-4 text-muted-foreground" />}
                searchPlaceholder="Cari cabang..." onSearch={(q) => { setSearch(q); setPage(1); fetchData({ search: q, page: 1 }); }}
                onPageChange={(p) => { setPage(p); fetchData({ page: p }); }} onPageSizeChange={(s) => { setPageSize(s); setPage(1); fetchData({ pageSize: s, page: 1 }); }}
                exportFilename="cabang" emptyIcon={<Building2 className="w-10 h-10 text-muted-foreground/30" />} emptyTitle="Belum ada cabang"
            />
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
                <DialogContent className="rounded-2xl max-w-md">
                    <DialogHeader><DialogTitle>{editing ? "Edit Cabang" : "Tambah Cabang"}</DialogTitle></DialogHeader>
                    <form action={handleSubmit} className="space-y-4">
                        <div className="space-y-1.5"><Label className="text-sm">Nama Cabang <span className="text-red-400">*</span></Label><Input name="name" defaultValue={editing?.name || ""} required className="rounded-lg" autoFocus /></div>
                        <div className="space-y-1.5"><Label className="text-sm">Alamat</Label><Input name="address" defaultValue={editing?.address || ""} className="rounded-lg" /></div>
                        <div className="space-y-1.5"><Label className="text-sm">Telepon</Label><Input name="phone" defaultValue={editing?.phone || ""} className="rounded-lg" /></div>
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
                    <p className="text-sm text-muted-foreground">Yakin ingin menghapus cabang ini?</p>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => { setConfirmOpen(false); setPendingDeleteId(null); }} className="rounded-lg">Batal</Button>
                        <Button variant="destructive" onClick={confirmDelete} className="rounded-lg">Ya, Hapus</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
