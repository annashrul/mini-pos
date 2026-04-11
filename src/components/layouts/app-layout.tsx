"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useBranch } from "@/components/providers/branch-provider";
import { Sidebar } from "./sidebar";
import { NotificationBell } from "./notification-bell";
import { PlatformNotificationBell } from "./platform-notification-bell";
import { PlanExpiryBanner } from "./plan-expiry-banner";
import { PlanProvider } from "@/components/providers/plan-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Menu, Search, MapPin } from "lucide-react";

const pageTitles: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/pos": "POS Kasir",
    "/products": "Produk",
    "/bundles": "Paket Produk",
    "/categories": "Kategori",
    "/brands": "Brand",
    "/suppliers": "Supplier",
    "/customers": "Customer",
    "/transactions": "Riwayat Transaksi",
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
    "/users": "Pengguna",
    "/branches": "Cabang",
    "/branch-prices": "Harga Cabang",
    "/access-control": "Hak Akses",
    "/audit-logs": "Audit Log",
    "/settings": "Pengaturan",
    "/debts": "Hutang Piutang",
    "/cashier-performance": "Performa Kasir",
    "/ai-assistant": "AI Assistant",
    "/returns": "Return & Exchange",
    "/gift-cards": "Gift Card",
    "/sales-targets": "Sales Target",
    "/price-schedules": "Jadwal Harga",
    "/inventory-forecast": "Prediksi Stok",
    "/profit-dashboard": "Dashboard Profit",
    "/employee-schedules": "Jadwal Karyawan",
    "/kitchen-display": "Kitchen Display",
    "/accounting": "Dashboard Akuntansi",
    "/accounting/coa": "Chart of Accounts",
    "/accounting/journals": "Jurnal Umum",
    "/accounting/ledger": "Buku Besar",
    "/accounting/reports": "Laporan Keuangan",
    "/accounting/periods": "Tutup Buku",
    "/tables": "Manajemen Meja",
};

export function AppLayout({ children }: { children: React.ReactNode }) {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const pathname = usePathname();
    const isPOS = pathname === "/pos";
    const { data: session } = useSession();
    const currentRole = (session?.user as Record<string, unknown> | undefined)?.role as string;
    const { selectedBranchName } = useBranch();

    if (isPOS) {
        return (
            <div className="h-screen bg-[#F1F5F9] overflow-hidden">
                {children}
            </div>
        );
    }

    const pageTitle = pageTitles[pathname] || "";

    return (
        <PlanProvider>
        <div className="flex h-screen bg-[#F8FAFC]">
            {/* Mobile overlay */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 bg-black/30 z-40 lg:hidden"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div className={`
                fixed inset-y-0 left-0 z-50 lg:relative lg:z-auto
                transition-transform duration-300
                ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
            `}>
                <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} onMobileClose={() => setMobileOpen(false)} />
            </div>

            {/* Main content */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                {/* Top bar */}
                <header className="h-14 border-b border-border/50 bg-white/80 backdrop-blur-sm flex items-center justify-between px-4 lg:px-6 shrink-0 sticky top-0 z-20">
                    <div className="flex items-center gap-3">
                        {/* Mobile menu button */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-xl lg:hidden"
                            onClick={() => setMobileOpen(true)}
                        >
                            <Menu className="h-5 w-5" />
                        </Button>

                        {/* Page title */}
                        {pageTitle && (
                            <div className="hidden sm:flex items-center gap-2">
                                <h2 className="text-sm font-semibold text-foreground">{pageTitle}</h2>
                                {selectedBranchName && selectedBranchName !== "Semua Lokasi" && (
                                    <Badge variant="secondary" className="text-[10px] rounded-full px-2 py-0.5 bg-primary/5 text-primary border-primary/10 gap-1">
                                        <MapPin className="w-2.5 h-2.5" />
                                        {selectedBranchName}
                                    </Badge>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Search shortcut hint */}
                        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100 text-slate-400 cursor-default">
                            <Search className="w-3.5 h-3.5" />
                            <span className="text-xs">Cari...</span>
                            <kbd className="ml-2 text-[10px] font-mono bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-400">⌘K</kbd>
                        </div>

                        {/* Notification */}
                        {currentRole === "PLATFORM_OWNER" ? <PlatformNotificationBell /> : <NotificationBell />}

                        {/* User avatar (mobile) */}
                        <div className="flex items-center gap-2 lg:hidden">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-white text-xs font-bold">
                                {session?.user?.name?.charAt(0) || "U"}
                            </div>
                        </div>
                    </div>
                </header>

                <PlanExpiryBanner />

                <main className="flex-1 overflow-auto">
                    <div className="p-4 lg:p-6 max-w-[1600px]">{children}</div>
                </main>
            </div>

        </div>
        </PlanProvider>
    );
}

