"use client";

import { useState, useTransition, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { savePointConfig, saveReceiptConfig, savePosConfig, saveKitchenConfig, getPointConfig, getReceiptConfig, getPosConfig, getKitchenConfig } from "@/features/settings";
import { useMenuActionAccess } from "@/features/access-control";
import { useBranch } from "@/components/providers/branch-provider";
import { POINT_DEFAULTS, type PointConfig } from "@/lib/point-config";
import { RECEIPT_DEFAULTS, type ReceiptConfig } from "@/lib/receipt-config";
import type { PosConfig, KitchenConfig } from "@/server/actions/settings";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Save, Loader2, Star, Coins, ArrowRightLeft, TrendingUp, Award, Gift, FileText, Store, ShoppingCart, Shield, AlertTriangle, Users, Percent, Info, MapPin, Globe, Eye, ChefHat, Bell, RefreshCw, Utensils, LayoutGrid, Send } from "lucide-react";
import { toast } from "sonner";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";

const POS_DEFAULTS: PosConfig = {
    validateStock: true,
    allowNegativeStock: false,
    defaultTaxPercent: 11,
    requireCustomer: false,
    autoOpenCashDrawer: false,
    businessMode: "retail",
    showTableNumber: false,
    autoSendKitchen: false,
};

const KITCHEN_DEFAULTS: KitchenConfig = {
    enabled: false,
    autoAdvance: false,
    notificationSound: true,
};

const VALID_SETTINGS_TABS = ["pos", "store", "earn", "redeem", "levels"] as const;
type SettingsTab = (typeof VALID_SETTINGS_TABS)[number];

