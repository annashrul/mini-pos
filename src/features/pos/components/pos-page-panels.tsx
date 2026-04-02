"use client";

import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn, formatCurrency } from "@/lib/utils";
import { AlertTriangle, ArrowLeft, CloudOff, History, Keyboard, Loader2, LogOut, Minus, Package, Pause, Plus, RefreshCw, ScanBarcode, ShoppingCart, Tag, Trash2, Wallet, CreditCard } from "lucide-react";
import { usePosPanelsContext } from "../hooks";

export function POSPagePanels() {
    const ctx = usePosPanelsContext();
    return (
        <>
            <div ref={ctx.panelsContainerRef} className="flex flex-1 min-h-0 relative">
                <div className={cn("bg-white border-r border-border/40 flex flex-col shrink-0", "w-full md:w-[280px] lg:w-auto", "absolute inset-0 md:relative md:inset-auto", "pb-16 md:pb-0", ctx.mobileView === "products" ? "z-10 flex" : "z-0 hidden md:flex")} style={ctx.isDesktop ? { width: ctx.leftPanelWidth } : undefined}>
                    <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={ctx.goDashboard}><ArrowLeft className="w-4 h-4" /></Button>
                        <div className="text-center">
                            <div className="flex items-center justify-center gap-1.5">
                                <h2 className="font-bold text-sm text-foreground">POS Kasir</h2>
                                {!ctx.isOnline && <CloudOff className="w-3.5 h-3.5 text-orange-500" />}
                            </div>
                            <p className="text-[10px] text-muted-foreground">{ctx.activeBranchName} • {ctx.selectedRegister}</p>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => { if (ctx.activeShift) { ctx.setShiftSummary(null); ctx.setClosingCash(""); ctx.setClosingNotes(""); ctx.setSummaryLoading(true); ctx.setShowClosingDialog(true); } }}><LogOut className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={ctx.syncProducts} disabled={ctx.productSyncing} title="Sinkronkan data produk"><RefreshCw className={cn("w-4 h-4", ctx.productSyncing && "animate-spin")} /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => ctx.setShowShortcutsDialog(true)}><Keyboard className="w-4 h-4" /></Button>
                        </div>
                    </div>
                    <div className="px-3 py-2 shrink-0 border-b border-border/20">
                        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                            <button onClick={() => {
                                ctx.saveCategoryCache();
                                ctx.setSelectedCategory("");
                                if (!ctx.restoreCategoryCache()) void ctx.loadProducts("all", undefined, 1, true);
                            }}
                                className={`text-[11px] px-3 py-1.5 rounded-full transition-all border whitespace-nowrap shrink-0 ${!ctx.selectedCategory ? "bg-primary text-primary-foreground border-primary" : "border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}>
                                Semua
                            </button>
                            {ctx.categories.map((c) => (
                                <button key={c.id} onClick={() => ctx.handleCategoryClick(c.id)} className={`text-[11px] px-3 py-1.5 rounded-full transition-all border whitespace-nowrap shrink-0 ${ctx.selectedCategory === c.id ? "bg-primary text-primary-foreground border-primary" : "border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}>{c.name}</button>
                            ))
                            }
                        </div>
                    </div>
                    <div ref={ctx.productScrollRef} className="flex-1 overflow-y-auto px-3 pb-3">
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-2 lg:grid-cols-2 gap-2 pt-2" style={ctx.isDesktop ? { gridTemplateColumns: `repeat(${ctx.productGridCols}, minmax(0, 1fr))` } : undefined}>
                            {ctx.browseItems.map((p) => (
                                <button key={p.id} onClick={() => ctx.addToCart(p)} className="text-left rounded-xl border border-border/40 hover:border-primary/50 hover:shadow-sm transition-all group bg-white active:scale-[0.97] overflow-hidden">
                                    {
                                        p.imageUrl ? <div className="relative aspect-square w-full bg-muted/10">
                                            <Image src={p.imageUrl} alt={p.name} fill className="object-cover" sizes="(max-width: 1024px) 33vw, 20vw" />
                                        </div> : <div className="aspect-square w-full bg-muted/20 flex items-center justify-center">
                                            <span className="text-2xl font-bold text-muted-foreground/20">{p.name.charAt(0)}</span>
                                        </div>
                                    }
                                    <div className="p-2.5">
                                        <p className="text-xs font-medium truncate group-hover:text-primary transition-colors leading-tight">{p.name}</p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">Stok: {p.stock}{p.units && p.units.length > 0 ? ` · ${p.units.length + 1} satuan` : ""}</p>
                                        <p className="text-sm text-primary font-bold mt-0.5 tabular-nums">{formatCurrency(p.sellingPrice)}</p>
                                    </div>
                                </button>
                            ))
                            }
                        </div>
                        {ctx.browseHasMore && (<div ref={ctx.productSentinelRef} className="flex justify-center py-4">{ctx.browseLoading && <Loader2 className="w-5 h-5 animate-spin text-primary/40" />}</div>)}{ctx.browseItems.length === 0 && !ctx.browseLoading && (<div className="py-10 text-center text-xs text-muted-foreground">Tidak ada produk ditemukan</div>)}{!ctx.browseHasMore && ctx.browseItems.length > 0 && (<p className="text-center text-[10px] text-muted-foreground/50 py-3">Semua produk ditampilkan</p>)}</div>
                    <div className="px-3 py-2 border-t border-border/30 hidden md:flex gap-1">{[{ key: "F1", label: "Cari", action: () => ctx.setShowSearchDialog(true) }, { key: "F2", label: ctx.heldTransactions.length > 0 ? `Hold (${ctx.heldTransactions.length})` : "Hold", action: () => ctx.heldTransactions.length > 0 ? ctx.setShowHeldDialog(true) : ctx.holdTransaction() }, { key: "F5", label: "Diskon", action: () => { if (!ctx.canPosAction("discount")) return; ctx.setShowDiscountDialog(true); } }, { key: "F6", label: "Riwayat", action: () => { void ctx.loadHistory(); } }].map((s) => (<button key={s.key} onClick={s.action} className="flex-1 text-[10px] font-medium text-muted-foreground hover:text-primary py-1.5 rounded-md hover:bg-accent transition-all"><span className="font-mono text-[9px] bg-muted/80 px-1 py-0.5 rounded mr-1">{s.key}</span>{s.label}</button>))}</div>
                </div>
                {ctx.isDesktop && (<div role="separator" aria-orientation="vertical" onMouseDown={ctx.startResizeLeftPanel} className={cn("hidden lg:flex w-1.5 cursor-col-resize shrink-0 items-center justify-center bg-border/20 hover:bg-primary/20 transition-colors", ctx.isResizingLeftPanel && "bg-primary/30")}><div className="h-14 w-[2px] rounded-full bg-muted-foreground/40" /></div>)}
                <div ref={ctx.centerPanelRef} className={cn("flex-1 flex flex-col min-w-0 bg-[#F1F5F9]", "md:min-w-[320px] lg:min-w-[420px]", "w-full lg:w-auto", "absolute inset-0 md:relative md:inset-auto", "pb-16 md:pb-0", ctx.mobileView === "cart" ? "z-10 flex" : "z-0 hidden md:flex")}>
                    <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-border/40 md:hidden"><Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => ctx.setMobileView("products")}><ArrowLeft className="w-4 h-4" /></Button><h2 className="font-bold text-sm">Keranjang</h2><div className="flex gap-1"><Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => { if (!ctx.canPosAction("discount")) return; ctx.setShowDiscountDialog(true); }}><Tag className="w-4 h-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => { void ctx.loadHistory(); }}><History className="w-4 h-4" /></Button></div></div>
                    <div className="px-5 py-3 bg-white border-b border-border/40"><div className="relative"><ScanBarcode className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/50" /><Input ref={ctx.barcodeInputRef} placeholder="Scan barcode atau ketik nama produk..." value={ctx.searchQuery} onChange={(e) => ctx.handleBarcodeInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && ctx.searchResults.length > 0) { const first = ctx.searchResults[0]; if (first) ctx.addToCart(first); } }} className="pl-12 h-11 lg:h-12 rounded-xl text-base border-2 border-border/50 focus:border-primary/50 bg-muted/20" autoFocus />{ctx.searching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-primary/40" />}</div>{ctx.searchResults.length > 0 && (<div className="mt-2 border border-border/50 rounded-xl overflow-hidden max-h-[240px] overflow-y-auto bg-white divide-y divide-border/20">{ctx.searchResults.map((p) => (<button key={p.id} onClick={() => ctx.addToCart(p)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/40 transition-colors text-left"><div><p className="font-medium text-sm">{p.name}</p><p className="text-xs text-muted-foreground">{p.code} &middot; {p.category.name} &middot; Stok: {p.stock}</p></div><p className="font-bold text-primary tabular-nums">{formatCurrency(p.sellingPrice)}</p></button>))}</div>)}</div>
                    {(ctx.negativeMarginItems.length > 0 || ctx.lowStockItems.length > 0) && (<div className="px-5 py-1.5 flex gap-2">{ctx.negativeMarginItems.length > 0 && <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 rounded-md text-[11px] text-red-500"><AlertTriangle className="w-3 h-3" />Margin negatif: {ctx.negativeMarginItems.map((i) => i.productName).join(", ")}</div>}{ctx.lowStockItems.length > 0 && <div className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 rounded-md text-[11px] text-orange-500"><AlertTriangle className="w-3 h-3" />Stok menipis</div>}</div>)}
                    <div className="flex-1 flex flex-col min-h-0 px-5 py-3"><div className="bg-white rounded-2xl border border-border/40 flex-1 flex flex-col overflow-hidden shadow-sm"><div className="px-5 py-3 border-b border-border/30 flex items-center justify-between shrink-0"><div className="flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-primary" /><span className="font-semibold text-sm">Keranjang</span>{ctx.totalItems > 0 && <Badge className="bg-primary/10 text-primary rounded-full text-xs px-2 h-5">{ctx.totalItems} item</Badge>}</div>{(ctx.cart.length > 0 || ctx.heldTransactions.length > 0) && (<div className="flex gap-1.5">{ctx.heldTransactions.length > 0 && (<Button variant="ghost" size="sm" className="h-7 text-xs text-primary hover:bg-primary/10 rounded-lg" onClick={() => ctx.setShowHeldDialog(true)}>Lihat Hold ({ctx.heldTransactions.length})</Button>)}{ctx.cart.length > 0 && (<><Button variant="ghost" size="sm" className="h-7 text-xs text-orange-500 hover:bg-orange-50 rounded-lg" onClick={ctx.holdTransaction} disabled={!ctx.canPosAction("hold")}><Pause className="w-3 h-3 mr-1" />Hold</Button><Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-lg" onClick={ctx.resetPOS}>Clear</Button></>)}</div>)}</div><div className="flex-1 overflow-y-auto min-h-0">{ctx.cart.length === 0 ? (<div className="flex flex-col items-center justify-center h-full py-16 text-muted-foreground/40"><ShoppingCart className="w-14 h-14 mb-3" /><p className="font-medium">Keranjang kosong</p><p className="text-xs mt-1">Scan barcode atau pilih produk</p>{ctx.heldTransactions.length > 0 && (<Button variant="outline" size="sm" className="mt-4 rounded-lg" onClick={() => ctx.setShowHeldDialog(true)}>Lihat Transaksi Hold ({ctx.heldTransactions.length})</Button>)}</div>) : (<div className="p-3 space-y-1">{ctx.cart.map((item, idx) => {
    const itemPromo = ctx.promoMeta.byItem[item.productId];
    const freeQty = ctx.promoMeta.freeQtyByItem[item.productId] ?? 0;
    const displayQty = item.quantity + freeQty;
    const lineKey = item.lineId ?? item.productId;
    const hasUnit = item.unitName && item.conversionQty && item.conversionQty > 1;
    return (
        <div key={lineKey} className={cn("rounded-xl hover:bg-muted/30 transition-colors group", ctx.isCompactCart ? "px-3 py-2" : "px-4 py-3")}>
            {/* Row 1: Product info + subtotal + delete */}
            <div className="flex items-start gap-2">
                {!ctx.isCompactCart && <span className="text-[10px] text-muted-foreground/40 w-4 text-center tabular-nums mt-1">{idx + 1}</span>}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate leading-tight">{item.productName}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-xs text-muted-foreground tabular-nums">{formatCurrency(item.unitPrice)}</span>
                                {hasUnit && (
                                    <Badge className="h-4 px-1.5 text-[9px] font-semibold bg-indigo-50 text-indigo-600 border-0 rounded-md">
                                        {item.unitName}
                                    </Badge>
                                )}
                            </div>
                            {itemPromo && (<p className="text-[10px] text-green-600 truncate mt-0.5">{itemPromo.names.join(", ")} · -{formatCurrency(itemPromo.discount)}</p>)}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                            <p className={cn("text-right font-bold text-sm tabular-nums", ctx.isCompactCart ? "min-w-[70px]" : "min-w-[90px]")}>{formatCurrency(item.subtotal)}</p>
                            <button onClick={() => ctx.removeItem(lineKey)} className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500 p-0.5 -mr-1"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                    </div>
                    {/* Row 2: Qty controls */}
                    <div className="flex items-center justify-between mt-1.5">
                        <div className="flex items-center gap-1">
                            <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" onClick={() => ctx.updateQuantity(lineKey, -1)} disabled={item.quantity <= 1}><Minus className="w-3 h-3" /></Button>
                            <span className="text-center font-bold text-sm tabular-nums min-w-[32px]">{displayQty}</span>
                            <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" onClick={() => ctx.updateQuantity(lineKey, 1)}><Plus className="w-3 h-3" /></Button>
                            {hasUnit && (
                                <span className="text-[10px] text-muted-foreground ml-1">
                                    × {item.conversionQty} = {displayQty * (item.conversionQty ?? 1)} {item.unitName === item.productName ? "pcs" : "pcs"}
                                </span>
                            )}
                            {freeQty > 0 && (<span className="text-[10px] text-green-600 ml-1.5">+{freeQty} gratis</span>)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
})}</div>)}</div></div></div>
                </div>
                <div className={cn("bg-white border-l border-border/40 flex flex-col shrink-0", "w-full lg:w-[340px]", "absolute inset-0 lg:relative lg:inset-auto", "pb-16 lg:pb-0", ctx.mobileView === "payment" ? "z-10 flex" : "z-0 hidden lg:flex")}>
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 lg:hidden"><Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => ctx.setMobileView("cart")}><ArrowLeft className="w-4 h-4" /></Button><h2 className="font-bold text-sm">Pembayaran</h2><div className="w-8" /></div>
                    <div className="flex-1 overflow-y-auto min-h-0"><div className="p-5 space-y-4"><div className="space-y-2.5"><div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums font-medium">{formatCurrency(ctx.subtotal)}</span></div><div className="flex items-center gap-2"><span className="text-sm text-muted-foreground flex-1">Diskon</span><Input type="number" value={ctx.discountPercent} onChange={(e) => ctx.setDiscountPercent(Number(e.target.value))} className="w-14 h-7 text-right rounded-md text-xs" min={0} max={100} /><span className="text-xs text-muted-foreground">%</span></div>{ctx.discountAmount > 0 && <div className="flex justify-between text-sm text-red-500"><span>Diskon</span><span className="tabular-nums">-{formatCurrency(ctx.discountAmount)}</span></div>}<div className="flex items-center gap-2"><span className="text-sm text-muted-foreground flex-1">Pajak</span><Input type="number" value={ctx.taxPercent} onChange={(e) => ctx.setTaxPercent(Number(e.target.value))} className="w-14 h-7 text-right rounded-md text-xs" min={0} max={100} /><span className="text-xs text-muted-foreground">%</span></div>{ctx.taxAmount > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Pajak</span><span className="tabular-nums">{formatCurrency(ctx.taxAmount)}</span></div>}</div><div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-4 border border-primary/10"><p className="text-xs font-medium text-primary/60 uppercase tracking-wider">Total Bayar</p><p className="text-3xl font-bold text-primary tabular-nums tracking-tight mt-1">{formatCurrency(ctx.grandTotal)}</p></div>{ctx.appliedPromos.length > 0 && (<div className="space-y-1"><p className="text-[10px] font-semibold text-green-600 uppercase tracking-wider">Promo Aktif</p>{Object.values(ctx.promoMeta.byItem).length > 0 && (<div className="text-[11px] text-green-700 bg-green-50/60 rounded-lg px-3 py-1.5">Promo item aktif di {Object.keys(ctx.promoMeta.byItem).length} produk (lihat di baris produk)</div>)}</div>)}{ctx.tebusMurahOptions.length > 0 && (<div className="space-y-1.5"><p className="text-[10px] font-semibold text-pink-600 uppercase tracking-wider">Promo Tebus Murah</p>{ctx.tebusMurahOptions.map((option) => (<div key={option.promoId} className="rounded-lg border border-pink-100 bg-pink-50/40 px-3 py-2 space-y-1.5"><p className="text-xs font-semibold text-pink-700">{option.promoName}</p><p className="text-[11px] text-pink-700/90">{option.triggerLabel}</p><div className="flex items-center justify-between gap-2"><div className="min-w-0"><p className="text-xs font-medium truncate">{option.product.name}</p><p className="text-[11px] text-pink-700/90">Tebus {formatCurrency(option.tebusPrice)} · Sisa {option.remainingQty}</p></div><Button size="sm" variant="outline" className="h-7 rounded-md border-pink-200 text-pink-700 hover:bg-pink-100" onClick={() => ctx.handleAddTebusMurah(option)} disabled={option.remainingQty <= 0}>Tebus</Button></div></div>))}</div>)}<div className="space-y-1.5"><label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Member</label><Input placeholder="No. HP member..." value={ctx.customerPhone} onChange={(e) => { void ctx.handleCustomerPhoneChange(e.target.value); }} className="rounded-lg h-8 text-sm" />{ctx.detectedCustomer && (<div className="bg-purple-50/60 rounded-lg px-3 py-2 space-y-1.5"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-purple-700">{ctx.detectedCustomer.name}</p><Badge className="bg-purple-100 text-purple-700 text-[10px]">{ctx.detectedCustomer.memberLevel}</Badge></div><p className="text-[11px] text-purple-500">{ctx.detectedCustomer.points} poin tersedia</p>{ctx.detectedCustomer.points >= 10 && (<div className="flex gap-1.5 items-center pt-0.5"><Input type="number" min={10} max={ctx.detectedCustomer.points} value={ctx.redeemPointsInput || ""} onChange={(e) => ctx.setRedeemPointsInput(Number(e.target.value))} placeholder="Jumlah poin" className="h-7 text-xs flex-1 rounded-md" /><Button size="sm" variant="outline" className="h-7 text-[10px] px-2 rounded-md border-purple-300 text-purple-600 hover:bg-purple-50" onClick={ctx.handleRedeemPoints} disabled={ctx.redeemPointsInput < 10 || ctx.redeemPointsInput > ctx.detectedCustomer.points || !ctx.canPosAction("redeem_points")}>Tukar</Button></div>)}{ctx.redeemDiscount > 0 && (<div className="flex justify-between text-xs bg-purple-100/60 rounded-md px-2 py-1"><span className="text-purple-700">Redeem {ctx.redeemPointsInput} poin</span><span className="text-purple-600 font-medium">-{formatCurrency(ctx.redeemDiscount)}</span></div>)}</div>)}</div><div className="space-y-1.5"><label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Voucher</label><div className="flex gap-1.5"><Input placeholder="Kode" value={ctx.voucherCode} onChange={(e) => ctx.setVoucherCode(e.target.value.toUpperCase())} className="rounded-lg h-8 text-sm flex-1" /><Button size="sm" variant="outline" className="rounded-lg h-8 text-xs px-3" onClick={() => { void ctx.handleApplyVoucher(); }} disabled={!ctx.voucherCode || !ctx.canPosAction("voucher")}>Apply</Button></div>{ctx.voucherApplied && <div className="flex justify-between text-xs bg-green-50/60 rounded-lg px-3 py-1.5"><span className="text-green-700">{ctx.voucherApplied}</span><span className="text-green-600 font-medium">-{formatCurrency(ctx.voucherDiscount)}</span></div>}</div><div className="rounded-xl border border-dashed border-border/60 p-3 text-xs text-muted-foreground">Atur metode pembayaran dan nominal saat klik tombol bayar.</div></div></div>
                    <div className="p-4 border-t border-border/30 bg-white shrink-0"><Button className="w-full h-14 rounded-xl text-lg font-bold shadow-lg hover:shadow-xl transition-all" onClick={ctx.openPaymentDialog} disabled={ctx.loading || ctx.cart.length === 0}><><CreditCard className="mr-2 h-5 w-5" />Bayar {formatCurrency(ctx.grandTotal)}</></Button></div>
                </div>
            </div>
            <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-border/40 flex lg:hidden safe-bottom">
                <button onClick={() => ctx.setMobileView("products")} className={cn("flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors", ctx.mobileView === "products" ? "text-primary" : "text-muted-foreground")}><Package className="w-5 h-5" /><span className="text-[10px] font-medium">Produk</span></button>
                <button onClick={() => ctx.setMobileView("cart")} className={cn("flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors relative", ctx.mobileView === "cart" ? "text-primary" : "text-muted-foreground")}><div className="relative"><ShoppingCart className="w-5 h-5" />{ctx.totalItems > 0 && (<span className="absolute -top-1.5 -right-2.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">{ctx.totalItems}</span>)}</div><span className="text-[10px] font-medium">Keranjang</span></button>
                <button onClick={() => ctx.setMobileView("payment")} className={cn("flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors", ctx.mobileView === "payment" ? "text-primary" : "text-muted-foreground")}><Wallet className="w-5 h-5" /><span className="text-[10px] font-medium">Bayar</span></button>
            </div>
            {/* Unit Selector Dialog */}
            <Dialog open={!!ctx.unitSelectorProduct} onOpenChange={(open) => { if (!open) ctx.setUnitSelectorProduct(null); }}>
                <DialogContent className="rounded-2xl max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="text-sm">Pilih Satuan — {ctx.unitSelectorProduct?.name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-1.5">
                        {/* Base unit option */}
                        {ctx.unitSelectorProduct && (
                            <button
                                onClick={() => {
                                    const p = ctx.unitSelectorProduct!;
                                    ctx.handleUnitSelect(p.unit, 1, p.sellingPrice, p.purchasePrice);
                                }}
                                className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/50 rounded-xl text-left transition-colors border border-border/40"
                            >
                                <div>
                                    <p className="font-medium text-sm">{ctx.unitSelectorProduct.unit} <span className="text-xs text-muted-foreground">(satuan dasar)</span></p>
                                    <p className="text-xs text-muted-foreground">Stok: {ctx.unitSelectorProduct.stock}</p>
                                </div>
                                <p className="font-bold text-primary text-sm tabular-nums">{formatCurrency(ctx.unitSelectorProduct.sellingPrice)}</p>
                            </button>
                        )}
                        {/* Additional unit options */}
                        {ctx.unitSelectorProduct?.units?.map((u) => (
                            <button
                                key={u.id}
                                onClick={() => {
                                    const p = ctx.unitSelectorProduct!;
                                    ctx.handleUnitSelect(u.name, u.conversionQty, u.sellingPrice, u.purchasePrice ?? p.purchasePrice);
                                }}
                                className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/50 rounded-xl text-left transition-colors border border-border/40"
                            >
                                <div>
                                    <p className="font-medium text-sm">{u.name}</p>
                                    <p className="text-xs text-muted-foreground">1 {u.name} = {u.conversionQty} {ctx.unitSelectorProduct!.unit} &middot; Stok: {Math.floor(ctx.unitSelectorProduct!.stock / u.conversionQty)}</p>
                                </div>
                                <p className="font-bold text-primary text-sm tabular-nums">{formatCurrency(u.sellingPrice)}</p>
                            </button>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
