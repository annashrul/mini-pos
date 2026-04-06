"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, formatCurrency } from "@/lib/utils";
import { ArrowLeft, Ban, Eye, Loader2, Plus, Printer, Search, Store, Trash2 } from "lucide-react";
import type { RawPosProduct, PaymentMethodType } from "../types";
import { usePosDialogsContext } from "../hooks";
import { PAYMENT_METHOD_OPTIONS, toProductSearchResult } from "../utils";
import { DisabledActionTooltip } from "@/components/ui/disabled-action-tooltip";
export function POSPageMainDialogs() {
    const {
        showSearchDialog, setShowSearchDialog, searchProducts, activeBranchId, setSearchResults, searchResults, addToCart,
        showClosingDialog, setShowClosingDialog, activeBranchName, selectedRegister, activeShift, summaryLoading, shiftSummary, closingCash, setClosingCash, closingNotes, setClosingNotes, handleCloseShift, closingShiftLoading,
        showHeldDialog, setShowHeldDialog, heldTransactions, resumeTransaction, setHeldTransactions,
        showHistoryDialog, setShowHistoryDialog, historyDetail, setHistoryDetailId, historyLoading, historyData, reprintReceipt, canPosAction, setVoidingId, setVoidReason, setShowVoidDialog,
        showPaymentDialog, setShowPaymentDialog, dynamicQuickAmounts, payment, setPaymentAmount, handleCalculatorInput, paymentEntries, setPaymentEntries, remainingToPay, paymentMethod, setPaymentMethod, grandTotal, paidFromEntries, totalPaid, changeAmount, loading, handlePayment,
    } = usePosDialogsContext();
    const [splitCount, setSplitCount] = useState(2);
    const splitAmount = useMemo(() => {
        const base = remainingToPay > 0 ? remainingToPay : grandTotal;
        const normalizedCount = Math.max(2, Number.isFinite(splitCount) ? Math.floor(splitCount) : 2);
        return normalizedCount > 0 ? Math.ceil(base / normalizedCount) : base;
    }, [grandTotal, remainingToPay, splitCount]);
    const addPaymentEntry = (amount: number) => {
        if (amount <= 0) return;
        setPaymentEntries((prev) => {
            const existing = prev.find((e) => e.method === paymentMethod);
            if (existing) return prev.map((e) => e.method === paymentMethod ? { ...e, amount: e.amount + amount } : e);
            return [...prev, { method: paymentMethod, amount }];
        });
        setPaymentAmount("");
        setPaymentMethod("CASH");
    };
    const cannotMessage = (actionLabel: string) => `Anda tidak memiliki izin untuk aksi ${actionLabel}`;

    return (
        <>
            <Dialog open={showSearchDialog} onOpenChange={setShowSearchDialog}>
                <DialogContent className="rounded-2xl max-w-lg"><DialogHeader><DialogTitle className="flex items-center gap-2"><Search className="w-4 h-4" />Cari Produk</DialogTitle></DialogHeader>
                    <Input placeholder="Ketik nama / kode produk..." autoFocus className="rounded-xl h-11" onChange={async (e) => { if (e.target.value.length > 0) { const r = await searchProducts(e.target.value, activeBranchId); setSearchResults(r.map((item) => toProductSearchResult(item as RawPosProduct))); } else { setSearchResults([]); } }} />
                    <ScrollArea className="max-h-[300px]"><div className="space-y-1">{searchResults.map((p) => (<button key={p.id} onClick={() => { addToCart(p); setShowSearchDialog(false); }} className="w-full flex justify-between p-3 hover:bg-accent/50 rounded-xl text-left transition-colors"><div><p className="font-medium text-sm">{p.name}</p><p className="text-xs text-muted-foreground">{p.code} &middot; Stok: {p.stock}</p></div><p className="font-bold text-primary text-sm">{formatCurrency(p.sellingPrice)}</p></button>))}</div></ScrollArea>
                </DialogContent>
            </Dialog>
            <Dialog open={showClosingDialog} onOpenChange={setShowClosingDialog}>
                <DialogContent className="rounded-2xl max-w-md">
                    <DialogHeader><DialogTitle className="flex items-center gap-2"><Store className="w-4 h-4" /> Closing Kasir</DialogTitle></DialogHeader>
                    <DialogBody>
                        <div className="space-y-4">
                            <div className="rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                                <p>Lokasi: <span className="font-medium text-foreground">{activeBranchName}</span></p>
                                <p>Kassa: <span className="font-medium text-foreground">{selectedRegister}</span></p>
                                {activeShift && <p>Dibuka: <span className="font-medium text-foreground">{new Date(activeShift.openedAt).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span></p>}
                            </div>
                            {summaryLoading ? <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary/40" /></div> : shiftSummary && (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="rounded-xl border border-border/40 p-3"><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Transaksi</p><p className="text-xl font-bold tabular-nums">{shiftSummary.totalTransactions}</p></div>
                                        <div className="rounded-xl border border-border/40 p-3"><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Penjualan</p><p className="text-xl font-bold tabular-nums text-primary">{formatCurrency(shiftSummary.totalSales)}</p></div>
                                    </div>
                                    <div className="rounded-xl border border-border/40 p-3 space-y-1.5 text-sm">
                                        <div className="flex justify-between"><span className="text-muted-foreground">Kas Awal</span><span className="tabular-nums">{formatCurrency(shiftSummary.openingCash)}</span></div>
                                        <div className="flex justify-between"><span className="text-muted-foreground">Penjualan Cash</span><span className="tabular-nums text-emerald-600">+{formatCurrency(shiftSummary.netCash)}</span></div>
                                        {shiftSummary.nonCashIn > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Penjualan Non-Cash</span><span className="tabular-nums text-blue-600">{formatCurrency(shiftSummary.nonCashIn)}</span></div>}
                                        {shiftSummary.expenseAmount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Pengeluaran</span><span className="tabular-nums text-red-500">-{formatCurrency(shiftSummary.expenseAmount)}</span></div>}
                                        {shiftSummary.voidedCount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Transaksi Void</span><span className="tabular-nums text-red-500">{shiftSummary.voidedCount} transaksi</span></div>}
                                        <div className="border-t border-border/30 pt-1.5 flex justify-between font-semibold"><span>Kas Diharapkan (Sistem)</span><span className="tabular-nums text-primary">{formatCurrency(shiftSummary.expectedCash)}</span></div>
                                    </div>
                                </div>
                            )}
                            <div className="space-y-1.5"><Label>Uang di Laci (Aktual)</Label><Input type="number" min={0} value={closingCash} onChange={(e) => setClosingCash(e.target.value)} className="rounded-lg h-11 text-lg font-semibold tabular-nums" placeholder="Masukkan nominal uang di laci..." /></div>
                            {shiftSummary && closingCash && (
                                <div className={cn("rounded-xl p-3 flex items-center justify-between", Number(closingCash) - shiftSummary.expectedCash === 0 ? "bg-emerald-50 border border-emerald-200" : Number(closingCash) - shiftSummary.expectedCash > 0 ? "bg-blue-50 border border-blue-200" : "bg-red-50 border border-red-200")}>
                                    <span className="text-sm font-medium">{Number(closingCash) - shiftSummary.expectedCash === 0 ? "Sesuai" : Number(closingCash) - shiftSummary.expectedCash > 0 ? "Lebih" : "Kurang"}</span>
                                    <span className={cn("text-lg font-bold tabular-nums", Number(closingCash) - shiftSummary.expectedCash === 0 ? "text-emerald-600" : Number(closingCash) - shiftSummary.expectedCash > 0 ? "text-blue-600" : "text-red-600")}>{formatCurrency(Math.abs(Number(closingCash) - shiftSummary.expectedCash))}</span>
                                </div>
                            )}
                            <div className="space-y-1"><Label>Catatan</Label><Input value={closingNotes} onChange={(e) => setClosingNotes(e.target.value)} className="rounded-lg" placeholder="Opsional" /></div>
                        </div>
                    </DialogBody>
                    <DialogFooter><Button variant="outline" className="rounded-lg" onClick={() => setShowClosingDialog(false)}>Batal</Button><Button className="rounded-lg" onClick={handleCloseShift} disabled={closingShiftLoading || !closingCash}>{closingShiftLoading ? "Memproses..." : "Tutup Shift"}</Button></DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={showHeldDialog} onOpenChange={setShowHeldDialog}>
                <DialogContent className="rounded-2xl w-[92vw] max-w-4xl">
                    <DialogHeader><DialogTitle className="flex items-center justify-between"><span>Transaksi Ditahan</span><Badge variant="secondary" className="rounded-full px-3">{heldTransactions.length}</Badge></DialogTitle></DialogHeader>
                    {heldTransactions.length === 0 ? <div className="py-10 text-center"><p className="text-sm font-medium text-foreground">Belum ada transaksi hold</p><p className="text-xs text-muted-foreground mt-1">Gunakan tombol Hold saat ada transaksi aktif</p></div> : (
                        <ScrollArea className="max-h-[60vh] pr-2"><div className="space-y-3">{heldTransactions.map((h) => { const total = h.cart.reduce((s, i) => s + i.subtotal, 0); const qty = h.cart.reduce((s, i) => s + i.quantity, 0); return (<div key={h.id} className="rounded-xl border border-border/60 bg-card p-4"><div className="flex items-start justify-between gap-3"><div className="space-y-1"><p className="text-sm font-semibold">Hold #{String(h.id).slice(-6)}</p><p className="text-xs text-muted-foreground">Pukul {h.time}</p><div className="flex items-center gap-2 pt-1"><Badge variant="outline" className="rounded-md text-[10px]">{h.cart.length} produk</Badge><Badge variant="outline" className="rounded-md text-[10px]">{qty} qty</Badge></div></div><div className="text-right"><p className="text-xs text-muted-foreground">Total</p><p className="text-base font-bold text-primary tabular-nums">{formatCurrency(total)}</p></div></div><div className="mt-3 flex items-center justify-end gap-2"><Button size="sm" className="rounded-lg" onClick={() => resumeTransaction(h.id)}>Lanjutkan</Button><Button variant="outline" size="sm" className="rounded-lg text-red-500 border-red-200 hover:bg-red-50" onClick={() => setHeldTransactions((p) => p.filter((x) => x.id !== h.id))}>Hapus</Button></div></div>); })}</div></ScrollArea>
                    )}
                </DialogContent>
            </Dialog>
            <Dialog open={showHistoryDialog} onOpenChange={(v) => { setShowHistoryDialog(v); if (!v) setHistoryDetailId(null); }}>
                <DialogContent className="rounded-2xl max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
                    <DialogHeader><DialogTitle className="flex items-center gap-2">{historyDetail ? <><Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg -ml-1" onClick={() => setHistoryDetailId(null)}><ArrowLeft className="w-4 h-4" /></Button> Detail {historyDetail.invoiceNumber}</> : "Riwayat Transaksi"}</DialogTitle></DialogHeader>
                    <DialogBody>
                        {historyDetail ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3 text-sm"><div className="rounded-lg bg-muted/30 p-3"><p className="text-[10px] text-muted-foreground uppercase">Invoice</p><p className="font-mono font-medium">{historyDetail.invoiceNumber}</p></div><div className="rounded-lg bg-muted/30 p-3"><p className="text-[10px] text-muted-foreground uppercase">Tanggal</p><p className="font-medium">{new Date(historyDetail.createdAt).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p></div></div>
                                <div className="rounded-xl border border-border/40 overflow-hidden"><div className="bg-muted/20 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Item</div><div className="divide-y divide-border/20">{historyDetail.items.map((item, idx) => (<div key={idx} className="flex items-center justify-between px-3 py-2 text-sm"><div className="flex-1 min-w-0"><p className="font-medium truncate">{item.productName}</p><p className="text-xs text-muted-foreground">{item.quantity}{item.unitName && item.unitName !== "PCS" ? ` ${item.unitName}` : ""} x {formatCurrency(item.unitPrice)}</p>{item.unitName && item.unitName !== "PCS" && item.conversionQty && item.conversionQty > 1 && <p className="text-[10px] text-muted-foreground/70">{item.quantity} {item.unitName} &times; {item.conversionQty} = {item.quantity * item.conversionQty} pcs</p>}</div><p className="font-semibold tabular-nums">{formatCurrency(item.subtotal)}</p></div>))}</div></div>
                                <div className="space-y-1.5 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{formatCurrency(historyDetail.subtotal)}</span></div>{historyDetail.discountAmount > 0 && <div className="flex justify-between text-red-500"><span>Diskon</span><span className="tabular-nums">-{formatCurrency(historyDetail.discountAmount)}</span></div>}{historyDetail.taxAmount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Pajak</span><span className="tabular-nums">{formatCurrency(historyDetail.taxAmount)}</span></div>}<div className="flex justify-between font-bold text-base border-t border-border/30 pt-1.5"><span>Total</span><span className="tabular-nums">{formatCurrency(historyDetail.grandTotal)}</span></div></div>
                                <div className="space-y-1.5"><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pembayaran</p>{historyDetail.payments && historyDetail.payments.length > 1 ? <div className="space-y-1">{historyDetail.payments.map((p, idx) => (<div key={idx} className="flex justify-between text-sm bg-muted/20 rounded-lg px-3 py-1.5"><span>{PAYMENT_METHOD_OPTIONS.find((m) => m.value === p.method)?.label || p.method}</span><span className="font-semibold tabular-nums">{formatCurrency(p.amount)}</span></div>))}</div> : <div className="flex justify-between text-sm bg-muted/20 rounded-lg px-3 py-1.5"><span>{PAYMENT_METHOD_OPTIONS.find((m) => m.value === historyDetail.paymentMethod)?.label || historyDetail.paymentMethod}</span><span className="font-semibold tabular-nums">{formatCurrency(historyDetail.paymentAmount)}</span></div>}{historyDetail.changeAmount > 0 && <div className="flex justify-between text-sm px-3"><span className="text-muted-foreground">Kembalian</span><span className="tabular-nums">{formatCurrency(historyDetail.changeAmount)}</span></div>}</div>
                                <div className="flex gap-2 pt-2"><Button variant="outline" className="flex-1 rounded-lg" onClick={() => reprintReceipt(historyDetail)} disabled={!canPosAction("reprint")}><Printer className="w-4 h-4 mr-1.5" /> Cetak Ulang</Button>{historyDetail.status === "COMPLETED" && <Button variant="outline" className="flex-1 rounded-lg text-red-500 border-red-200 hover:bg-red-50" onClick={() => { setVoidingId(historyDetail.id); setVoidReason(""); setShowVoidDialog(true); }}>Void</Button>}</div>
                            </div>
                        ) : historyLoading ? (
                            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary/40" /></div>
                        ) : historyData.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">Belum ada transaksi</p>
                        ) : (
                            <div className="space-y-2">{historyData.map((tx) => (<div key={tx.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/40 hover:bg-muted/20 transition-colors"><div className="flex-1 min-w-0 cursor-pointer" onClick={() => setHistoryDetailId(tx.id)}><p className="text-sm font-mono font-medium">{tx.invoiceNumber}</p><p className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}{" · "}{tx.payments && tx.payments.length > 1 ? tx.payments.map((p) => PAYMENT_METHOD_OPTIONS.find((m) => m.value === p.method)?.label || p.method).join(" + ") : PAYMENT_METHOD_OPTIONS.find((m) => m.value === tx.paymentMethod)?.label || tx.paymentMethod}</p></div><p className="text-sm font-semibold tabular-nums">{formatCurrency(tx.grandTotal)}</p><Badge className={tx.status === "COMPLETED" ? "bg-green-100 text-green-700" : tx.status === "VOIDED" ? "bg-red-100 text-red-700" : tx.status === "REFUNDED" ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-700"}>{tx.status}</Badge><div className="flex gap-1 shrink-0"><DisabledActionTooltip disabled={!canPosAction("reprint")} message={cannotMessage("reprint")}><Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => reprintReceipt(tx)} title="Cetak Ulang" disabled={!canPosAction("reprint")}><Printer className="w-3.5 h-3.5" /></Button></DisabledActionTooltip><Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setHistoryDetailId(tx.id)} title="Detail"><Eye className="w-3.5 h-3.5" /></Button>{tx.status === "COMPLETED" && <DisabledActionTooltip disabled={!canPosAction("void")} message={cannotMessage("void")}><Button disabled={!canPosAction("void")} variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-red-500 hover:bg-red-50" onClick={() => { if (!canPosAction("void")) return; setVoidingId(tx.id); setVoidReason(""); setShowVoidDialog(true); }} title="Void"><Ban className="w-3.5 h-3.5" /></Button></DisabledActionTooltip>}</div></div>))}</div>
                        )}
                    </DialogBody>
                </DialogContent>
            </Dialog>
            <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
                <DialogContent className="w-[98vw] max-w-[1400px] rounded-none sm:rounded-2xl p-0 overflow-hidden max-h-[100dvh] sm:max-h-[90vh] flex flex-col" showCloseButton={false}>
                    <div className="flex flex-col md:flex-row md:grid md:grid-cols-[1fr_1.15fr] flex-1 min-h-0 overflow-hidden">
                        <div className="order-2 md:order-1 p-3 md:p-5 md:border-r border-t md:border-t-0 border-border/30 bg-muted/20 shrink-0 md:overflow-y-auto max-h-[35vh] md:max-h-none overflow-y-auto">
                            <DialogHeader className="mb-4 hidden md:flex"><DialogTitle>Kalkulator Pembayaran</DialogTitle></DialogHeader>
                            <div className="mb-3 rounded-xl bg-white border border-border/50 px-4 py-2.5 hidden md:block"><p className="text-[11px] text-muted-foreground">Nominal Input</p><p className="text-3xl font-bold tabular-nums">{formatCurrency(payment || 0)}</p></div>
                            <div className="flex items-center gap-2 mb-2 md:hidden"><div className="flex-1 rounded-lg bg-white border border-border/50 px-3 py-1.5"><p className="text-[9px] text-muted-foreground leading-none">Nominal</p><p className="text-lg font-bold tabular-nums leading-tight">{formatCurrency(payment || 0)}</p></div><div className="flex gap-1 overflow-x-auto scrollbar-hide shrink-0">{dynamicQuickAmounts.map((amount, idx) => (<Button key={amount} type="button" variant="secondary" className="rounded-md h-7 text-[10px] shrink-0 px-2" onClick={() => setPaymentAmount(String(amount))}>{idx === 0 ? "Pas" : formatCurrency(amount)}</Button>))}</div></div>
                            <div className="hidden md:grid grid-cols-2 gap-2 mb-3">{dynamicQuickAmounts.map((amount, idx) => (<Button key={amount} type="button" variant="secondary" className="rounded-lg h-9 text-xs" onClick={() => setPaymentAmount(String(amount))}>{idx === 0 ? "Pas" : formatCurrency(amount)}</Button>))}</div>
                            <div className="grid grid-cols-4 md:grid-cols-3 gap-1 md:gap-2">{["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "BACKSPACE"].map((key) => (<Button key={key} type="button" variant="outline" className="h-9 md:h-11 rounded-lg md:rounded-xl text-sm md:text-base active:scale-95 transition-transform" onClick={() => handleCalculatorInput(key)}>{key === "BACKSPACE" ? "⌫" : key}</Button>))}<Button type="button" variant="ghost" className="h-8 md:h-11 rounded-lg md:rounded-xl text-red-500 text-xs md:text-sm col-span-4 md:col-span-3" onClick={() => handleCalculatorInput("CLEAR")}>Clear</Button></div>
                        </div>
                        <div className="order-1 md:order-2 flex flex-col min-h-0 flex-1">
                            <div className="p-4 md:p-5 space-y-3 md:space-y-4 flex-1 overflow-y-auto">
                                <DialogHeader className="md:hidden"><DialogTitle className="text-base">Pembayaran</DialogTitle></DialogHeader>
                                <div className="hidden md:block"><DialogHeader><DialogTitle>Konfirmasi Pembayaran</DialogTitle></DialogHeader></div>
                                <div className="rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/10 px-4 py-2.5 md:hidden"><p className="text-[10px] text-primary/60 uppercase tracking-wider font-medium">Total Bayar</p><p className="text-2xl font-bold text-primary tabular-nums">{formatCurrency(grandTotal)}</p></div>
                                {paymentEntries.length > 0 && <div className="space-y-1.5"><label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Pembayaran Ditambahkan</label><div className="space-y-1">{paymentEntries.map((entry, idx) => (<div key={idx} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-1.5"><span className="text-xs font-medium">{PAYMENT_METHOD_OPTIONS.find((m) => m.value === entry.method)?.label}</span><div className="flex items-center gap-2"><span className="text-sm font-semibold tabular-nums">{formatCurrency(entry.amount)}</span><button type="button" onClick={() => setPaymentEntries((prev) => prev.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-red-500 transition-colors"><Trash2 className="w-3 h-3" /></button></div></div>))}</div>{remainingToPay > 0 && <p className="text-xs text-orange-500 font-medium">Sisa: {formatCurrency(remainingToPay)}</p>}</div>}
                                <div className="space-y-1.5"><label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{paymentEntries.length > 0 ? "Tambah Metode Lain" : "Metode Pembayaran"}</label><div className="grid grid-cols-3 md:grid-cols-2 gap-1.5 md:gap-2">{PAYMENT_METHOD_OPTIONS.map((method) => (<button key={method.value} type="button" onClick={() => { setPaymentMethod(method.value as PaymentMethodType); if (method.value !== "CASH") { setPaymentAmount(String(remainingToPay > 0 ? remainingToPay : grandTotal)); } }} className={cn("flex items-center justify-center md:justify-start gap-1 md:gap-2 rounded-lg border px-2 md:px-3 py-1.5 md:py-2 text-[11px] md:text-sm transition-colors", paymentMethod === method.value ? "border-primary bg-primary/5 text-primary" : "border-border/60 hover:border-primary/40 hover:bg-accent/40")}><span className={cn("h-3 w-3 md:h-4 md:w-4 rounded-full border flex items-center justify-center shrink-0", paymentMethod === method.value ? "border-primary" : "border-muted-foreground/40")}><span className={cn("h-1.5 w-1.5 md:h-2 md:w-2 rounded-full", paymentMethod === method.value ? "bg-primary" : "bg-transparent")} /></span><span className="truncate">{method.label}</span></button>))}</div></div>
                                <div className="space-y-1.5 rounded-lg border border-border/40 bg-muted/10 p-2.5 md:p-3">
                                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Split Bill</label>
                                    <div className="flex items-center gap-2">
                                        <Input type="number" min={2} value={String(splitCount)} onChange={(e) => setSplitCount(Math.max(2, Number(e.target.value) || 2))} className="h-9 rounded-lg w-20 text-center font-semibold tabular-nums" />
                                        <div className="flex items-center gap-1">
                                            {[2, 3, 4].map((v) => <Button key={v} type="button" variant={splitCount === v ? "default" : "outline"} size="sm" className="h-8 px-2.5 rounded-lg text-xs" onClick={() => setSplitCount(v)}>{v} org</Button>)}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">Per orang</span>
                                        <span className="font-semibold tabular-nums">{formatCurrency(splitAmount)}</span>
                                    </div>
                                    <Button type="button" variant="outline" size="sm" className="w-full rounded-lg text-xs" onClick={() => setPaymentAmount(String(Math.min(splitAmount, remainingToPay > 0 ? remainingToPay : splitAmount)))}>
                                        Isi Nominal Split
                                    </Button>
                                    {remainingToPay > splitAmount && <Button type="button" variant="outline" size="sm" className="w-full rounded-lg text-xs" onClick={() => addPaymentEntry(splitAmount)}><Plus className="w-3 h-3 mr-1" /> Tambah 1 Bagian Split</Button>}
                                </div>
                                <div className="hidden md:block space-y-1.5"><label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Nominal</label><Input type="number" value={String(payment)} onChange={(e) => setPaymentAmount(e.target.value)} className="rounded-lg h-11 text-right text-2xl font-bold tabular-nums" /></div>
                                {payment > 0 && remainingToPay > 0 && payment < remainingToPay && <Button type="button" variant="outline" size="sm" className="w-full rounded-lg text-xs" onClick={() => addPaymentEntry(payment)}><Plus className="w-3 h-3 mr-1" /> Tambah & Lanjut Metode Lain</Button>}
                                <div className="rounded-xl border border-border/40 p-2.5 md:p-4 space-y-1 md:space-y-2"><div className="flex justify-between text-xs md:text-sm"><span className="text-muted-foreground">Total</span><span className="font-semibold tabular-nums">{formatCurrency(grandTotal)}</span></div>{paidFromEntries > 0 && <div className="flex justify-between text-xs md:text-sm"><span className="text-muted-foreground">Sudah Dibayar</span><span className="font-semibold tabular-nums text-blue-600">{formatCurrency(paidFromEntries)}</span></div>}<div className="flex justify-between text-xs md:text-sm"><span className="text-muted-foreground">{paymentEntries.length > 0 ? "Bayar Sekarang" : "Dibayar"}</span><span className="font-semibold tabular-nums">{formatCurrency(payment)}</span></div><div className="border-t border-border/30 pt-1 md:pt-2 flex justify-between text-sm md:text-base"><span className="font-medium">Kembalian</span><span className="font-bold tabular-nums text-emerald-600">{formatCurrency(totalPaid >= grandTotal ? changeAmount : 0)}</span></div></div>
                            </div>
                            <div className="p-3 md:p-5 pt-2 md:pt-1 border-t border-border/30 bg-white shrink-0"><div className="flex gap-2"><Button variant="outline" className="flex-1 rounded-xl h-10 md:h-11" onClick={() => setShowPaymentDialog(false)}>Batal</Button><DisabledActionTooltip disabled={!canPosAction("create")} message={cannotMessage("create")}><Button className="flex-[2] md:flex-1 rounded-xl h-10 md:h-11 text-sm md:text-base" onClick={() => { if (!canPosAction("create")) return; handlePayment(); }} disabled={!canPosAction("create") || loading || totalPaid < grandTotal}>{loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Memproses...</> : "Proses Pembayaran"}</Button></DisabledActionTooltip></div></div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
