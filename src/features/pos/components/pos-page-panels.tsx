"use client";

import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn, formatCurrency } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { AlertTriangle, ArrowLeft, Check, ChevronDown, CloudOff, History, Keyboard, LayoutGrid, LayoutList, Loader2, LogOut, Minus, Package, Pause, Plus, RefreshCw, ScanBarcode, Search, ShoppingCart, Tag, Trash2, Users, Wallet, CreditCard } from "lucide-react";
import { usePosPanelsContext } from "../hooks";
import { BarcodeScannerDialog } from "./barcode-scanner-dialog";
import { ProButton } from "@/components/ui/pro-gate";

export function POSPagePanels() {
    const ctx = usePosPanelsContext();
    const [categorySheetOpen, setCategorySheetOpen] = useState(false);
    const [tabSheetOpen, setTabSheetOpen] = useState(false);
    const [productLayout, setProductLayout] = useState<"grid" | "list">("grid");
    const [scannerOpen, setScannerOpen] = useState(false);
    const activeTabLabel = ctx.leftPanelTab === "products" ? "Produk" : ctx.leftPanelTab === "bundles" ? "Paket" : "Meja";
    const activeCategoryName = ctx.selectedCategory ? ctx.categories.find(c => c.id === ctx.selectedCategory)?.name || "Kategori" : "Semua";
    return (
        <>
            <div ref={ctx.panelsContainerRef} className="flex flex-1 min-h-0 relative">
                <div className={cn("bg-white border-r border-border/40 flex flex-col shrink-0", "w-full md:w-[45%] lg:w-auto", "absolute inset-0 md:relative md:inset-auto", "pb-16 lg:pb-0", ctx.mobileView === "products" ? "z-10 flex" : "z-0 hidden md:flex")} style={ctx.isDesktop ? { width: ctx.leftPanelWidth } : undefined}>
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
                    {/* Mobile: tab + category + layout toggle in one row */}
                    <div className="md:hidden px-2 py-1.5 border-b border-border/20 flex gap-1.5 items-center">
                        {(ctx.bundles.length > 0 || ctx.showTableNumber) && (
                            <button onClick={() => setTabSheetOpen(true)}
                                className={cn("flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold shrink-0",
                                    ctx.leftPanelTab !== "products" ? "border-primary bg-primary/10 text-primary" : "border-border/50 text-muted-foreground")}>
                                <LayoutGrid className="w-3 h-3" />
                                {activeTabLabel}
                                <ChevronDown className="w-3 h-3 opacity-50" />
                            </button>
                        )}
                        {ctx.leftPanelTab === "products" && (
                            <button onClick={() => setCategorySheetOpen(true)}
                                className={cn("flex-1 flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium",
                                    ctx.selectedCategory ? "border-primary bg-primary/10 text-primary" : "border-border/50 text-muted-foreground")}>
                                <Tag className="w-3 h-3 shrink-0" />
                                <span className="truncate flex-1 text-left">{activeCategoryName}</span>
                                <ChevronDown className="w-3 h-3 opacity-50 shrink-0" />
                            </button>
                        )}
                        {ctx.leftPanelTab === "products" && (
                            <button onClick={() => setProductLayout(productLayout === "grid" ? "list" : "grid")}
                                className="shrink-0 p-1.5 rounded-lg border border-border/50 text-muted-foreground hover:text-foreground transition-colors">
                                {productLayout === "grid" ? <LayoutList className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />}
                            </button>
                        )}
                    </div>
                    {/* Mobile: tab bottom sheet */}
                    {(ctx.bundles.length > 0 || ctx.showTableNumber) && (
                        <Sheet open={tabSheetOpen} onOpenChange={setTabSheetOpen}>
                            <SheetContent side="bottom" className="rounded-t-2xl p-0 max-h-[50vh] flex flex-col" showCloseButton={false}>
                                <div className="shrink-0">
                                    <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-muted-foreground/20" /></div>
                                    <SheetHeader className="px-4 pb-3 pt-0"><SheetTitle className="text-base font-bold">Pilih Tab</SheetTitle></SheetHeader>
                                </div>
                                <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
                                    <button onClick={() => { ctx.setLeftPanelTab("products"); setTabSheetOpen(false); }}
                                        className={cn("w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all", ctx.leftPanelTab === "products" ? "bg-foreground text-background" : "bg-muted/40 text-foreground hover:bg-muted")}>
                                        <span className="flex items-center gap-2"><Package className="w-4 h-4" /> Produk</span>
                                        {ctx.leftPanelTab === "products" && <Check className="w-4 h-4" />}
                                    </button>
                                    {ctx.bundles.length > 0 && (
                                        <button onClick={() => { ctx.setLeftPanelTab("bundles"); setTabSheetOpen(false); }}
                                            className={cn("w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all", ctx.leftPanelTab === "bundles" ? "bg-foreground text-background" : "bg-muted/40 text-foreground hover:bg-muted")}>
                                            <span className="flex items-center gap-2"><Tag className="w-4 h-4" /> Paket</span>
                                            {ctx.leftPanelTab === "bundles" && <Check className="w-4 h-4" />}
                                        </button>
                                    )}
                                    {ctx.showTableNumber && (
                                        <button onClick={() => { ctx.setLeftPanelTab("tables"); setTabSheetOpen(false); }}
                                            className={cn("w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all", ctx.leftPanelTab === "tables" ? "bg-foreground text-background" : "bg-muted/40 text-foreground hover:bg-muted")}>
                                            <span className="flex items-center gap-2"><Users className="w-4 h-4" /> Meja {ctx.selectedTables.length > 0 && `(${ctx.selectedTables.length})`}</span>
                                            {ctx.leftPanelTab === "tables" && <Check className="w-4 h-4" />}
                                        </button>
                                    )}
                                </div>
                            </SheetContent>
                        </Sheet>
                    )}
                    {/* Desktop: inline tabs */}
                    {(ctx.bundles.length > 0 || ctx.showTableNumber) && (
                        <div className="hidden md:flex px-3 py-2 border-b border-border/20 gap-1">
                            <button onClick={() => ctx.setLeftPanelTab("products")}
                                className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-all ${ctx.leftPanelTab === "products" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"}`}>
                                Produk
                            </button>
                            {ctx.bundles.length > 0 && (
                                <button onClick={() => ctx.setLeftPanelTab("bundles")}
                                    className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-all ${ctx.leftPanelTab === "bundles" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"}`}>
                                    Paket
                                </button>
                            )}
                            {ctx.showTableNumber && (
                                <button onClick={() => ctx.setLeftPanelTab("tables")}
                                    className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-all relative ${ctx.leftPanelTab === "tables" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"}`}>
                                    Meja {ctx.selectedTables.length > 0 && `(${ctx.selectedTables.length})`}
                                    {ctx.selectedTables.length > 0 && (
                                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{ctx.selectedTables.length}</span>
                                    )}
                                </button>
                            )}
                            {ctx.leftPanelTab === "products" && (
                                <button onClick={() => setProductLayout(productLayout === "grid" ? "list" : "grid")}
                                    className="shrink-0 p-2 rounded-lg bg-muted text-foreground hover:bg-muted-foreground/20 border border-border/50 transition-colors" title={productLayout === "grid" ? "Tampilan list" : "Tampilan grid"}>
                                    {productLayout === "grid" ? <LayoutList className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
                                </button>
                            )}
                        </div>
                    )}
                    {ctx.leftPanelTab === "products" && (
                        <div className="hidden md:block px-3 py-2 shrink-0 border-b border-border/20">
                            {/* Desktop: horizontal scroll pills */}
                            <ScrollArea className="w-full">
                                <div className="flex items-center gap-1.5 pb-0.5">
                                    <button onClick={() => { ctx.saveCategoryCache(); ctx.setSelectedCategory(""); if (!ctx.restoreCategoryCache()) void ctx.loadProducts("all", undefined, 1, true); }}
                                        className={`text-[11px] px-3 py-1.5 rounded-full transition-all border whitespace-nowrap shrink-0 ${!ctx.selectedCategory ? "bg-primary text-primary-foreground border-primary" : "border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}>
                                        Semua
                                    </button>
                                    {ctx.categories.map((c) => (
                                        <button key={c.id} onClick={() => ctx.handleCategoryClick(c.id)} className={`text-[11px] px-3 py-1.5 rounded-full transition-all border whitespace-nowrap shrink-0 ${ctx.selectedCategory === c.id ? "bg-primary text-primary-foreground border-primary" : "border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}>{c.name}</button>
                                    ))}
                                </div>
                                <ScrollBar orientation="horizontal" />
                            </ScrollArea>
                        </div>
                    )}
                    {/* Mobile: category bottom sheet */}
                    <Sheet open={categorySheetOpen} onOpenChange={setCategorySheetOpen}>
                        <SheetContent side="bottom" className="rounded-t-2xl p-0 max-h-[70vh] flex flex-col" showCloseButton={false}>
                            <div className="shrink-0">
                                <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-muted-foreground/20" /></div>
                                <SheetHeader className="px-4 pb-3 pt-0"><SheetTitle className="text-base font-bold">Kategori</SheetTitle></SheetHeader>
                            </div>
                            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
                                <button onClick={() => { ctx.saveCategoryCache(); ctx.setSelectedCategory(""); if (!ctx.restoreCategoryCache()) void ctx.loadProducts("all", undefined, 1, true); setCategorySheetOpen(false); }}
                                    className={cn("w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all", !ctx.selectedCategory ? "bg-foreground text-background" : "bg-muted/40 text-foreground hover:bg-muted")}>
                                    <span>Semua</span>
                                    {!ctx.selectedCategory && <Check className="w-4 h-4" />}
                                </button>
                                {ctx.categories.map((c) => (
                                    <button key={c.id} onClick={() => { ctx.handleCategoryClick(c.id); setCategorySheetOpen(false); }}
                                        className={cn("w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all", ctx.selectedCategory === c.id ? "bg-foreground text-background" : "bg-muted/40 text-foreground hover:bg-muted")}>
                                        <span>{c.name}</span>
                                        {ctx.selectedCategory === c.id && <Check className="w-4 h-4" />}
                                    </button>
                                ))}
                            </div>
                        </SheetContent>
                    </Sheet>
                    {ctx.leftPanelTab === "bundles" ? (
                        <ScrollArea className="flex-1 min-h-0 overflow-hidden px-3 pb-3">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
                                {ctx.bundles.map((bundle: any) => (
                                    <button key={bundle.id} onClick={() => ctx.addBundleToCart(bundle)}
                                        className="text-left rounded-xl border border-border/40 hover:border-primary/50 hover:shadow-sm transition-all group bg-white active:scale-[0.97] overflow-hidden p-3">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shrink-0">
                                                <Package className="w-4 h-4 text-white" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-bold truncate group-hover:text-primary">{bundle.name}</p>
                                                <p className="text-[10px] text-muted-foreground">{bundle.code}</p>
                                            </div>
                                        </div>
                                        <div className="space-y-0.5 mb-2">
                                            {bundle.items.map((item: any) => (
                                                <p key={item.id} className="text-[10px] text-muted-foreground truncate">
                                                    {item.quantity}x {item.product.name}
                                                </p>
                                            ))}
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm text-primary font-bold tabular-nums">{formatCurrency(bundle.sellingPrice)}</p>
                                            {bundle.totalBasePrice > bundle.sellingPrice && (
                                                <p className="text-[10px] text-muted-foreground line-through tabular-nums">{formatCurrency(bundle.totalBasePrice)}</p>
                                            )}
                                        </div>
                                        {bundle.totalBasePrice > bundle.sellingPrice && (
                                            <div className="mt-1.5">
                                                <span className="text-[9px] font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-md">
                                                    Hemat {formatCurrency(bundle.totalBasePrice - bundle.sellingPrice)}
                                                </span>
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                            {ctx.bundles.length === 0 && (
                                <div className="py-10 text-center text-xs text-muted-foreground">Tidak ada paket tersedia</div>
                            )}
                        </ScrollArea>
                    ) : ctx.leftPanelTab === "tables" ? (
                        <ScrollArea className="flex-1 min-h-0 overflow-hidden">
                            <TableGrid
                                tables={ctx.tables}
                                selectedTables={ctx.selectedTables}
                                totalCapacity={ctx.totalTableCapacity}
                                onToggle={(table) => ctx.toggleTable(table)}
                                onClear={ctx.clearTables}
                                onConfirm={() => {
                                    if (ctx.selectedTables.length > 0 && !ctx.customerName.trim()) {
                                        const label = ctx.selectedTables.length === 1
                                            ? (ctx.selectedTables[0]!.name || `Meja ${ctx.selectedTables[0]!.number}`)
                                            : `Meja ${ctx.selectedTables.map((t) => t.number).join("+")}`;
                                        ctx.setCustomerName(label);
                                    }
                                    ctx.setLeftPanelTab("products");
                                }}
                                onRelease={ctx.handleReleaseTable}
                            />
                        </ScrollArea>
                    ) : (
                        <ScrollArea ref={ctx.productScrollRef} className="flex-1 min-h-0 overflow-hidden px-3 pb-3">
                            {productLayout === "grid" ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-2 gap-2 pt-2" style={ctx.isDesktop ? { gridTemplateColumns: `repeat(${ctx.productGridCols}, minmax(0, 1fr))` } : undefined}>
                                    {ctx.browseItems.map((p) => (
                                        <button key={p.id} onClick={() => ctx.addToCart(p)} className="text-left rounded-lg sm:rounded-xl border border-border/40 hover:border-primary/50 hover:shadow-sm transition-all group bg-white active:scale-[0.97] overflow-hidden">
                                            {p.imageUrl ? (
                                                <div className="relative aspect-[4/3] sm:aspect-square w-full bg-muted/10">
                                                    <Image src={p.imageUrl} alt={p.name} fill className="object-cover" sizes="(max-width: 1024px) 33vw, 20vw" />
                                                </div>
                                            ) : (
                                                <div className="aspect-[4/3] sm:aspect-square w-full bg-muted/20 flex items-center justify-center">
                                                    <span className="text-lg sm:text-2xl font-bold text-muted-foreground/20">{p.name.charAt(0)}</span>
                                                </div>
                                            )}
                                            <div className="p-1.5 sm:p-2">
                                                <p className="text-[10px] sm:text-[11px] font-medium truncate group-hover:text-primary transition-colors leading-tight">{p.name}</p>
                                                <p className="text-[8px] sm:text-[9px] text-muted-foreground mt-0.5">Stok: {p.stock}</p>
                                                <p className="text-[11px] sm:text-xs text-primary font-bold mt-0.5 tabular-nums">{formatCurrency(p.sellingPrice)}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-1 pt-2">
                                    {ctx.browseItems.map((p) => (
                                        <button key={p.id} onClick={() => ctx.addToCart(p)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border/40 hover:border-primary/50 hover:bg-accent/30 transition-all group bg-white active:scale-[0.99] text-left">
                                            {p.imageUrl ? (
                                                <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden bg-muted/10 shrink-0">
                                                    <Image src={p.imageUrl} alt={p.name} fill className="object-cover" sizes="56px" />
                                                </div>
                                            ) : (
                                                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-muted/20 flex items-center justify-center shrink-0">
                                                    <span className="text-base sm:text-lg font-bold text-muted-foreground/20">{p.name.charAt(0)}</span>
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs sm:text-sm font-medium truncate group-hover:text-primary transition-colors">{p.name}</p>
                                                <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5">{p.code} · Stok: {p.stock}</p>
                                            </div>
                                            <p className="text-xs sm:text-sm text-primary font-bold tabular-nums shrink-0">{formatCurrency(p.sellingPrice)}</p>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {ctx.browseHasMore && (<div ref={ctx.productSentinelRef} className="flex justify-center py-4">{ctx.browseLoading && <Loader2 className="w-5 h-5 animate-spin text-primary/40" />}</div>)}{ctx.browseItems.length === 0 && !ctx.browseLoading && (<div className="py-10 text-center text-xs text-muted-foreground">Tidak ada produk ditemukan</div>)}{!ctx.browseHasMore && ctx.browseItems.length > 0 && (<p className="text-center text-[10px] text-muted-foreground/50 py-3">Semua produk ditampilkan</p>)}</ScrollArea>
                    )}
                    <div className="px-3 py-2 border-t border-border/30 hidden lg:flex gap-1">
                        <button onClick={() => ctx.setShowSearchDialog(true)} className="flex-1 text-[10px] font-medium text-muted-foreground hover:text-primary py-1.5 rounded-md hover:bg-accent transition-all"><span className="font-mono text-[9px] bg-muted/80 px-1 py-0.5 rounded mr-1">F1</span>Cari</button>
                        <ProButton menuKey="pos" actionKey="hold" onClick={() => ctx.heldTransactions.length > 0 ? ctx.setShowHeldDialog(true) : ctx.holdTransaction()} className="flex-1 text-[10px] font-medium text-muted-foreground hover:text-primary py-1.5 rounded-md hover:bg-accent transition-all"><span className="font-mono text-[9px] bg-muted/80 px-1 py-0.5 rounded mr-1">F2</span>{ctx.heldTransactions.length > 0 ? `Hold (${ctx.heldTransactions.length})` : "Hold"}</ProButton>
                        <ProButton menuKey="pos" actionKey="discount" onClick={() => { if (!ctx.canPosAction("discount")) return; ctx.setShowDiscountDialog(true); }} className="flex-1 text-[10px] font-medium text-muted-foreground hover:text-primary py-1.5 rounded-md hover:bg-accent transition-all"><span className="font-mono text-[9px] bg-muted/80 px-1 py-0.5 rounded mr-1">F5</span>Diskon</ProButton>
                        <ProButton menuKey="pos" actionKey="history" onClick={() => { void ctx.loadHistory(); }} className="flex-1 text-[10px] font-medium text-muted-foreground hover:text-primary py-1.5 rounded-md hover:bg-accent transition-all"><span className="font-mono text-[9px] bg-muted/80 px-1 py-0.5 rounded mr-1">F6</span>Riwayat</ProButton>
                    </div>
                </div>
                {ctx.isDesktop && (<div role="separator" aria-orientation="vertical" onMouseDown={ctx.startResizeLeftPanel} className={cn("hidden lg:flex w-1.5 cursor-col-resize shrink-0 items-center justify-center bg-border/20 hover:bg-primary/20 transition-colors", ctx.isResizingLeftPanel && "bg-primary/30")}><div className="h-14 w-[2px] rounded-full bg-muted-foreground/40" /></div>)}
                <div ref={ctx.centerPanelRef} className={cn("flex-1 flex flex-col min-w-0 bg-[#F1F5F9]", "md:min-w-[300px] lg:min-w-[380px]", "w-full lg:w-auto", "absolute inset-0 md:relative md:inset-auto", "pb-16 lg:pb-0", ctx.mobileView === "cart" ? "z-10 flex" : "z-0 hidden md:flex")}>
                    <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-border/40 lg:hidden"><Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => ctx.setMobileView("products")}><ArrowLeft className="w-4 h-4" /></Button><h2 className="font-bold text-sm">Keranjang</h2><div className="flex gap-1"><ProButton menuKey="pos" actionKey="discount" onClick={() => ctx.setShowDiscountDialog(true)} className="h-8 w-8 rounded-lg inline-flex items-center justify-center hover:bg-accent"><Tag className="w-4 h-4" /></ProButton><ProButton menuKey="pos" actionKey="history" onClick={() => { void ctx.loadHistory(); }} className="h-8 w-8 rounded-lg inline-flex items-center justify-center hover:bg-accent"><History className="w-4 h-4" /></ProButton></div></div>
                    <div className="px-3 sm:px-5 py-2 sm:py-3 bg-white border-b border-border/40"><div className="relative"><Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground/50" /><Input ref={ctx.barcodeInputRef} placeholder="Scan barcode / cari produk..." value={ctx.searchQuery} onChange={(e) => ctx.handleBarcodeInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && ctx.searchResults.length > 0) { const first = ctx.searchResults[0]; if (first) ctx.addToCart(first); } }} className="pl-10 sm:pl-12 pr-12 h-10 lg:h-12 rounded-xl text-sm sm:text-base border-2 border-border/50 focus:border-primary/50 bg-muted/20" autoFocus />{ctx.searching ? <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-primary/40" /> : <button onClick={() => setScannerOpen(true)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-primary/60 hover:text-primary hover:bg-primary/10 transition-colors" title="Scan barcode dengan kamera"><ScanBarcode className="w-4 h-4 sm:w-5 sm:h-5" /></button>}</div>{ctx.searchResults.length > 0 && (<div className="mt-2 border border-border/50 rounded-xl overflow-hidden max-h-[240px] overflow-y-auto bg-white divide-y divide-border/20">{ctx.searchResults.map((p) => (<button key={p.id} onClick={() => ctx.addToCart(p)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/40 transition-colors text-left"><div><p className="font-medium text-sm">{p.name}</p><p className="text-xs text-muted-foreground">{p.code} &middot; {p.category.name} &middot; Stok: {p.stock}</p></div><p className="font-bold text-primary tabular-nums">{formatCurrency(p.sellingPrice)}</p></button>))}</div>)}</div>
                    {(ctx.negativeMarginItems.length > 0 || ctx.lowStockItems.length > 0) && (<div className="px-5 py-1.5 flex gap-2">{ctx.negativeMarginItems.length > 0 && <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 rounded-md text-[11px] text-red-500"><AlertTriangle className="w-3 h-3" />Margin negatif: {ctx.negativeMarginItems.map((i) => i.productName).join(", ")}</div>}{ctx.lowStockItems.length > 0 && <div className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 rounded-md text-[11px] text-orange-500"><AlertTriangle className="w-3 h-3" />Stok menipis</div>}</div>)}
                    <div className="flex-1 flex flex-col min-h-0 px-3 sm:px-1 py-2 sm:py-3"><div className="bg-white rounded-xl sm:rounded-2xl border border-border/40 flex-1 flex flex-col overflow-hidden shadow-sm"><div className="px-3 sm:px-5 py-2 sm:py-3 border-b border-border/30 flex items-center justify-between shrink-0"><div className="flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-primary" /><span className="font-semibold text-xs sm:text-sm">Keranjang</span>{ctx.totalItems > 0 && <Badge className="bg-primary/10 text-primary rounded-full text-xs px-2 h-5">{ctx.totalItems} item</Badge>}</div>{(ctx.cart.length > 0 || ctx.heldTransactions.length > 0) && (<div className="flex gap-1.5">{ctx.heldTransactions.length > 0 && (<Button variant="ghost" size="sm" className="h-7 text-xs text-primary hover:bg-primary/10 rounded-lg" onClick={() => ctx.setShowHeldDialog(true)}>Lihat Hold ({ctx.heldTransactions.length})</Button>)}{ctx.cart.length > 0 && (<><ProButton menuKey="pos" actionKey="hold" onClick={ctx.holdTransaction} className="h-7 text-xs text-orange-500 hover:bg-orange-50 rounded-lg inline-flex items-center gap-1 px-2"><Pause className="w-3 h-3" />Hold</ProButton><Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-lg" onClick={ctx.resetPOS}>Clear</Button></>)}</div>)}</div><ScrollArea className="flex-1 min-h-0 overflow-hidden">{ctx.cart.length === 0 ? (<div className="flex flex-col items-center justify-center h-full py-16 text-muted-foreground/40"><ShoppingCart className="w-14 h-14 mb-3" /><p className="font-medium">Keranjang kosong</p><p className="text-xs mt-1">Scan barcode atau pilih produk</p>{ctx.heldTransactions.length > 0 && (<Button variant="outline" size="sm" className="mt-4 rounded-lg" onClick={() => ctx.setShowHeldDialog(true)}>Lihat Transaksi Hold ({ctx.heldTransactions.length})</Button>)}</div>) : (<div className="p-3 space-y-1">{ctx.cart.map((item, idx) => {
                        const itemPromo = ctx.promoMeta.byItem[item.productId];
                        const freeQty = ctx.promoMeta.freeQtyByItem[item.productId] ?? 0;
                        const displayQty = item.quantity + freeQty;
                        const lineKey = item.lineId ?? item.productId;
                        const hasUnit = item.unitName && item.conversionQty && item.conversionQty > 1;
                        return (
                            <div key={lineKey} className={cn("rounded-xl hover:bg-muted/30 transition-colors group", ctx.isCompactCart ? "px-2 py-1.5" : "px-1 py-2")}>
                                {/* Row 1: Product info + subtotal + delete */}
                                <div className="flex items-start gap-1.5">
                                    {!ctx.isCompactCart && <span className="text-[9px] text-muted-foreground/40 w-3 text-center tabular-nums mt-0.5">{idx + 1}</span>}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-1.5">
                                            <div className="min-w-0 flex-1">
                                                <p className="font-medium text-xs truncate leading-tight">{item.productName}</p>
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    <span className="text-[11px] text-muted-foreground tabular-nums">{formatCurrency(item.unitPrice)}</span>
                                                    {hasUnit && (
                                                        <Badge className="h-3.5 px-1 text-[8px] font-semibold bg-indigo-50 text-indigo-600 border-0 rounded-md">
                                                            {item.unitName}
                                                        </Badge>
                                                    )}
                                                </div>
                                                {itemPromo && (<p className="text-[9px] text-green-600 truncate mt-0.5">{itemPromo.names.join(", ")} · -{formatCurrency(itemPromo.discount)}</p>)}
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <p className={cn("text-right font-bold text-xs tabular-nums", ctx.isCompactCart ? "min-w-[60px]" : "min-w-[75px]")}>{formatCurrency(item.subtotal)}</p>
                                                <button onClick={() => ctx.removeItem(lineKey)} className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500 p-0.5 -mr-0.5"><Trash2 className="w-3 h-3" /></button>
                                            </div>
                                        </div>
                                        {/* Row 2: Qty controls */}
                                        <div className="flex items-center justify-between mt-1">
                                            <div className="flex items-center gap-0.5">
                                                <Button variant="outline" size="icon" className="h-6 w-6 rounded-md" onClick={() => ctx.updateQuantity(lineKey, -1)} disabled={item.quantity <= 1}><Minus className="w-2.5 h-2.5" /></Button>
                                                <CartQtyInput value={displayQty} onChange={(qty) => ctx.setItemQuantity(lineKey, qty)} />
                                                <Button variant="outline" size="icon" className="h-6 w-6 rounded-md" onClick={() => ctx.updateQuantity(lineKey, 1)}><Plus className="w-2.5 h-2.5" /></Button>
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
                    })}</div>)}</ScrollArea></div></div>
                </div>
                <div className={cn("bg-white border-l border-border/40 flex flex-col shrink-0", "w-full lg:w-[340px]", "absolute inset-0 lg:relative lg:inset-auto", "pb-16 lg:pb-0", ctx.mobileView === "payment" ? "z-10 flex" : "z-0 hidden lg:flex")}>
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 lg:hidden"><Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => ctx.setMobileView("cart")}><ArrowLeft className="w-4 h-4" /></Button><h2 className="font-bold text-sm">Pembayaran</h2><div className="w-8" /></div>
                    <div className="flex-1 overflow-y-auto min-h-0">
                        <div className="p-3 sm:p-5 space-y-3 sm:space-y-4">
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs sm:text-sm">
                                    <span className="text-muted-foreground">Subtotal</span>
                                    <span className="tabular-nums font-medium">{formatCurrency(ctx.subtotal)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs sm:text-sm text-muted-foreground flex-1">Diskon</span>
                                    <Input disabled={!ctx.canPosAction("discount")} type="number" value={ctx.discountPercent} onChange={(e) => ctx.setDiscountPercent(Number(e.target.value))} className="w-12 sm:w-14 h-7 text-right rounded-md text-xs" min={0} max={100} />
                                    <span className="text-xs text-muted-foreground">%</span>
                                </div>
                                {ctx.canPosAction("discount") && ctx.discountAmount > 0 && <div className="flex justify-between text-xs sm:text-sm text-red-500">
                                    <span>Diskon</span>
                                    <span className="tabular-nums">-{formatCurrency(ctx.discountAmount)}</span>
                                </div>
                                }
                                <div className="flex items-center gap-2">
                                    <span className="text-xs sm:text-sm text-muted-foreground flex-1">Pajak</span>
                                    <Input type="number" value={ctx.taxPercent} onChange={(e) => ctx.setTaxPercent(Number(e.target.value))} className="w-12 sm:w-14 h-7 text-right rounded-md text-xs" min={0} max={100} />
                                    <span className="text-xs text-muted-foreground">%</span>
                                </div>
                                {ctx.taxAmount > 0 && <div className="flex justify-between text-xs sm:text-sm">
                                    <span className="text-muted-foreground">Pajak</span>
                                    <span className="tabular-nums">{formatCurrency(ctx.taxAmount)}</span>
                                </div>
                                }
                            </div>
                            <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-3 sm:p-4 border border-primary/10">
                                <p className="text-[10px] sm:text-xs font-medium text-primary/60 uppercase tracking-wider">Total Bayar</p>
                                <p className="text-xl sm:text-3xl font-bold text-primary tabular-nums tracking-tight mt-0.5 sm:mt-1">
                                    {formatCurrency(ctx.grandTotal)}
                                </p>
                            </div>
                            {ctx.appliedPromos.length > 0 && (<div className="space-y-1">
                                <p className="text-[10px] font-semibold text-green-600 uppercase tracking-wider">Promo Aktif</p>
                                {Object.values(ctx.promoMeta.byItem).length > 0 && (<div className="text-[11px] text-green-700 bg-green-50/60 rounded-lg px-3 py-1.5">Promo item aktif di {Object.keys(ctx.promoMeta.byItem).length} produk (lihat di baris produk)</div>)}
                            </div>
                            )}
                            {ctx.tebusMurahOptions.length > 0 && (<div className="space-y-1.5">
                                <p className="text-[10px] font-semibold text-pink-600 uppercase tracking-wider">Promo Tebus Murah</p>
                                {ctx.tebusMurahOptions.map((option) => (
                                    <div key={option.promoId} className="rounded-lg border border-pink-100 bg-pink-50/40 px-3 py-2 space-y-1.5">
                                        <p className="text-xs font-semibold text-pink-700">{option.promoName}</p>
                                        <p className="text-[11px] text-pink-700/90">{option.triggerLabel}</p>
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="text-xs font-medium truncate">
                                                    {option.product.name}
                                                </p>
                                                <p className="text-[11px] text-pink-700/90">Tebus {formatCurrency(option.tebusPrice)} · Sisa {option.remainingQty}</p>
                                            </div>
                                            <Button size="sm" variant="outline" className="h-7 rounded-md border-pink-200 text-pink-700 hover:bg-pink-100" onClick={() => ctx.handleAddTebusMurah(option)} disabled={option.remainingQty <= 0}>Tebus</Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            )}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                                    {ctx.businessMode === "restaurant" ? "Atas Nama / No. Meja" : "Atas Nama"} {ctx.requireCustomer && <span className="text-red-500">*</span>}
                                </label>
                                {ctx.requireCustomer && !ctx.customerName.trim() && !ctx.detectedCustomer && (<div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 rounded-lg text-[11px] text-red-600 font-medium">
                                    <AlertTriangle className="w-3 h-3 shrink-0" />Nama customer wajib diisi</div>
                                )}
                                <Input placeholder="Nama customer..." value={ctx.customerName} onChange={(e) => ctx.setCustomerName(e.target.value)} className={cn("rounded-lg h-8 text-sm", ctx.requireCustomer && !ctx.customerName.trim() && !ctx.detectedCustomer && "border-red-300 focus:border-red-400")} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Member</label>
                                <CustomerPhoneInput value={ctx.customerPhone} onChange={ctx.handleCustomerPhoneChange} />
                                {ctx.detectedCustomer && (<div className="bg-purple-50/60 rounded-lg px-3 py-2 space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-semibold text-purple-700">{ctx.detectedCustomer.name}</p>
                                        <Badge className="bg-purple-100 text-purple-700 text-[10px]">{ctx.detectedCustomer.memberLevel}</Badge>
                                    </div>
                                    <p className="text-[11px] text-purple-500">{ctx.detectedCustomer.points} poin tersedia</p>
                                    {ctx.detectedCustomer.points >= 10 && (<div className="flex gap-1.5 items-center pt-0.5">
                                        <Input type="number" min={10} max={ctx.detectedCustomer.points} value={ctx.redeemPointsInput || ""} onChange={(e) => ctx.setRedeemPointsInput(Number(e.target.value))} placeholder="Jumlah poin" className="h-7 text-xs flex-1 rounded-md" />
                                        <Button size="sm" variant="outline" className="h-7 text-[10px] px-2 rounded-md border-purple-300 text-purple-600 hover:bg-purple-50" onClick={ctx.handleRedeemPoints} disabled={ctx.redeemPointsInput < 10 || ctx.redeemPointsInput > ctx.detectedCustomer.points || !ctx.canPosAction("redeem_points")}>Tukar</Button></div>)}
                                    {ctx.redeemDiscount > 0 && (
                                        <div className="flex justify-between text-xs bg-purple-100/60 rounded-md px-2 py-1">
                                            <span className="text-purple-700">Redeem {ctx.redeemPointsInput} poin</span>
                                            <span className="text-purple-600 font-medium">-{formatCurrency(ctx.redeemDiscount)}</span>
                                        </div>
                                    )}
                                </div>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Voucher</label>
                                <div className="flex gap-1.5"><Input placeholder="Kode" value={ctx.voucherCode} onChange={(e) => ctx.setVoucherCode(e.target.value.toUpperCase())} className="rounded-lg h-8 text-sm flex-1" />
                                    <Button size="sm" variant="outline" className="rounded-lg h-8 text-xs px-3" onClick={() => { void ctx.handleApplyVoucher(); }} disabled={!ctx.voucherCode || !ctx.canPosAction("voucher")}>Apply</Button>
                                </div>
                                {ctx.voucherApplied && <div className="flex justify-between text-xs bg-green-50/60 rounded-lg px-3 py-1.5">
                                    <span className="text-green-700">{ctx.voucherApplied}</span>
                                    <span className="text-green-600 font-medium">-{formatCurrency(ctx.voucherDiscount)}</span>
                                </div>
                                }
                            </div>
                            <div className="rounded-xl border border-dashed border-border/60 p-3 text-xs text-muted-foreground">Atur metode pembayaran dan nominal saat klik tombol bayar.</div>
                        </div>
                    </div>
                    <div className="p-3 sm:p-4 border-t border-border/30 bg-white shrink-0"><Button className="w-full h-12 sm:h-14 rounded-xl text-sm sm:text-lg font-bold shadow-lg hover:shadow-xl transition-all" onClick={ctx.openPaymentDialog} disabled={ctx.loading || ctx.cart.length === 0}><CreditCard className="mr-1.5 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />Bayar {formatCurrency(ctx.grandTotal)}</Button></div>
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
            <BarcodeScannerDialog open={scannerOpen} onOpenChange={setScannerOpen} onScan={(code) => { ctx.handleBarcodeInput(code); }} />
        </>
    );
}

type TableItem = { id: string; number: number; name: string | null; capacity: number; status: string; section: string | null };

const TABLE_STATUS_CONFIG: Record<string, { label: string; dotColor: string; borderColor: string; bgColor: string; textColor: string; selectable: boolean }> = {
    AVAILABLE: { label: "Kosong", dotColor: "bg-emerald-500", borderColor: "border-emerald-300", bgColor: "bg-emerald-50/50", textColor: "text-emerald-700", selectable: true },
    OCCUPIED: { label: "Terisi", dotColor: "bg-red-500 animate-pulse", borderColor: "border-red-300", bgColor: "bg-red-50/50", textColor: "text-red-600", selectable: false },
    RESERVED: { label: "Dipesan", dotColor: "bg-amber-500", borderColor: "border-amber-300", bgColor: "bg-amber-50/50", textColor: "text-amber-600", selectable: false },
    CLEANING: { label: "Dibersihkan", dotColor: "bg-gray-400", borderColor: "border-gray-300", bgColor: "bg-gray-50", textColor: "text-gray-500", selectable: false },
};

type SelectedTable = { id: string; number: number; name: string | null; capacity: number };

function TableGrid({ tables, selectedTables, totalCapacity, onToggle, onClear, onConfirm, onRelease }: {
    tables: TableItem[];
    selectedTables: SelectedTable[];
    totalCapacity: number;
    onToggle: (table: SelectedTable) => void;
    onClear: () => void;
    onConfirm: () => void;
    onRelease: (tableId: string) => void;
}) {
    const selectedIds = new Set(selectedTables.map((t) => t.id));

    const sections = new Map<string, TableItem[]>();
    for (const t of tables) {
        const key = t.section || "Lainnya";
        if (!sections.has(key)) sections.set(key, []);
        sections.get(key)!.push(t);
    }

    const available = tables.filter((t) => t.status === "AVAILABLE").length;
    const occupied = tables.filter((t) => t.status === "OCCUPIED").length;

    return (
        <div className="p-3 space-y-3 flex flex-col h-full">
            {/* Selected tables summary */}
            {selectedTables.length > 0 && (
                <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 space-y-2 shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-primary">
                                {selectedTables.length > 1 ? "Gabung Meja" : "Meja Dipilih"}
                            </span>
                            <Badge className="bg-primary/10 text-primary text-[10px] px-1.5 h-4 rounded-md">
                                {selectedTables.map((t) => `#${t.number}`).join(" + ")}
                            </Badge>
                        </div>
                        <button onClick={onClear} className="text-[10px] text-muted-foreground hover:text-red-500 transition-colors">Reset</button>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Users className="w-3.5 h-3.5" />
                            <span>Kapasitas total: <span className="font-bold text-foreground">{totalCapacity} orang</span></span>
                        </div>
                        <Button size="sm" className="h-7 rounded-lg text-[11px] px-3 gap-1" onClick={onConfirm}>
                            Konfirmasi
                        </Button>
                    </div>
                </div>
            )}

            {/* Stats bar */}
            <div className="flex items-center gap-3 px-1 shrink-0">
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[10px] text-muted-foreground">{available} Kosong</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-[10px] text-muted-foreground">{occupied} Terisi</span>
                </div>
                {tables.length - available - occupied > 0 && (
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                        <span className="text-[10px] text-muted-foreground">{tables.length - available - occupied} Lainnya</span>
                    </div>
                )}
            </div>

            {/* Section grids */}
            <div className="flex-1 overflow-y-auto space-y-3">
                {Array.from(sections.entries()).map(([section, sectionTables]) => (
                    <div key={section}>
                        <div className="flex items-center gap-2 mb-2 px-1">
                            <div className="w-1 h-3.5 bg-primary rounded-full" />
                            <p className="text-[10px] font-bold text-foreground uppercase tracking-widest">{section}</p>
                            <span className="text-[10px] text-muted-foreground">({sectionTables.length})</span>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {sectionTables.map((table) => {
                                const isSelected = selectedIds.has(table.id);
                                const cfg = (TABLE_STATUS_CONFIG[table.status] ?? TABLE_STATUS_CONFIG["AVAILABLE"])!;

                                return (
                                    <div key={table.id} className="relative group">
                                        <button
                                            onClick={() => cfg.selectable && onToggle({ id: table.id, number: table.number, name: table.name, capacity: table.capacity })}
                                            disabled={!cfg.selectable}
                                            className={cn(
                                                "w-full rounded-xl border-2 p-2.5 text-center transition-all relative overflow-hidden",
                                                isSelected
                                                    ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm"
                                                    : `${cfg.borderColor} ${cfg.bgColor}`,
                                                cfg.selectable ? "hover:shadow-md active:scale-[0.97]" : "cursor-not-allowed"
                                            )}
                                        >
                                            {/* Status dot */}
                                            <div className="absolute top-2 right-2">
                                                <div className={cn("w-2.5 h-2.5 rounded-full", cfg.dotColor)} />
                                            </div>

                                            {/* Selected checkmark */}
                                            {isSelected && (
                                                <div className="absolute top-1.5 left-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                                                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                                </div>
                                            )}

                                            <p className={cn(
                                                "text-2xl font-black tabular-nums leading-tight",
                                                isSelected ? "text-primary" : cfg.selectable ? "text-foreground" : "text-muted-foreground/60"
                                            )}>
                                                {table.number}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                                                {table.name || `Meja ${table.number}`}
                                            </p>
                                            <div className="flex items-center justify-center gap-1.5 mt-1.5">
                                                <div className="flex items-center gap-0.5">
                                                    <Users className="w-3 h-3 text-muted-foreground/60" />
                                                    <span className="text-[10px] text-muted-foreground/60">{table.capacity}</span>
                                                </div>
                                                <span className="text-muted-foreground/30">·</span>
                                                <span className={cn("text-[9px] font-semibold", cfg.textColor)}>{cfg.label}</span>
                                            </div>
                                        </button>

                                        {/* Release button — visible on hover for OCCUPIED tables */}
                                        {table.status === "OCCUPIED" && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onRelease(table.id); }}
                                                className="absolute inset-0 rounded-xl bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1"
                                            >
                                                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                                                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                                                </div>
                                                <span className="text-[10px] font-bold text-white">Kosongkan</span>
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {tables.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/40">
                    <Users className="w-10 h-10 mb-2" />
                    <p className="text-sm font-medium text-muted-foreground">Belum ada meja</p>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">Tambahkan meja di pengaturan</p>
                </div>
            )}
        </div>
    );
}

function CartQtyInput({ value, onChange }: { value: number; onChange: (qty: number) => void }) {
    const [localVal, setLocalVal] = useState(String(value));
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevValue = useRef(value);

    // Sync external value changes (from +/- buttons)
    if (prevValue.current !== value) {
        prevValue.current = value;
        setLocalVal(String(value));
    }

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/[^0-9]/g, "");
        setLocalVal(raw);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            const num = Number(raw);
            if (num >= 1) onChange(num);
        }, 400);
    }, [onChange]);

    const handleBlur = useCallback(() => {
        const num = Number(localVal);
        if (num < 1) { setLocalVal(String(value)); return; }
        if (debounceRef.current) clearTimeout(debounceRef.current);
        onChange(num);
    }, [localVal, value, onChange]);

    return (
        <input
            type="text"
            inputMode="numeric"
            value={localVal}
            onChange={handleChange}
            onBlur={handleBlur}
            onFocus={(e) => e.target.select()}
            className="text-center font-bold text-xs tabular-nums w-9 h-6 rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
    );
}

function CustomerPhoneInput({ value, onChange }: { value: string; onChange: (phone: string) => void }) {
    const [localVal, setLocalVal] = useState(value);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevValue = useRef(value);

    if (prevValue.current !== value && value !== localVal) {
        prevValue.current = value;
        setLocalVal(value);
    }

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/[^0-9+\-() ]/g, "");
        setLocalVal(raw);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            onChange(raw);
        }, 500);
    }, [onChange]);

    return (
        <Input
            placeholder="No. HP member (opsional)..."
            value={localVal}
            onChange={handleChange}
            className="rounded-lg h-8 text-sm"
            inputMode="tel"
        />
    );
}
