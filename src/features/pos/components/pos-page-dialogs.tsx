"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { usePosDialogsContext } from "../hooks";

export function DiscountDialog() {
    const {
        showDiscountDialog,
        setShowDiscountDialog,
        discountType,
        setDiscountType,
        discountPercent,
        setDiscountPercent,
        discountFixed,
        setDiscountFixed,
        subtotal,
    } = usePosDialogsContext();
    return (
        <Dialog open={showDiscountDialog} onOpenChange={setShowDiscountDialog}>
            <DialogContent className="rounded-2xl max-w-sm">
                <DialogHeader><DialogTitle>Set Diskon</DialogTitle></DialogHeader>
                <div className="space-y-4">
                    <div className="flex gap-1 bg-muted/50 p-1 rounded-lg">
                        <button
                            onClick={() => setDiscountType("percent")}
                            className={`flex-1 text-sm font-medium py-2 rounded-md transition-all ${discountType === "percent" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"}`}
                        >
                            Persen (%)
                        </button>
                        <button
                            onClick={() => setDiscountType("amount")}
                            className={`flex-1 text-sm font-medium py-2 rounded-md transition-all ${discountType === "amount" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"}`}
                        >
                            Rupiah (Rp)
                        </button>
                    </div>
                    {discountType === "percent" ? (
                        <>
                            <div className="relative">
                                <Input type="number" value={discountPercent} onChange={(e) => setDiscountPercent(Number(e.target.value))} className="rounded-xl text-center text-3xl h-16 font-bold pr-10" min={0} max={100} autoFocus />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl text-muted-foreground">%</span>
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                                {[5, 10, 15, 20].map((v) => (
                                    <Button key={v} variant="outline" className="rounded-lg h-10" onClick={() => { setDiscountPercent(v); setShowDiscountDialog(false); }}>{v}%</Button>
                                ))}
                            </div>
                            {subtotal > 0 && discountPercent > 0 && (
                                <p className="text-center text-sm text-muted-foreground">= {formatCurrency(Math.round(subtotal * discountPercent / 100))}</p>
                            )}
                        </>
                    ) : (
                        <>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">Rp</span>
                                <Input type="number" value={discountFixed} onChange={(e) => setDiscountFixed(Number(e.target.value))} className="rounded-xl text-center text-3xl h-16 font-bold pl-12" min={0} autoFocus />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {[5000, 10000, 20000, 25000, 50000, 100000].map((v) => (
                                    <Button key={v} variant="outline" className="rounded-lg h-9 text-xs" onClick={() => { setDiscountFixed(v); setShowDiscountDialog(false); }}>{formatCurrency(v)}</Button>
                                ))}
                            </div>
                        </>
                    )}
                    <Button className="w-full rounded-xl h-11" onClick={() => setShowDiscountDialog(false)}>Terapkan</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export function VoidDialog() {
    const {
        showVoidDialog,
        setShowVoidDialog,
        voidReason,
        setVoidReason,
        handleVoid,
    } = usePosDialogsContext();
    return (
        <Dialog open={showVoidDialog} onOpenChange={setShowVoidDialog}>
            <DialogContent className="rounded-2xl max-w-sm">
                <DialogHeader><DialogTitle>Void Transaksi</DialogTitle></DialogHeader>
                <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">Transaksi akan dibatalkan dan stok dikembalikan.</p>
                    <div className="space-y-1.5">
                        <Label className="text-sm">Alasan <span className="text-red-400">*</span></Label>
                        <Input value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Masukkan alasan void..." className="rounded-lg" autoFocus />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowVoidDialog(false)} className="rounded-lg">Batal</Button>
                        <Button onClick={handleVoid} className="rounded-lg bg-red-600 hover:bg-red-700" disabled={!voidReason.trim()}>Void Transaksi</Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export function ShortcutsDialog() {
    const { showShortcutsDialog, setShowShortcutsDialog } = usePosDialogsContext();
    return (
        <Dialog open={showShortcutsDialog} onOpenChange={setShowShortcutsDialog}>
            <DialogContent className="rounded-2xl w-[92vw] max-w-md">
                <DialogHeader><DialogTitle>Keyboard Shortcuts</DialogTitle></DialogHeader>
                <div className="space-y-1">
                    {[["F1", "Cari produk"], ["F2", "Hold"], ["F3", "Bayar"], ["F4", "Reset"], ["F5", "Diskon"], ["Enter", "Tambah produk"], ["Esc", "Fokus barcode"]].map(([k, d]) => (
                        <div key={k} className="flex justify-between py-2 border-b border-border/30 last:border-0">
                            <Badge variant="secondary" className="rounded-md font-mono text-xs">{k}</Badge>
                            <span className="text-sm text-muted-foreground">{d}</span>
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}
