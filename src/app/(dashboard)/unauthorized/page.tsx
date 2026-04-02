"use client";

import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ShieldX, ArrowLeft, Home } from "lucide-react";
import Link from "next/link";

const pageLabels: Record<string, string> = {
    "/products": "Produk",
    "/categories": "Kategori",
    "/brands": "Brand",
    "/suppliers": "Supplier",
    "/customers": "Customer",
    "/transactions": "Riwayat Transaksi",
    "/pos": "POS Kasir",
    "/stock": "Manajemen Stok",
    "/stock-opname": "Stock Opname",
    "/stock-transfers": "Transfer Stok",
    "/purchases": "Purchase Order",
    "/shifts": "Shift Kasir",
    "/closing-reports": "Laporan Closing",
    "/expenses": "Pengeluaran",
    "/promotions": "Promo",
    "/reports": "Laporan",
    "/analytics": "Business Intelligence",
    "/customer-intelligence": "Customer Intelligence",
    "/users": "Manajemen Pengguna",
    "/branches": "Cabang",
    "/branch-prices": "Harga Cabang",
    "/access-control": "Hak Akses",
    "/audit-logs": "Audit Log",
    "/settings": "Pengaturan",
    "/dashboard": "Dashboard",
    "/debts": "Hutang Piutang",
    "/cashier-performance": "Performa Kasir",
};

export default function UnauthorizedPage() {
    const searchParams = useSearchParams();
    const targetPath = searchParams.get("page") || "";
    const pageName = pageLabels[targetPath] || targetPath || "halaman tersebut";

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
            <div className="max-w-md w-full text-center space-y-6">
                {/* Icon */}
                <div className="flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-red-500 to-rose-600 shadow-xl shadow-red-200/50 mx-auto">
                    <ShieldX className="w-10 h-10 text-white" />
                </div>

                {/* Title */}
                <div className="space-y-2">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        Akses Ditolak
                    </h1>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                        Anda tidak memiliki izin untuk mengakses halaman{" "}
                        <span className="font-semibold text-foreground">{pageName}</span>.
                        Hubungi administrator untuk mendapatkan akses.
                    </p>
                </div>

                {/* Target page info */}
                <div className="rounded-xl bg-red-50/50 border border-red-100 p-4">
                    <div className="flex items-center justify-center gap-2 text-sm text-red-600">
                        <ShieldX className="w-4 h-4 shrink-0" />
                        <span className="font-mono text-xs">{targetPath || "/"}</span>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-center gap-3 pt-2">
                    <Button
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => window.history.back()}
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Kembali
                    </Button>
                    <Link href="/dashboard">
                        <Button className="rounded-xl shadow-md shadow-primary/20">
                            <Home className="w-4 h-4 mr-2" />
                            Dashboard
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