export function SettingsContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const tabParam = searchParams.get("tab");
    const activeTab: SettingsTab = VALID_SETTINGS_TABS.includes(tabParam as SettingsTab) ? (tabParam as SettingsTab) : "pos";

    const handleTabChange = useCallback((tab: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("tab", tab);
        router.replace(`?${params.toString()}`, { scroll: false });
    }, [searchParams, router]);

    const [pointCfg, setPointCfg] = useState<PointConfig>(POINT_DEFAULTS);
    const [receiptCfg, setReceiptCfg] = useState<ReceiptConfig>(RECEIPT_DEFAULTS);
    const [posCfg, setPosCfg] = useState<PosConfig>(POS_DEFAULTS);
    const [kitchenCfg, setKitchenCfg] = useState<KitchenConfig>(KITCHEN_DEFAULTS);
    const [isSaving, startTransition] = useTransition();
    const [hasChanges, setHasChanges] = useState(false);
    const { selectedBranchId, branchReady, selectedBranchName } = useBranch();
    const { canAction, cannotMessage } = useMenuActionAccess("settings");
    const canUpdate = canAction("update");

    // Load settings — only after initial hydration is stable
    const mountedRef = useRef(false);
    const prevBranchRef = useRef(selectedBranchId);
    useEffect(() => {
        if (!branchReady) return; // Wait for branch data
        if (!mountedRef.current) {
            // First mount — load settings once
            mountedRef.current = true;
            const bid = selectedBranchId || undefined;
            Promise.all([getPointConfig(bid), getReceiptConfig(bid), getPosConfig(bid), getKitchenConfig(bid)]).then(([p, r, pos, kitchen]) => {
                setPointCfg(p); setReceiptCfg(r); setPosCfg(pos); setKitchenCfg(kitchen); setHasChanges(false);
            });
            prevBranchRef.current = selectedBranchId;
            return;
        }
        // Subsequent branch changes only
        if (prevBranchRef.current === selectedBranchId) return;
        prevBranchRef.current = selectedBranchId;
        const bid = selectedBranchId || undefined;
        Promise.all([getPointConfig(bid), getReceiptConfig(bid), getPosConfig(bid), getKitchenConfig(bid)]).then(([p, r, pos, kitchen]) => {
            setPointCfg(p); setReceiptCfg(r); setPosCfg(pos); setKitchenCfg(kitchen); setHasChanges(false);
        });
    }, [selectedBranchId]); // eslint-disable-line react-hooks/exhaustive-deps

    const updatePoint = (key: keyof PointConfig, value: number | boolean) => {
        if (!canUpdate) return;
        setPointCfg((prev) => ({ ...prev, [key]: value }));
        setHasChanges(true);
    };

    const updateReceipt = (key: keyof ReceiptConfig, value: string | number | boolean) => {
        if (!canUpdate) return;
        setReceiptCfg((prev) => ({ ...prev, [key]: value }));
        setHasChanges(true);
    };

    const handleSave = () => {
        if (!canUpdate) { toast.error(cannotMessage("update")); return; }
        const bid = selectedBranchId || undefined;
        startTransition(async () => {
            await Promise.all([savePointConfig(pointCfg, bid), saveReceiptConfig(receiptCfg, bid), savePosConfig(posCfg, bid), saveKitchenConfig(kitchenCfg, bid)]);
            toast.success(`Pengaturan berhasil disimpan${selectedBranchId ? ` untuk ${selectedBranchName}` : " (global)"}`);
            setHasChanges(false);
        });
    };

    const previewTransaction = 100000;
    const basePoints = Math.floor(previewTransaction / pointCfg.earnRate);

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
                        <Settings className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold text-foreground tracking-tight">Pengaturan</h1>
                            {selectedBranchId ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
                                    <MapPin className="w-3 h-3" />
                                    Cabang: {selectedBranchName}
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-600 text-xs font-medium">
                                    <Globe className="w-3 h-3" />
                                    Global — berlaku untuk semua lokasi
                                </span>
                            )}
                        </div>
                        <p className="text-muted-foreground text-sm mt-1">Kelola konfigurasi sistem dan preferensi aplikasi</p>
                    </div>
                </div>
                <DisabledActionTooltip disabled={!canUpdate} message={cannotMessage("update")}>
                    <Button
                        onClick={handleSave}
                        disabled={!canUpdate || isSaving || !hasChanges}
                        className={`rounded-xl h-11 px-6 font-semibold transition-all duration-300 ${
                            hasChanges
                                ? "bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/25 text-white"
                                : "bg-muted text-muted-foreground"
                        } ${isSaving ? "animate-pulse" : ""}`}
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        {hasChanges ? "Simpan Perubahan" : "Tersimpan"}
                    </Button>
                </DisabledActionTooltip>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
                <TabsList className="rounded-2xl h-12 grid grid-cols-5 w-full bg-muted/50 p-1.5">
                    <TabsTrigger value="pos" className="rounded-xl h-full text-sm gap-2 font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all">
                        <ShoppingCart className="w-4 h-4" /> POS
                    </TabsTrigger>
                    <TabsTrigger value="store" className="rounded-xl h-full text-sm gap-2 font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all">
                        <Store className="w-4 h-4" /> Toko & Struk
                    </TabsTrigger>
                    <TabsTrigger value="earn" className="rounded-xl h-full text-sm gap-2 font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all">
                        <Coins className="w-4 h-4" /> Perolehan Poin
                    </TabsTrigger>
                    <TabsTrigger value="redeem" className="rounded-xl h-full text-sm gap-2 font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all">
                        <ArrowRightLeft className="w-4 h-4" /> Penukaran
                    </TabsTrigger>
                    <TabsTrigger value="levels" className="rounded-xl h-full text-sm gap-2 font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all">
                        <TrendingUp className="w-4 h-4" /> Level
                    </TabsTrigger>
                </TabsList>

                <div className={!canUpdate ? "pointer-events-none opacity-70" : ""}>
                {/* ====== POS Settings Tab ====== */}
                <TabsContent value="pos" className="space-y-5">
                    <div className="rounded-2xl bg-white border border-border/40 p-6 space-y-5 max-w-2xl shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20">
                                <ShoppingCart className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold">Pengaturan POS</h3>
                                <p className="text-sm text-muted-foreground mt-0.5">Konfigurasi perilaku kasir</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {/* Business Mode */}
                            <div className="rounded-xl border border-border/40 p-4 space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                                        <Utensils className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium">Mode Bisnis</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">Pilih jenis usaha untuk menyesuaikan fitur POS.</p>
                                    </div>
                                    <Select value={posCfg.businessMode} onValueChange={(v) => {
                                        const updates: Partial<PosConfig> = { businessMode: v };
                                        if (v === "restaurant" || v === "cafe") {
                                            updates.requireCustomer = true;
                                            updates.showTableNumber = true;
                                            updates.autoSendKitchen = true;
                                        }
                                        setPosCfg({ ...posCfg, ...updates });
                                        setHasChanges(true);
                                    }}>
                                        <SelectTrigger className="w-40 rounded-xl h-10">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="retail">Retail</SelectItem>
                                            <SelectItem value="restaurant">Restoran</SelectItem>
                                            <SelectItem value="cafe">Cafe</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Show Table Number — only for restaurant/cafe */}
                            {(posCfg.businessMode === "restaurant" || posCfg.businessMode === "cafe") && (
                                <div className={`flex items-center justify-between rounded-xl border p-4 transition-all duration-200 ${
                                    posCfg.showTableNumber
                                        ? "border-l-4 border-l-emerald-500 border-t-border/40 border-r-border/40 border-b-border/40 bg-emerald-50/30"
                                        : "border-l-4 border-l-gray-300 border-t-border/40 border-r-border/40 border-b-border/40"
                                }`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${posCfg.showTableNumber ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-400"}`}>
                                            <LayoutGrid className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">Tampilkan Nomor Meja</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">Menampilkan input nomor meja pada halaman POS.</p>
                                        </div>
                                    </div>
                                    <Switch checked={posCfg.showTableNumber} onCheckedChange={(v) => { setPosCfg({ ...posCfg, showTableNumber: v }); setHasChanges(true); }} />
                                </div>
                            )}

                            {/* Auto Send Kitchen — only for restaurant/cafe */}
                            {(posCfg.businessMode === "restaurant" || posCfg.businessMode === "cafe") && (
                                <div className={`flex items-center justify-between rounded-xl border p-4 transition-all duration-200 ${
                                    posCfg.autoSendKitchen
                                        ? "border-l-4 border-l-emerald-500 border-t-border/40 border-r-border/40 border-b-border/40 bg-emerald-50/30"
                                        : "border-l-4 border-l-gray-300 border-t-border/40 border-r-border/40 border-b-border/40"
                                }`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${posCfg.autoSendKitchen ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-400"}`}>
                                            <Send className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">Auto Kirim ke Kitchen</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">Otomatis kirim order ke kitchen display saat transaksi selesai.</p>
                                        </div>
                                    </div>
                                    <Switch checked={posCfg.autoSendKitchen} onCheckedChange={(v) => { setPosCfg({ ...posCfg, autoSendKitchen: v }); setHasChanges(true); }} />
                                </div>
                            )}

                            {/* Validate Stock */}
                            <div className={`flex items-center justify-between rounded-xl border p-4 transition-all duration-200 ${
                                posCfg.validateStock
                                    ? "border-l-4 border-l-emerald-500 border-t-border/40 border-r-border/40 border-b-border/40 bg-emerald-50/30"
                                    : "border-l-4 border-l-gray-300 border-t-border/40 border-r-border/40 border-b-border/40"
                            }`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${posCfg.validateStock ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-400"}`}>
                                        <Shield className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">Validasi Stok</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">Cek ketersediaan stok saat transaksi. Jika dimatikan, produk bisa dijual melebihi stok.</p>
                                    </div>
                                </div>
                                <Switch checked={posCfg.validateStock} onCheckedChange={(v) => { setPosCfg({ ...posCfg, validateStock: v }); setHasChanges(true); }} />
                            </div>

                            {/* Allow Negative Stock */}
                            <div className={`flex items-center justify-between rounded-xl border p-4 transition-all duration-200 ${
                                posCfg.allowNegativeStock
                                    ? "border-l-4 border-l-emerald-500 border-t-border/40 border-r-border/40 border-b-border/40 bg-emerald-50/30"
                                    : "border-l-4 border-l-gray-300 border-t-border/40 border-r-border/40 border-b-border/40"
                            }`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${posCfg.allowNegativeStock ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-400"}`}>
                                        <AlertTriangle className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">Izinkan Stok Negatif</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">Stok bisa menjadi minus jika validasi stok aktif tapi tetap ingin transaksi berjalan.</p>
                                    </div>
                                </div>
                                <Switch checked={posCfg.allowNegativeStock} onCheckedChange={(v) => { setPosCfg({ ...posCfg, allowNegativeStock: v }); setHasChanges(true); }} />
                            </div>

                            {/* Require Customer */}
                            <div className={`flex items-center justify-between rounded-xl border p-4 transition-all duration-200 ${
                                posCfg.requireCustomer
                                    ? "border-l-4 border-l-emerald-500 border-t-border/40 border-r-border/40 border-b-border/40 bg-emerald-50/30"
                                    : "border-l-4 border-l-gray-300 border-t-border/40 border-r-border/40 border-b-border/40"
                            }`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${posCfg.requireCustomer ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-400"}`}>
                                        <Users className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">Wajib Input Customer</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">Kasir harus memilih customer sebelum proses pembayaran.</p>
                                    </div>
                                </div>
                                <Switch checked={posCfg.requireCustomer} onCheckedChange={(v) => { setPosCfg({ ...posCfg, requireCustomer: v }); setHasChanges(true); }} />
                            </div>

                            {/* Tax */}
                            <div className="rounded-xl border border-border/40 p-5 bg-gradient-to-r from-amber-50/50 to-orange-50/30 space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                                        <Percent className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">Pajak Default</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">Persentase pajak yang otomatis diterapkan di POS.</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Input type="number" min={0} max={100} value={posCfg.defaultTaxPercent} onChange={(e) => { setPosCfg({ ...posCfg, defaultTaxPercent: Number(e.target.value) }); setHasChanges(true); }} className="w-28 rounded-xl h-10 text-center font-semibold text-lg bg-white" />
                                    <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Kitchen Display Section */}
                    <div className="rounded-2xl bg-white border border-border/40 p-6 space-y-5 max-w-2xl shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-md shadow-orange-500/20">
                                <ChefHat className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold">Kitchen Display</h3>
                                <p className="text-sm text-muted-foreground mt-0.5">Konfigurasi integrasi kitchen display system</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {/* Kitchen Enabled */}
                            <div className={`flex items-center justify-between rounded-xl border p-4 transition-all duration-200 ${
                                kitchenCfg.enabled
                                    ? "border-l-4 border-l-emerald-500 border-t-border/40 border-r-border/40 border-b-border/40 bg-emerald-50/30"
                                    : "border-l-4 border-l-gray-300 border-t-border/40 border-r-border/40 border-b-border/40"
                            }`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${kitchenCfg.enabled ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-400"}`}>
                                        <ChefHat className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">Kirim order ke Kitchen Display</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">Otomatis kirim order baru ke layar dapur saat transaksi selesai.</p>
                                    </div>
                                </div>
                                <Switch checked={kitchenCfg.enabled} onCheckedChange={(v) => { setKitchenCfg({ ...kitchenCfg, enabled: v }); setHasChanges(true); }} />
                            </div>

                            {/* Auto Advance */}
                            <div className={`flex items-center justify-between rounded-xl border p-4 transition-all duration-200 ${
                                kitchenCfg.autoAdvance
                                    ? "border-l-4 border-l-emerald-500 border-t-border/40 border-r-border/40 border-b-border/40 bg-emerald-50/30"
                                    : "border-l-4 border-l-gray-300 border-t-border/40 border-r-border/40 border-b-border/40"
                            }`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${kitchenCfg.autoAdvance ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-400"}`}>
                                        <RefreshCw className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">Auto-advance status</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">Otomatis ubah status order saat semua item selesai diproses.</p>
                                    </div>
                                </div>
                                <Switch checked={kitchenCfg.autoAdvance} onCheckedChange={(v) => { setKitchenCfg({ ...kitchenCfg, autoAdvance: v }); setHasChanges(true); }} />
                            </div>

                            {/* Notification Sound */}
                            <div className={`flex items-center justify-between rounded-xl border p-4 transition-all duration-200 ${
                                kitchenCfg.notificationSound
                                    ? "border-l-4 border-l-emerald-500 border-t-border/40 border-r-border/40 border-b-border/40 bg-emerald-50/30"
                                    : "border-l-4 border-l-gray-300 border-t-border/40 border-r-border/40 border-b-border/40"
                            }`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${kitchenCfg.notificationSound ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-400"}`}>
                                        <Bell className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">Suara notifikasi order baru</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">Putar suara notifikasi saat ada order baru masuk ke kitchen display.</p>
                                    </div>
                                </div>
                                <Switch checked={kitchenCfg.notificationSound} onCheckedChange={(v) => { setKitchenCfg({ ...kitchenCfg, notificationSound: v }); setHasChanges(true); }} />
                            </div>
                        </div>
                    </div>
                </TabsContent>

                {/* ====== Tab Toko & Struk ====== */}
                <TabsContent value="store" className="space-y-5">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        {/* Store Info */}
                        <div className="bg-white rounded-2xl border border-border/40 p-5 space-y-4 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
                                    <Store className="w-4.5 h-4.5 text-white" />
                                </div>
                                <div>
                                    <p className="font-semibold text-sm">Informasi Toko</p>
                                    <p className="text-xs text-muted-foreground">Ditampilkan pada header struk</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="space-y-1.5">
                                    <Label className="text-sm">Nama Toko</Label>
                                    <Input value={receiptCfg.storeName} onChange={(e) => updateReceipt("storeName", e.target.value)} className="rounded-xl" placeholder="Nama toko Anda" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-sm">Alamat</Label>
                                    <Input value={receiptCfg.storeAddress} onChange={(e) => updateReceipt("storeAddress", e.target.value)} className="rounded-xl" placeholder="Alamat lengkap toko" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-sm">Telepon</Label>
                                    <Input value={receiptCfg.storePhone} onChange={(e) => updateReceipt("storePhone", e.target.value)} className="rounded-xl" placeholder="021-1234567" />
                                </div>
                            </div>
                        </div>

                        {/* Receipt Content */}
                        <div className="bg-white rounded-2xl border border-border/40 p-5 space-y-4 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-md shadow-emerald-500/20">
                                    <FileText className="w-4.5 h-4.5 text-white" />
                                </div>
                                <div>
                                    <p className="font-semibold text-sm">Konten Struk</p>
                                    <p className="text-xs text-muted-foreground">Teks tambahan pada struk</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="space-y-1.5">
                                    <Label className="text-sm">Header Struk</Label>
                                    <textarea value={receiptCfg.headerText} onChange={(e) => updateReceipt("headerText", e.target.value)}
                                        className="flex w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" rows={2}
                                        placeholder="Teks di bawah nama toko (opsional)" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-sm">Footer Struk</Label>
                                    <textarea value={receiptCfg.footerText} onChange={(e) => updateReceipt("footerText", e.target.value)}
                                        className="flex w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" rows={3}
                                        placeholder="Teks di bagian bawah struk" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-sm">Pesan Terima Kasih</Label>
                                    <Input value={receiptCfg.thankYouMessage} onChange={(e) => updateReceipt("thankYouMessage", e.target.value)} className="rounded-xl" placeholder="Terima kasih, selamat berbelanja kembali!" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-sm">Lebar Kertas</Label>
                                    <div className="flex gap-2">
                                        {[58, 80].map((w) => (
                                            <button key={w} type="button" onClick={() => updateReceipt("paperWidth", w)}
                                                className={`flex-1 rounded-full border py-2.5 text-sm font-semibold transition-all duration-200
                          ${receiptCfg.paperWidth === w ? "border-primary bg-primary text-white shadow-md shadow-primary/25" : "border-border/50 text-muted-foreground hover:border-border hover:bg-muted/30"}`}>
                                                {w}mm
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-0 divide-y divide-border/40">
                                    {([
                                        { key: "showCashierName" as const, label: "Nama Kasir", desc: "Tampilkan nama kasir yang melayani" },
                                        { key: "showDateTime" as const, label: "Tanggal & Waktu", desc: "Tampilkan tanggal dan jam transaksi" },
                                        { key: "showPaymentMethod" as const, label: "Metode Pembayaran", desc: "Tampilkan cara pembayaran (Cash, QRIS, dll)" },
                                        { key: "showPointInfo" as const, label: "Info Poin", desc: "Tampilkan poin yang didapat & promo" },
                                    ]).map((item) => (
                                        <div key={item.key} className="flex items-center justify-between py-3">
                                            <div>
                                                <p className="text-sm font-medium">{item.label}</p>
                                                <p className="text-xs text-muted-foreground">{item.desc}</p>
                                            </div>
                                            <Switch checked={receiptCfg[item.key] as boolean} onCheckedChange={(v) => updateReceipt(item.key, v)} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Preview */}
                        <div className="bg-white rounded-2xl border border-border/40 p-5 shadow-sm">
                            <p className="font-semibold text-sm mb-4 flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center">
                                    <Eye className="w-3.5 h-3.5 text-white" />
                                </div>
                                Preview Struk
                            </p>
                            <div className="mx-auto bg-[#f5f0e8] rounded-xl p-6 max-w-xs font-mono text-xs leading-relaxed shadow-[0_8px_30px_rgba(0,0,0,0.12)] rotate-[0.5deg] border border-[#e8e0d0]">
                                <div className="text-center space-y-0.5">
                                    <p className="font-bold text-sm text-gray-800">{receiptCfg.storeName || "NAMA TOKO"}</p>
                                    {receiptCfg.storeAddress && <p className="text-[10px] text-gray-600">{receiptCfg.storeAddress}</p>}
                                    {receiptCfg.storePhone && <p className="text-[10px] text-gray-600">{receiptCfg.storePhone}</p>}
                                    {receiptCfg.headerText && <p className="text-[10px] italic mt-1 text-gray-500">{receiptCfg.headerText}</p>}
                                </div>
                                <div className="border-t border-dashed border-gray-400/60 my-2" />
                                <div className="flex justify-between text-gray-700"><span>No:</span><span>INV-250326-0001</span></div>
                                {receiptCfg.showDateTime && <div className="flex justify-between text-gray-700"><span>26 Mar 2025 14:30</span>{receiptCfg.showCashierName && <span>Kasir 1</span>}</div>}
                                <div className="border-t border-dashed border-gray-400/60 my-2" />
                                <div className="text-gray-700"><p>Indomie Goreng</p><div className="flex justify-between pl-3"><span>2 x 3.500</span><span>7.000</span></div></div>
                                <div className="text-gray-700"><p>Aqua 600ml</p><div className="flex justify-between pl-3"><span>1 x 3.000</span><span>3.000</span></div></div>
                                <div className="border-t border-dashed border-gray-400/60 my-2" />
                                <div className="flex justify-between text-gray-700"><span>Subtotal</span><span>10.000</span></div>
                                <div className="flex justify-between text-gray-700"><span>Pajak</span><span>1.100</span></div>
                                <div className="border-t border-gray-400/60 my-1" />
                                <div className="flex justify-between font-bold text-sm text-gray-900"><span>TOTAL</span><span>11.100</span></div>
                                <div className="border-t border-gray-400/60 my-1" />
                                {receiptCfg.showPaymentMethod && <div className="flex justify-between text-gray-700"><span>Cash</span><span>15.000</span></div>}
                                {receiptCfg.showPaymentMethod && <div className="flex justify-between text-gray-700"><span>Kembali</span><span>3.900</span></div>}
                                {receiptCfg.showPointInfo && (
                                    <>
                                        <div className="border-t border-dashed border-gray-400/60 my-2" />
                                        <p className="text-center text-[10px] italic text-gray-500">Poin: +1 poin</p>
                                    </>
                                )}
                                <div className="border-t border-dashed border-gray-400/60 my-2" />
                                {receiptCfg.footerText && <p className="text-center text-[10px] whitespace-pre-line text-gray-500">{receiptCfg.footerText}</p>}
                                {receiptCfg.thankYouMessage && <p className="text-center text-[10px] font-semibold mt-1 text-gray-700">{receiptCfg.thankYouMessage}</p>}
                            </div>
                        </div>
                    </div>
                </TabsContent>

                {/* ====== Tab Perolehan Poin ====== */}
                <TabsContent value="earn" className="space-y-5">
                    {/* Master Toggle */}
                    <div className={`bg-white rounded-2xl border border-border/40 p-6 flex items-center justify-between shadow-sm transition-all duration-300 ${
                        pointCfg.pointsEnabled ? "ring-2 ring-primary/20" : ""
                    }`}>
                        <div className="flex items-center gap-4">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                                pointCfg.pointsEnabled
                                    ? "bg-gradient-to-br from-primary to-primary/70 shadow-lg shadow-primary/30"
                                    : "bg-muted"
                            }`}>
                                <Star className={`w-7 h-7 transition-colors ${pointCfg.pointsEnabled ? "text-white" : "text-muted-foreground"}`} />
                            </div>
                            <div>
                                <p className="font-bold text-lg">Sistem Loyalty Point</p>
                                <p className="text-sm text-muted-foreground">
                                    {pointCfg.pointsEnabled ? (
                                        <span className="inline-flex items-center gap-1.5 text-emerald-600 font-medium">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Aktif
                                        </span>
                                    ) : "Nonaktif — aktifkan untuk menggunakan loyalty"}
                                </p>
                            </div>
                        </div>
                        <Switch checked={pointCfg.pointsEnabled} onCheckedChange={(v) => updatePoint("pointsEnabled", v)} />
                    </div>

                    {/* Earn Config */}
                    <div className="bg-white rounded-2xl border border-border/40 p-6 space-y-6 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-md shadow-amber-500/20">
                                <Gift className="w-4.5 h-4.5 text-white" />
                            </div>
                            <p className="font-semibold">Konfigurasi Perolehan</p>
                        </div>

                        {/* Earn Rate */}
                        <div className="bg-gradient-to-r from-blue-50/80 to-indigo-50/50 rounded-xl p-5 border border-blue-100/50">
                            <Label className="text-sm font-semibold text-blue-900">Rupiah per 1 Poin</Label>
                            <div className="flex items-center gap-3 mt-3">
                                <span className="text-sm font-medium text-blue-700 bg-blue-100/80 px-3 py-1.5 rounded-lg">Setiap</span>
                                <Input type="number" value={pointCfg.earnRate} onChange={(e) => updatePoint("earnRate", Number(e.target.value))} className="rounded-xl w-36 h-11 text-center text-lg font-bold bg-white border-blue-200 focus-visible:ring-blue-400" min={1000} step={1000} />
                                <div className="flex items-center gap-2">
                                    <span className="text-blue-400 text-lg">=</span>
                                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-bold text-sm">
                                        <Star className="w-3.5 h-3.5" /> 1 poin
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Multiplier per Level */}
                        <div className="space-y-3">
                            <Label className="text-sm font-semibold">Multiplier per Level</Label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {([
                                    { key: "multiplierRegular" as const, label: "Regular", color: "from-slate-100 to-slate-50 border-slate-200", badge: "bg-slate-200 text-slate-700" },
                                    { key: "multiplierSilver" as const, label: "Silver", color: "from-gray-100 to-gray-50 border-gray-200", badge: "bg-gray-200 text-gray-700" },
                                    { key: "multiplierGold" as const, label: "Gold", color: "from-amber-100 to-yellow-50 border-amber-200", badge: "bg-amber-200 text-amber-800" },
                                    { key: "multiplierPlatinum" as const, label: "Platinum", color: "from-purple-100 to-violet-50 border-purple-200", badge: "bg-purple-200 text-purple-800" },
                                ]).map((item) => (
                                    <div key={item.key} className={`rounded-xl border p-4 space-y-3 bg-gradient-to-b ${item.color}`}>
                                        <p className={`text-xs font-bold text-center px-2 py-1 rounded-full mx-auto w-fit ${item.badge}`}>{item.label}</p>
                                        <div className="flex items-center justify-center gap-1.5">
                                            <Input type="number" value={pointCfg[item.key]} onChange={(e) => updatePoint(item.key, Number(e.target.value))} className="rounded-xl w-20 h-10 text-center text-base font-bold bg-white shadow-sm" min={0.5} step={0.5} />
                                            <span className="text-sm font-semibold text-muted-foreground">x</span>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-bold text-foreground">{Math.floor(basePoints * (pointCfg[item.key] as number))} poin</p>
                                            <p className="text-[10px] text-muted-foreground">per {formatCurrency(previewTransaction)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Simulation Preview */}
                        <div className="bg-gradient-to-r from-muted/40 to-muted/20 rounded-xl p-4 border border-border/30">
                            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                                <Info className="w-3.5 h-3.5" /> Simulasi: Transaksi {formatCurrency(previewTransaction)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Member Regular mendapat <strong className="text-foreground">{Math.floor(basePoints * pointCfg.multiplierRegular)}</strong> poin,
                                Platinum mendapat <strong className="text-foreground">{Math.floor(basePoints * pointCfg.multiplierPlatinum)}</strong> poin
                            </p>
                        </div>
                    </div>
                </TabsContent>

                {/* ====== Tab Penukaran ====== */}
                <TabsContent value="redeem" className="space-y-5">
                    <div className="bg-white rounded-2xl border border-border/40 p-6 space-y-6 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center shadow-md shadow-rose-500/20">
                                <Award className="w-4.5 h-4.5 text-white" />
                            </div>
                            <p className="font-semibold">Konfigurasi Penukaran Poin</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gradient-to-br from-emerald-50/80 to-teal-50/50 rounded-xl p-4 border border-emerald-100/50 space-y-2">
                                <Label className="text-sm font-semibold text-emerald-900">Nilai 1 Poin</Label>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-emerald-600 bg-emerald-100/80 px-2.5 py-1 rounded-lg">Rp</span>
                                    <Input type="number" value={pointCfg.redeemValue} onChange={(e) => updatePoint("redeemValue", Number(e.target.value))} className="rounded-xl bg-white font-semibold" min={100} step={100} />
                                </div>
                            </div>
                            <div className="bg-gradient-to-br from-violet-50/80 to-purple-50/50 rounded-xl p-4 border border-violet-100/50 space-y-2">
                                <Label className="text-sm font-semibold text-violet-900">Minimum Redeem</Label>
                                <div className="flex items-center gap-2">
                                    <Input type="number" value={pointCfg.redeemMin} onChange={(e) => updatePoint("redeemMin", Number(e.target.value))} className="rounded-xl bg-white font-semibold" min={1} />
                                    <span className="text-sm font-bold text-violet-600 bg-violet-100/80 px-2.5 py-1 rounded-lg">poin</span>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl p-5 bg-gradient-to-br from-muted/30 to-muted/10 border border-border/30">
                            <p className="text-xs font-semibold text-muted-foreground mb-4 flex items-center gap-1.5">
                                <ArrowRightLeft className="w-3.5 h-3.5" /> Simulasi Penukaran
                            </p>
                            <div className="grid grid-cols-3 gap-4">
                                {[10, 50, 100].map((pts, i) => (
                                    <div key={pts} className={`rounded-xl p-4 text-center border shadow-sm transition-transform hover:scale-105 ${
                                        i === 0 ? "bg-gradient-to-br from-blue-50 to-sky-50 border-blue-100" :
                                        i === 1 ? "bg-gradient-to-br from-purple-50 to-violet-50 border-purple-100" :
                                        "bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100"
                                    }`}>
                                        <p className="text-2xl font-black text-primary">{pts}</p>
                                        <p className="text-[11px] text-muted-foreground font-medium">poin</p>
                                        <div className="my-2 h-px bg-border/50" />
                                        <p className="text-sm font-bold text-foreground">{formatCurrency(pts * pointCfg.redeemValue)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </TabsContent>

                {/* ====== Tab Level ====== */}
                <TabsContent value="levels" className="space-y-5">
                    <div className="bg-white rounded-2xl border border-border/40 p-6 space-y-6 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-md shadow-teal-500/20">
                                <TrendingUp className="w-4.5 h-4.5 text-white" />
                            </div>
                            <div>
                                <p className="font-semibold">Level Membership</p>
                                <p className="text-xs text-muted-foreground">Level naik otomatis saat total belanja mencapai threshold</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {([
                                { key: "levelSilver" as const, label: "Silver", icon: "🥈", desc: "Member setia", borderColor: "border-l-gray-400", gradientBg: "from-gray-50/80 to-slate-50/50" },
                                { key: "levelGold" as const, label: "Gold", icon: "🥇", desc: "Member premium", borderColor: "border-l-amber-400", gradientBg: "from-amber-50/80 to-yellow-50/50" },
                                { key: "levelPlatinum" as const, label: "Platinum", icon: "💎", desc: "Member VIP", borderColor: "border-l-purple-500", gradientBg: "from-purple-50/80 to-violet-50/50" },
                            ]).map((item) => (
                                <div key={item.key} className={`flex items-center gap-4 rounded-xl border border-l-4 ${item.borderColor} border-t-border/40 border-r-border/40 border-b-border/40 p-5 bg-gradient-to-r ${item.gradientBg} transition-all hover:shadow-md`}>
                                    <span className="text-4xl">{item.icon}</span>
                                    <div className="flex-1">
                                        <p className="text-sm font-bold">{item.label}</p>
                                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                                    </div>
                                    <div className="text-right space-y-1.5">
                                        <Label className="text-[11px] text-muted-foreground">Min. Total Belanja</Label>
                                        <Input type="number" value={pointCfg[item.key]} onChange={(e) => updatePoint(item.key, Number(e.target.value))} className="rounded-xl w-44 text-right font-semibold bg-white" min={0} step={100000} />
                                        <p className="text-xs font-medium text-primary">{formatCurrency(pointCfg[item.key] as number)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Level Flow Visualization */}
                        <div className="bg-gradient-to-r from-muted/30 to-muted/10 rounded-xl p-5 border border-border/30">
                            <p className="text-xs font-semibold text-muted-foreground mb-5">Alur Level</p>
                            <div className="flex items-center justify-between relative">
                                {/* Gradient connecting line */}
                                <div className="absolute top-1/2 left-[10%] right-[10%] h-1 bg-gradient-to-r from-slate-300 via-amber-300 to-purple-400 rounded-full -translate-y-1/2 z-0" />

                                {([
                                    { label: "Regular", emoji: "👤", value: "Rp 0", gradient: "from-slate-200 to-slate-300 border-slate-300" },
                                    { label: "Silver", emoji: "🥈", value: formatCurrency(pointCfg.levelSilver), gradient: "from-gray-200 to-gray-300 border-gray-300" },
                                    { label: "Gold", emoji: "🥇", value: formatCurrency(pointCfg.levelGold), gradient: "from-amber-200 to-yellow-300 border-amber-300" },
                                    { label: "Platinum", emoji: "💎", value: formatCurrency(pointCfg.levelPlatinum), gradient: "from-purple-200 to-violet-300 border-purple-300" },
                                ]).map((level) => (
                                    <div key={level.label} className="flex flex-col items-center relative z-10">
                                        <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${level.gradient} border-2 flex items-center justify-center shadow-md`}>
                                            <span className="text-xl">{level.emoji}</span>
                                        </div>
                                        <p className="text-sm font-semibold mt-2">{level.label}</p>
                                        <p className="text-[10px] text-muted-foreground">{level.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}
