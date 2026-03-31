"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { savePointConfig, saveReceiptConfig, savePosConfig, getPointConfig, getReceiptConfig, getPosConfig } from "@/features/settings";
import { useBranch } from "@/components/providers/branch-provider";
import type { PointConfig } from "@/lib/point-config";
import type { ReceiptConfig } from "@/lib/receipt-config";
import type { PosConfig } from "@/server/actions/settings";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Save, Loader2, Star, Coins, ArrowRightLeft, TrendingUp, Award, Gift, FileText, Store, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

interface Props {
    pointConfig: PointConfig;
    receiptConfig: ReceiptConfig;
    posConfig: PosConfig;
}

export function SettingsContent({ pointConfig: initialPoint, receiptConfig: initialReceipt, posConfig: initialPos }: Props) {
    const [pointCfg, setPointCfg] = useState<PointConfig>(initialPoint);
    const [receiptCfg, setReceiptCfg] = useState<ReceiptConfig>(initialReceipt);
    const [posCfg, setPosCfg] = useState<PosConfig>(initialPos);
    const [isSaving, startTransition] = useTransition();
    const [hasChanges, setHasChanges] = useState(false);
    const { selectedBranchId, selectedBranchName } = useBranch();

    // Reload settings when branch changes
    const prevBranchRef = useRef(selectedBranchId);
    useEffect(() => {
        if (prevBranchRef.current !== selectedBranchId || selectedBranchId) {
            prevBranchRef.current = selectedBranchId;
            const bid = selectedBranchId || undefined;
            Promise.all([getPointConfig(bid), getReceiptConfig(bid), getPosConfig(bid)]).then(([p, r, pos]) => {
                setPointCfg(p); setReceiptCfg(r); setPosCfg(pos); setHasChanges(false);
            });
        }
    }, [selectedBranchId]);

    const updatePoint = (key: keyof PointConfig, value: number | boolean) => {
        setPointCfg((prev) => ({ ...prev, [key]: value }));
        setHasChanges(true);
    };

    const updateReceipt = (key: keyof ReceiptConfig, value: string | number | boolean) => {
        setReceiptCfg((prev) => ({ ...prev, [key]: value }));
        setHasChanges(true);
    };

    const handleSave = () => {
        const bid = selectedBranchId || undefined;
        startTransition(async () => {
            await Promise.all([savePointConfig(pointCfg, bid), saveReceiptConfig(receiptCfg, bid), savePosConfig(posCfg, bid)]);
            toast.success(`Pengaturan berhasil disimpan${selectedBranchId ? ` untuk ${selectedBranchName}` : " (global)"}`);
            setHasChanges(false);
        });
    };

    const previewTransaction = 100000;
    const basePoints = Math.floor(previewTransaction / pointCfg.earnRate);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <Settings className="w-6 h-6 text-primary" /> Pengaturan
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        {selectedBranchId
                            ? <>Pengaturan untuk <strong>{selectedBranchName}</strong> — berbeda dari global</>
                            : "Pengaturan global (berlaku untuk semua lokasi)"}
                    </p>
                </div>
                <Button className="rounded-lg" onClick={handleSave} disabled={isSaving || !hasChanges}>
                    {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    {hasChanges ? "Simpan Perubahan" : "Tersimpan"}
                </Button>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="pos" className="space-y-5">
                <TabsList className="rounded-xl h-10 grid grid-cols-5 w-full max-w-3xl">
                    <TabsTrigger value="pos" className="rounded-lg text-xs gap-1.5"><ShoppingCart className="w-3.5 h-3.5" /> POS</TabsTrigger>
                    <TabsTrigger value="store" className="rounded-lg text-xs gap-1.5"><Store className="w-3.5 h-3.5" /> Toko & Struk</TabsTrigger>
                    <TabsTrigger value="earn" className="rounded-lg text-xs gap-1.5"><Coins className="w-3.5 h-3.5" /> Perolehan Poin</TabsTrigger>
                    <TabsTrigger value="redeem" className="rounded-lg text-xs gap-1.5"><ArrowRightLeft className="w-3.5 h-3.5" /> Penukaran</TabsTrigger>
                    <TabsTrigger value="levels" className="rounded-lg text-xs gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Level</TabsTrigger>
                </TabsList>

                {/* ====== Tab Toko & Struk ====== */}
                {/* POS Settings */}
                <TabsContent value="pos" className="space-y-5">
                    <div className="rounded-2xl bg-white border border-border/40 p-6 space-y-5 max-w-2xl">
                        <div>
                            <h3 className="text-base font-semibold">Pengaturan POS</h3>
                            <p className="text-sm text-muted-foreground mt-0.5">Konfigurasi perilaku kasir</p>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between rounded-xl border border-border/40 p-4">
                                <div>
                                    <p className="text-sm font-medium">Validasi Stok</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">Cek ketersediaan stok saat transaksi. Jika dimatikan, produk bisa dijual melebihi stok.</p>
                                </div>
                                <Switch checked={posCfg.validateStock} onCheckedChange={(v) => { setPosCfg({ ...posCfg, validateStock: v }); setHasChanges(true); }} />
                            </div>

                            <div className="flex items-center justify-between rounded-xl border border-border/40 p-4">
                                <div>
                                    <p className="text-sm font-medium">Izinkan Stok Negatif</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">Stok bisa menjadi minus jika validasi stok aktif tapi tetap ingin transaksi berjalan.</p>
                                </div>
                                <Switch checked={posCfg.allowNegativeStock} onCheckedChange={(v) => { setPosCfg({ ...posCfg, allowNegativeStock: v }); setHasChanges(true); }} />
                            </div>

                            <div className="flex items-center justify-between rounded-xl border border-border/40 p-4">
                                <div>
                                    <p className="text-sm font-medium">Wajib Input Customer</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">Kasir harus memilih customer sebelum proses pembayaran.</p>
                                </div>
                                <Switch checked={posCfg.requireCustomer} onCheckedChange={(v) => { setPosCfg({ ...posCfg, requireCustomer: v }); setHasChanges(true); }} />
                            </div>

                            <div className="rounded-xl border border-border/40 p-4 space-y-2">
                                <div>
                                    <p className="text-sm font-medium">Pajak Default (%)</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">Persentase pajak yang otomatis diterapkan di POS.</p>
                                </div>
                                <Input type="number" min={0} max={100} value={posCfg.defaultTaxPercent} onChange={(e) => { setPosCfg({ ...posCfg, defaultTaxPercent: Number(e.target.value) }); setHasChanges(true); }} className="w-32 rounded-lg" />
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="store" className="space-y-5">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        {/* Store Info */}
                        <div className="bg-white rounded-2xl border border-border/40 p-5 space-y-4">
                            <div className="flex items-center gap-3">
                                <Store className="w-5 h-5 text-primary" />
                                <div>
                                    <p className="font-semibold text-sm">Informasi Toko</p>
                                    <p className="text-xs text-muted-foreground">Ditampilkan pada header struk</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="space-y-1.5">
                                    <Label className="text-sm">Nama Toko</Label>
                                    <Input value={receiptCfg.storeName} onChange={(e) => updateReceipt("storeName", e.target.value)} className="rounded-lg" placeholder="Nama toko Anda" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-sm">Alamat</Label>
                                    <Input value={receiptCfg.storeAddress} onChange={(e) => updateReceipt("storeAddress", e.target.value)} className="rounded-lg" placeholder="Alamat lengkap toko" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-sm">Telepon</Label>
                                    <Input value={receiptCfg.storePhone} onChange={(e) => updateReceipt("storePhone", e.target.value)} className="rounded-lg" placeholder="021-1234567" />
                                </div>
                            </div>
                        </div>

                        {/* Receipt Content */}
                        <div className="bg-white rounded-2xl border border-border/40 p-5 space-y-4">
                            <div className="flex items-center gap-3">
                                <FileText className="w-5 h-5 text-primary" />
                                <div>
                                    <p className="font-semibold text-sm">Konten Struk</p>
                                    <p className="text-xs text-muted-foreground">Teks tambahan pada struk</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="space-y-1.5">
                                    <Label className="text-sm">Header Struk</Label>
                                    <textarea value={receiptCfg.headerText} onChange={(e) => updateReceipt("headerText", e.target.value)}
                                        className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" rows={2}
                                        placeholder="Teks di bawah nama toko (opsional)" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-sm">Footer Struk</Label>
                                    <textarea value={receiptCfg.footerText} onChange={(e) => updateReceipt("footerText", e.target.value)}
                                        className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" rows={3}
                                        placeholder="Teks di bagian bawah struk" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-sm">Pesan Terima Kasih</Label>
                                    <Input value={receiptCfg.thankYouMessage} onChange={(e) => updateReceipt("thankYouMessage", e.target.value)} className="rounded-lg" placeholder="Terima kasih, selamat berbelanja kembali!" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-sm">Lebar Kertas</Label>
                                    <div className="flex gap-2">
                                        {[58, 80].map((w) => (
                                            <button key={w} type="button" onClick={() => updateReceipt("paperWidth", w)}
                                                className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-all
                          ${receiptCfg.paperWidth === w ? "border-primary bg-primary/5 text-primary" : "border-border/50 text-muted-foreground hover:border-border"}`}>
                                                {w}mm
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    {([
                                        { key: "showCashierName" as const, label: "Nama Kasir", desc: "Tampilkan nama kasir yang melayani" },
                                        { key: "showDateTime" as const, label: "Tanggal & Waktu", desc: "Tampilkan tanggal dan jam transaksi" },
                                        { key: "showPaymentMethod" as const, label: "Metode Pembayaran", desc: "Tampilkan cara pembayaran (Cash, QRIS, dll)" },
                                        { key: "showPointInfo" as const, label: "Info Poin", desc: "Tampilkan poin yang didapat & promo" },
                                    ]).map((item) => (
                                        <div key={item.key} className="flex items-center justify-between py-1">
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
                        <div className="bg-white rounded-2xl border border-border/40 p-5">
                            <p className="font-semibold text-sm mb-4 flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Preview Struk</p>
                            <div className="mx-auto bg-slate-50 rounded-xl p-6 max-w-xs font-mono text-xs leading-relaxed border border-border/30">
                                <div className="text-center space-y-0.5">
                                    <p className="font-bold text-sm">{receiptCfg.storeName || "NAMA TOKO"}</p>
                                    {receiptCfg.storeAddress && <p className="text-[10px]">{receiptCfg.storeAddress}</p>}
                                    {receiptCfg.storePhone && <p className="text-[10px]">{receiptCfg.storePhone}</p>}
                                    {receiptCfg.headerText && <p className="text-[10px] italic mt-1">{receiptCfg.headerText}</p>}
                                </div>
                                <div className="border-t border-dashed border-border my-2" />
                                <div className="flex justify-between"><span>No:</span><span>INV-250326-0001</span></div>
                                {receiptCfg.showDateTime && <div className="flex justify-between"><span>26 Mar 2025 14:30</span>{receiptCfg.showCashierName && <span>Kasir 1</span>}</div>}
                                <div className="border-t border-dashed border-border my-2" />
                                <div><p>Indomie Goreng</p><div className="flex justify-between pl-3"><span>2 x 3.500</span><span>7.000</span></div></div>
                                <div><p>Aqua 600ml</p><div className="flex justify-between pl-3"><span>1 x 3.000</span><span>3.000</span></div></div>
                                <div className="border-t border-dashed border-border my-2" />
                                <div className="flex justify-between"><span>Subtotal</span><span>10.000</span></div>
                                <div className="flex justify-between"><span>Pajak</span><span>1.100</span></div>
                                <div className="border-t border-border my-1" />
                                <div className="flex justify-between font-bold text-sm"><span>TOTAL</span><span>11.100</span></div>
                                <div className="border-t border-border my-1" />
                                {receiptCfg.showPaymentMethod && <div className="flex justify-between"><span>Cash</span><span>15.000</span></div>}
                                {receiptCfg.showPaymentMethod && <div className="flex justify-between"><span>Kembali</span><span>3.900</span></div>}
                                {receiptCfg.showPointInfo && (
                                    <>
                                        <div className="border-t border-dashed border-border my-2" />
                                        <p className="text-center text-[10px] italic">Poin: +1 poin</p>
                                    </>
                                )}
                                <div className="border-t border-dashed border-border my-2" />
                                {receiptCfg.footerText && <p className="text-center text-[10px] whitespace-pre-line">{receiptCfg.footerText}</p>}
                                {receiptCfg.thankYouMessage && <p className="text-center text-[10px] font-semibold mt-1">{receiptCfg.thankYouMessage}</p>}
                            </div>
                        </div>
                    </div>


                </TabsContent>

                {/* ====== Tab Perolehan Poin ====== */}
                <TabsContent value="earn" className="space-y-5">
                    {/* Master Toggle */}
                    <div className="bg-white rounded-2xl border border-border/40 p-5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${pointCfg.pointsEnabled ? "bg-primary/10" : "bg-muted"}`}>
                                <Star className={`w-6 h-6 ${pointCfg.pointsEnabled ? "text-primary" : "text-muted-foreground"}`} />
                            </div>
                            <div>
                                <p className="font-semibold">Sistem Loyalty Point</p>
                                <p className="text-sm text-muted-foreground">{pointCfg.pointsEnabled ? "Aktif" : "Nonaktif"}</p>
                            </div>
                        </div>
                        <Switch checked={pointCfg.pointsEnabled} onCheckedChange={(v) => updatePoint("pointsEnabled", v)} />
                    </div>

                    <div className="bg-white rounded-2xl border border-border/40 p-5 space-y-5">
                        <div className="flex items-center gap-3">
                            <Gift className="w-5 h-5 text-primary" />
                            <p className="font-semibold text-sm">Konfigurasi Perolehan</p>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-sm">Rupiah per 1 Poin</Label>
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-muted-foreground">Setiap</span>
                                <Input type="number" value={pointCfg.earnRate} onChange={(e) => updatePoint("earnRate", Number(e.target.value))} className="rounded-lg w-32" min={1000} step={1000} />
                                <span className="text-sm text-muted-foreground">= 1 poin</span>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label className="text-sm font-semibold">Multiplier per Level</Label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {([
                                    { key: "multiplierRegular" as const, label: "Regular", color: "bg-slate-50 border-slate-200" },
                                    { key: "multiplierSilver" as const, label: "Silver", color: "bg-gray-50 border-gray-200" },
                                    { key: "multiplierGold" as const, label: "Gold", color: "bg-yellow-50 border-yellow-200" },
                                    { key: "multiplierPlatinum" as const, label: "Platinum", color: "bg-purple-50 border-purple-200" },
                                ]).map((item) => (
                                    <div key={item.key} className={`rounded-xl border p-3 space-y-2 ${item.color}`}>
                                        <p className="text-xs font-semibold text-center">{item.label}</p>
                                        <div className="flex items-center justify-center gap-1">
                                            <Input type="number" value={pointCfg[item.key]} onChange={(e) => updatePoint(item.key, Number(e.target.value))} className="rounded-lg w-16 h-8 text-center text-sm bg-white" min={0.5} step={0.5} />
                                            <span className="text-xs text-muted-foreground">x</span>
                                        </div>
                                        <p className="text-[11px] text-center text-muted-foreground">{Math.floor(basePoints * (pointCfg[item.key] as number))} poin / {formatCurrency(previewTransaction)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </TabsContent>

                {/* ====== Tab Penukaran ====== */}
                <TabsContent value="redeem" className="space-y-5">
                    <div className="bg-white rounded-2xl border border-border/40 p-5 space-y-5">
                        <div className="flex items-center gap-3">
                            <Award className="w-5 h-5 text-primary" />
                            <p className="font-semibold text-sm">Konfigurasi Penukaran Poin</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-sm">Nilai 1 Poin</Label>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground">Rp</span>
                                    <Input type="number" value={pointCfg.redeemValue} onChange={(e) => updatePoint("redeemValue", Number(e.target.value))} className="rounded-lg" min={100} step={100} />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-sm">Minimum Redeem</Label>
                                <div className="flex items-center gap-2">
                                    <Input type="number" value={pointCfg.redeemMin} onChange={(e) => updatePoint("redeemMin", Number(e.target.value))} className="rounded-lg" min={1} />
                                    <span className="text-sm text-muted-foreground">poin</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-muted/30 rounded-xl p-4">
                            <p className="text-xs font-semibold text-muted-foreground mb-3">Simulasi Penukaran</p>
                            <div className="grid grid-cols-3 gap-3">
                                {[10, 50, 100].map((pts) => (
                                    <div key={pts} className="bg-white rounded-lg p-3 text-center border border-border/30">
                                        <p className="text-lg font-bold text-primary">{pts}</p>
                                        <p className="text-[10px] text-muted-foreground">poin</p>
                                        <p className="text-xs font-semibold mt-1">{formatCurrency(pts * pointCfg.redeemValue)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </TabsContent>

                {/* ====== Tab Level ====== */}
                <TabsContent value="levels" className="space-y-5">
                    <div className="bg-white rounded-2xl border border-border/40 p-5 space-y-5">
                        <div className="flex items-center gap-3">
                            <TrendingUp className="w-5 h-5 text-primary" />
                            <div>
                                <p className="font-semibold text-sm">Level Membership</p>
                                <p className="text-xs text-muted-foreground">Level naik otomatis saat total belanja mencapai threshold</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {([
                                { key: "levelSilver" as const, label: "Silver", icon: "🥈", desc: "Member setia" },
                                { key: "levelGold" as const, label: "Gold", icon: "🥇", desc: "Member premium" },
                                { key: "levelPlatinum" as const, label: "Platinum", icon: "💎", desc: "Member VIP" },
                            ]).map((item) => (
                                <div key={item.key} className="flex items-center gap-4 rounded-xl border border-border/40 p-4">
                                    <span className="text-2xl">{item.icon}</span>
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold">{item.label}</p>
                                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                                    </div>
                                    <div className="text-right space-y-1">
                                        <Label className="text-[11px] text-muted-foreground">Min. Total Belanja</Label>
                                        <Input type="number" value={pointCfg[item.key]} onChange={(e) => updatePoint(item.key, Number(e.target.value))} className="rounded-lg w-40 text-right" min={0} step={100000} />
                                        <p className="text-[11px] text-muted-foreground">{formatCurrency(pointCfg[item.key] as number)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="bg-muted/30 rounded-xl p-4">
                            <p className="text-xs font-semibold text-muted-foreground mb-3">Alur Level</p>
                            <div className="flex items-center justify-between text-center">
                                <div><p className="text-sm font-medium">Regular</p><p className="text-[10px] text-muted-foreground">Rp 0</p></div>
                                <div className="h-px bg-border flex-1 mx-2" />
                                <div><p className="text-sm font-medium">Silver</p><p className="text-[10px] text-muted-foreground">{formatCurrency(pointCfg.levelSilver)}</p></div>
                                <div className="h-px bg-border flex-1 mx-2" />
                                <div><p className="text-sm font-medium">Gold</p><p className="text-[10px] text-muted-foreground">{formatCurrency(pointCfg.levelGold)}</p></div>
                                <div className="h-px bg-border flex-1 mx-2" />
                                <div><p className="text-sm font-medium">Platinum</p><p className="text-[10px] text-muted-foreground">{formatCurrency(pointCfg.levelPlatinum)}</p></div>
                            </div>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
