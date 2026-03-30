"use client";

import { useState, useTransition } from "react";
import { createBrand, updateBrand, deleteBrand, getBrands } from "@/features/brands";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import type { SmartColumn } from "@/components/ui/smart-table";
import { SmartTable } from "@/components/ui/smart-table";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import { toast } from "sonner";
import type { Brand } from "@/types";

interface Props {
    initialData: { brands: Brand[]; total: number; totalPages: number };
}

export function BrandsContent({ initialData }: Props) {
    const [data, setData] = useState(initialData);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<Brand | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const [pendingConfirmAction, setPendingConfirmAction] = useState<null | (() => Promise<void>)>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [search, setSearch] = useState("");
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [loading, startTransition] = useTransition();

    const fetchData = (params: { search?: string; page?: number; pageSize?: number }) => {
        startTransition(async () => {
            const result = await getBrands({
                search: params.search ?? search,
                page: params.page ?? page,
                perPage: params.pageSize ?? pageSize,
            });
            setData(result);
        });
    };

    const handleSubmit = async (formData: FormData) => {
        const result = editing ? await updateBrand(editing.id, formData) : await createBrand(formData);
        if (result.error) { toast.error(result.error); }
        else { toast.success(editing ? "Brand berhasil diupdate" : "Brand berhasil ditambahkan"); setOpen(false); setEditing(null); fetchData({}); }
    };

    const handleDelete = async (id: string) => {
        setConfirmText("Yakin ingin menghapus brand ini?");
        setPendingConfirmAction(() => async () => {
            const result = await deleteBrand(id);
            if (result.error) toast.error(result.error);
            else { toast.success("Brand berhasil dihapus"); fetchData({}); }
            setConfirmOpen(false);
            setPendingConfirmAction(null);
        });
        setConfirmOpen(true);
    };

    const columns: SmartColumn<Brand>[] = [
        { key: "name", header: "Nama Brand", sortable: true, render: (row) => <span className="font-medium text-sm">{row.name}</span>, exportValue: (row) => row.name },
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
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Brand Produk</h1>
                    <p className="text-muted-foreground text-sm">Kelola brand/merek produk</p>
                </div>
                <Button className="rounded-lg" onClick={() => { setEditing(null); setOpen(true); }}>
                    <Plus className="w-4 h-4 mr-2" /> Tambah Brand
                </Button>
            </div>

            <SmartTable<Brand>
                data={data.brands} columns={columns} totalItems={data.total} totalPages={data.totalPages}
                currentPage={page} pageSize={pageSize} loading={loading}
                title="Daftar Brand" titleIcon={<Tag className="w-4 h-4 text-muted-foreground" />}
                searchPlaceholder="Cari brand..."
                onSearch={(q) => { setSearch(q); setPage(1); fetchData({ search: q, page: 1 }); }}
                onPageChange={(p) => { setPage(p); fetchData({ page: p }); }}
                onPageSizeChange={(s) => { setPageSize(s); setPage(1); fetchData({ pageSize: s, page: 1 }); }}
                selectable selectedRows={selectedRows} onSelectionChange={setSelectedRows} rowKey={(r) => r.id}
                bulkActions={[{
                    label: "Hapus",
                    variant: "destructive",
                    icon: <Trash2 className="w-3 h-3" />,
                    onClick: async (ids) => {
                        setConfirmText(`Hapus ${ids.length} brand?`);
                        setPendingConfirmAction(() => async () => {
                            for (const id of ids) await deleteBrand(id);
                            toast.success("Brand dihapus");
                            setSelectedRows(new Set());
                            fetchData({});
                            setConfirmOpen(false);
                            setPendingConfirmAction(null);
                        });
                        setConfirmOpen(true);
                    },
                }]}
                exportFilename="brand"
                emptyIcon={<Tag className="w-10 h-10 text-muted-foreground/30" />} emptyTitle="Belum ada brand"
                emptyAction={<Button variant="outline" size="sm" className="rounded-lg mt-2" onClick={() => setOpen(true)}><Plus className="w-3 h-3 mr-1" /> Tambah Brand</Button>}
            />

            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
                <DialogContent className="rounded-2xl max-w-sm">
                    <DialogHeader><DialogTitle>{editing ? "Edit Brand" : "Tambah Brand"}</DialogTitle></DialogHeader>
                    <form action={handleSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-sm">Nama Brand <span className="text-red-400">*</span></Label>
                            <Input name="name" defaultValue={editing?.name || ""} required className="rounded-lg" autoFocus />
                        </div>
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
                    <p className="text-sm text-muted-foreground">{confirmText}</p>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => { setConfirmOpen(false); setPendingConfirmAction(null); }} className="rounded-lg">Batal</Button>
                        <Button variant="destructive" onClick={async () => { await pendingConfirmAction?.(); }} className="rounded-lg">Ya, Lanjutkan</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
