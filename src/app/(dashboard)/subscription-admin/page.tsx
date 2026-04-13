"use client";

import { useEffect, useState } from "react";
import { getAllCompanies, updateCompanyPlan, extendCompanyPlan, revokeCompanyPlan, getSubscriptionHistory } from "@/server/actions/subscription-admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { ActionConfirmDialog } from "@/components/ui/action-confirm-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { PLAN_UI } from "@/lib/plan-ui";
import { Building2, Calendar, Check, Crown, ListFilter, Loader2, Package, Plus, RotateCcw, Search, Shield, Users, Zap } from "lucide-react";
import { toast } from "sonner";
import type { PlanKey } from "@/lib/plan-config";

type Company = Awaited<ReturnType<typeof getAllCompanies>>[number];

type PaymentHistory = Awaited<ReturnType<typeof getSubscriptionHistory>>[number];

const statusColors: Record<string, string> = {
    PAID: "bg-emerald-100 text-emerald-700",
    PENDING: "bg-amber-100 text-amber-700",
    CANCELLED: "bg-red-100 text-red-700",
    REFUNDED: "bg-slate-100 text-slate-700",
};

function formatCurrency(v: number) {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v);
}

export default function SubscriptionAdminPage() {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [history, setHistory] = useState<PaymentHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [activeTab, setActiveTab] = useState<"companies" | "history">("companies");
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [dialogMode, setDialogMode] = useState<"upgrade" | "extend" | null>(null);
    const [planForm, setPlanForm] = useState<PlanKey>("PRO");
    const [durationMonths, setDurationMonths] = useState(1);
    const [billingType, setBillingType] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
    const [amountOverride, setAmountOverride] = useState("");
    const [paymentNotes, setPaymentNotes] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [revokeTarget, setRevokeTarget] = useState<Company | null>(null);
    const [mobileTabSheetOpen, setMobileTabSheetOpen] = useState(false);

    const loadData = () => {
        setLoading(true);
        Promise.all([getAllCompanies(), getSubscriptionHistory()])
            .then(([c, h]) => { setCompanies(c); setHistory(h); })
            .catch(() => toast.error("Gagal memuat data"))
            .finally(() => setLoading(false));
    };

    useEffect(() => { loadData(); }, []);

    const filtered = search
        ? companies.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase()))
        : companies;

    const handleUpgrade = async () => {
        if (!selectedCompany) return;
        setSubmitting(true);
        try {
            await updateCompanyPlan({
                companyId: selectedCompany.id, plan: planForm, durationMonths, billingType,
                amount: amountOverride ? Number(amountOverride) : undefined,
                notes: paymentNotes || undefined,
            });
            toast.success(`${selectedCompany.name} di-upgrade ke ${planForm}`);
            setDialogMode(null); setSelectedCompany(null);
            setAmountOverride(""); setPaymentNotes("");
            loadData();
        } catch { toast.error("Gagal upgrade"); }
        setSubmitting(false);
    };

    const handleExtend = async () => {
        if (!selectedCompany) return;
        setSubmitting(true);
        try {
            const result = await extendCompanyPlan({
                companyId: selectedCompany.id, additionalMonths: durationMonths, billingType,
                amount: amountOverride ? Number(amountOverride) : undefined,
                notes: paymentNotes || undefined,
            });
            toast.success(`Masa aktif diperpanjang hingga ${new Date(result.expiresAt).toLocaleDateString("id-ID")}`);
            setDialogMode(null); setSelectedCompany(null);
            setAmountOverride(""); setPaymentNotes("");
            loadData();
        } catch { toast.error("Gagal perpanjang"); }
        setSubmitting(false);
    };

    const handleRevoke = async () => {
        if (!revokeTarget) return;
        setSubmitting(true);
        try {
            await revokeCompanyPlan(revokeTarget.id);
            toast.success(`${revokeTarget.name} di-downgrade ke FREE`);
            setRevokeTarget(null);
            loadData();
        } catch { toast.error("Gagal downgrade"); }
        setSubmitting(false);
    };

    const isExpired = (c: Company) => c.planExpiresAt && new Date(c.planExpiresAt) < new Date();

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-2.5 sm:gap-3">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                        <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg sm:text-2xl font-bold">Manajemen Subscription</h1>
                        <p className="text-xs sm:text-sm text-muted-foreground">Kelola plan dan langganan perusahaan</p>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                <div className="rounded-xl border p-2.5 sm:p-3 flex items-center gap-2.5 sm:gap-3">
                    <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                    <div>
                        <p className="text-base sm:text-lg font-bold">{companies.length}</p>
                        <p className="text-[10px] text-muted-foreground">Total Perusahaan</p>
                    </div>
                </div>
                <div className="rounded-xl border p-2.5 sm:p-3 flex items-center gap-2.5 sm:gap-3">
                    <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />
                    <div>
                        <p className="text-base sm:text-lg font-bold">{companies.filter((c) => c.plan === "FREE").length}</p>
                        <p className="text-[10px] text-muted-foreground">Free</p>
                    </div>
                </div>
                <div className="rounded-xl border p-2.5 sm:p-3 flex items-center gap-2.5 sm:gap-3">
                    <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
                    <div>
                        <p className="text-base sm:text-lg font-bold">{companies.filter((c) => c.plan === "PRO").length}</p>
                        <p className="text-[10px] text-muted-foreground">Pro</p>
                    </div>
                </div>
                <div className="rounded-xl border p-2.5 sm:p-3 flex items-center gap-2.5 sm:gap-3">
                    <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" />
                    <div>
                        <p className="text-base sm:text-lg font-bold">{companies.filter((c) => c.plan === "ENTERPRISE").length}</p>
                        <p className="text-[10px] text-muted-foreground">Enterprise</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="hidden sm:flex items-center gap-1 bg-muted rounded-xl p-1 w-full sm:w-fit overflow-x-auto">
                <button onClick={() => setActiveTab("companies")} className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all", activeTab === "companies" ? "bg-white shadow-sm" : "text-muted-foreground")}>
                    Perusahaan
                </button>
                <button onClick={() => setActiveTab("history")} className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all", activeTab === "history" ? "bg-white shadow-sm" : "text-muted-foreground")}>
                    Riwayat Pembayaran
                    {history.length > 0 && <Badge className="ml-1.5 bg-primary/10 text-primary text-[10px] px-1.5 py-0 rounded-full">{history.length}</Badge>}
                </button>
            </div>

            {/* Search */}
            <div className="flex items-center gap-2 w-full sm:max-w-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={activeTab === "companies" ? "Cari perusahaan..." : "Cari riwayat..."} className="pl-9 rounded-xl h-9 sm:h-10 text-sm" />
                </div>
                <Button variant="outline" size="icon" className="sm:hidden rounded-xl shrink-0" onClick={() => setMobileTabSheetOpen(true)}>
                    <ListFilter className="w-4 h-4" />
                </Button>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : activeTab === "history" ? (
                /* Payment History */
                <div className="space-y-2">
                    {history.filter((h) => !search || h.companyName.toLowerCase().includes(search.toLowerCase())).map((p) => (
                        <div key={p.id} className="rounded-xl border border-border/60 bg-white p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-semibold text-sm">{p.companyName}</p>
                                    <Badge className={cn("text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0 rounded-full", (PLAN_UI[p.plan as keyof typeof PLAN_UI] || PLAN_UI.FREE).badgeClassName)}>
                                        {(PLAN_UI[p.plan as keyof typeof PLAN_UI] || PLAN_UI.FREE).name}
                                    </Badge>
                                    <Badge className={cn("text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0 rounded-full", statusColors[p.status])}>{p.status}</Badge>
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground flex-wrap">
                                    <span>{p.durationMonths} bulan ({p.billingType === "YEARLY" ? "Tahunan" : "Bulanan"})</span>
                                    <span>{new Date(p.planStartDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })} — {new Date(p.planEndDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</span>
                                    {p.notes && <span className="italic">{p.notes}</span>}
                                </div>
                            </div>
                            <div className="text-left sm:text-right shrink-0">
                                <p className="font-bold text-xs sm:text-sm tabular-nums">{formatCurrency(p.amount)}</p>
                                <p className="text-[10px] text-muted-foreground">{new Date(p.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                            </div>
                        </div>
                    ))}
                    {history.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Belum ada riwayat pembayaran</p>}
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map((c) => {
                        const planMeta = PLAN_UI[c.plan as keyof typeof PLAN_UI] || PLAN_UI.FREE;
                        const PlanIcon = planMeta.icon;
                        const expired = isExpired(c);
                        return (
                            <div key={c.id} className="rounded-xl border border-border/60 bg-white p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-semibold text-sm truncate">{c.name}</p>
                                        <Badge className={cn("text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0 rounded-full", planMeta.badgeClassName)}>
                                            <PlanIcon className="w-3 h-3 mr-1" />{planMeta.name}
                                        </Badge>
                                        {expired && <Badge className="bg-red-100 text-red-700 text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0 rounded-full">Expired</Badge>}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5">{c.email || c.slug}</p>
                                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{c._count.users} user</span>
                                        <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{c._count.branches} cabang</span>
                                        <span className="flex items-center gap-1"><Package className="w-3 h-3" />{c._count.products} produk</span>
                                        {c.planExpiresAt && (
                                            <span className={cn("flex items-center gap-1", expired ? "text-red-500" : "")}>
                                                <Calendar className="w-3 h-3" />
                                                {expired ? "Expired" : "s/d"} {new Date(c.planExpiresAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto overflow-x-auto py-0.5">
                                    {c.plan === "FREE" ? (
                                        <Button size="sm" className="rounded-lg text-[11px] sm:text-xs h-7 sm:h-8 px-2.5 sm:px-3 bg-gradient-to-r from-amber-500 to-orange-500 shrink-0" onClick={() => { setSelectedCompany(c); setPlanForm("PRO"); setDurationMonths(1); setDialogMode("upgrade"); }}>
                                            <Crown className="w-3 h-3 mr-1" /> Upgrade
                                        </Button>
                                    ) : (
                                        <>
                                            <Button size="sm" variant="outline" className="rounded-lg text-[11px] sm:text-xs h-7 sm:h-8 px-2.5 sm:px-3 shrink-0" onClick={() => { setSelectedCompany(c); setDurationMonths(1); setDialogMode("extend"); }}>
                                                <Plus className="w-3 h-3 mr-1" /> Perpanjang
                                            </Button>
                                            <Button size="sm" variant="outline" className="rounded-lg text-[11px] sm:text-xs h-7 sm:h-8 px-2.5 sm:px-3 shrink-0" onClick={() => { setSelectedCompany(c); setPlanForm(c.plan as PlanKey); setDurationMonths(1); setDialogMode("upgrade"); }}>
                                                Ubah Plan
                                            </Button>
                                            <Button size="sm" variant="ghost" className="rounded-lg text-[11px] sm:text-xs h-7 sm:h-8 px-2.5 sm:px-3 text-red-500 hover:bg-red-50 shrink-0" onClick={() => setRevokeTarget(c)}>
                                                <RotateCcw className="w-3 h-3" />
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Tidak ada perusahaan ditemukan</p>}
                </div>
            )}

            {/* Upgrade/Change Plan Dialog */}
            <Dialog open={dialogMode === "upgrade"} onOpenChange={(v) => { if (!v) { setDialogMode(null); setSelectedCompany(null); } }}>
                <DialogContent className="rounded-2xl max-w-[calc(100vw-1rem)] sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Crown className="w-5 h-5 text-amber-500" />
                            {selectedCompany?.plan === "FREE" ? "Upgrade Plan" : "Ubah Plan"}
                        </DialogTitle>
                    </DialogHeader>
                    <DialogBody className="space-y-3 sm:space-y-4">
                        <div className="rounded-xl bg-muted/30 p-2.5 sm:p-3 text-xs sm:text-sm">
                            <p className="font-medium">{selectedCompany?.name}</p>
                            <p className="text-xs text-muted-foreground">Plan saat ini: {selectedCompany?.plan}</p>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm">Plan Baru</Label>
                            <Select value={planForm} onValueChange={(v) => setPlanForm(v as PlanKey)}>
                                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="FREE">Free</SelectItem>
                                    <SelectItem value="PRO">Pro</SelectItem>
                                    <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {planForm !== "FREE" && (
                            <>
                                <div className="space-y-1.5">
                                    <Label className="text-sm">Tipe Billing</Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button type="button" variant={billingType === "MONTHLY" ? "default" : "outline"} size="sm" className="rounded-lg flex-1 h-8 sm:h-9 text-xs" onClick={() => setBillingType("MONTHLY")}>Bulanan</Button>
                                        <Button type="button" variant={billingType === "YEARLY" ? "default" : "outline"} size="sm" className="rounded-lg flex-1 h-8 sm:h-9 text-xs" onClick={() => setBillingType("YEARLY")}>Tahunan</Button>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-sm">Durasi (bulan)</Label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {[1, 3, 6, 12].map((m) => (
                                            <Button key={m} type="button" variant={durationMonths === m ? "default" : "outline"} size="sm" className="rounded-lg h-8 sm:h-9 text-xs" onClick={() => setDurationMonths(m)}>
                                                {m} bln
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-sm">Nominal (kosongkan untuk harga default)</Label>
                                    <Input type="number" value={amountOverride} onChange={(e) => setAmountOverride(e.target.value)} placeholder="Auto" className="rounded-xl h-9 sm:h-10 text-sm" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-sm">Catatan</Label>
                                    <Input value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} placeholder="Referensi pembayaran, dll" className="rounded-xl h-9 sm:h-10 text-sm" />
                                </div>
                            </>
                        )}
                    </DialogBody>
                    <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
                        <Button variant="outline" className="rounded-xl w-full sm:w-auto h-9 sm:h-10 text-sm" onClick={() => { setDialogMode(null); setSelectedCompany(null); setAmountOverride(""); setPaymentNotes(""); }}>Batal</Button>
                        <Button className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 w-full sm:w-auto h-9 sm:h-10 text-sm" onClick={handleUpgrade} disabled={submitting}>
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
                            Konfirmasi
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Extend Plan Dialog */}
            <Dialog open={dialogMode === "extend"} onOpenChange={(v) => { if (!v) { setDialogMode(null); setSelectedCompany(null); } }}>
                <DialogContent className="rounded-2xl max-w-[calc(100vw-1rem)] sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Plus className="w-5 h-5 text-primary" />
                            Perpanjang Plan
                        </DialogTitle>
                    </DialogHeader>
                    <DialogBody className="space-y-3 sm:space-y-4">
                        <div className="rounded-xl bg-muted/30 p-2.5 sm:p-3 text-xs sm:text-sm">
                            <p className="font-medium">{selectedCompany?.name}</p>
                            <p className="text-xs text-muted-foreground">
                                Plan: {selectedCompany?.plan}
                                {selectedCompany?.planExpiresAt && ` · Exp: ${new Date(selectedCompany.planExpiresAt).toLocaleDateString("id-ID")}`}
                            </p>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm">Tambah Durasi</Label>
                            <div className="grid grid-cols-4 gap-2">
                                {[1, 3, 6, 12].map((m) => (
                                    <Button key={m} type="button" variant={durationMonths === m ? "default" : "outline"} size="sm" className="rounded-lg h-8 sm:h-9 text-xs" onClick={() => setDurationMonths(m)}>
                                        {m} bln
                                    </Button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm">Nominal (kosongkan untuk harga default)</Label>
                            <Input type="number" value={amountOverride} onChange={(e) => setAmountOverride(e.target.value)} placeholder="Auto" className="rounded-xl h-9 sm:h-10 text-sm" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm">Catatan</Label>
                            <Input value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} placeholder="Referensi pembayaran, dll" className="rounded-xl h-9 sm:h-10 text-sm" />
                        </div>
                    </DialogBody>
                    <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
                        <Button variant="outline" className="rounded-xl w-full sm:w-auto h-9 sm:h-10 text-sm" onClick={() => { setDialogMode(null); setSelectedCompany(null); setAmountOverride(""); setPaymentNotes(""); }}>Batal</Button>
                        <Button className="rounded-xl w-full sm:w-auto h-9 sm:h-10 text-sm" onClick={handleExtend} disabled={submitting}>
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
                            Perpanjang
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <ActionConfirmDialog
                open={Boolean(revokeTarget)}
                onOpenChange={(v) => { if (!v) setRevokeTarget(null); }}
                kind="delete"
                title="Downgrade Plan ke FREE"
                description={revokeTarget ? `Yakin ingin downgrade ${revokeTarget.name} ke plan FREE?` : "Yakin ingin downgrade plan?"}
                confirmLabel="Downgrade"
                onConfirm={handleRevoke}
                loading={submitting}
            />
            <Sheet open={mobileTabSheetOpen} onOpenChange={setMobileTabSheetOpen}>
                <SheetContent side="bottom" className="rounded-t-2xl p-0" showCloseButton={false}>
                    <SheetHeader className="pb-2">
                        <SheetTitle>Pilih Tampilan Data</SheetTitle>
                    </SheetHeader>
                    <div className="px-4 pb-4 space-y-2">
                        <Button
                            type="button"
                            variant={activeTab === "companies" ? "default" : "outline"}
                            className="w-full rounded-xl justify-start"
                            onClick={() => { setActiveTab("companies"); setMobileTabSheetOpen(false); }}
                        >
                            Perusahaan
                        </Button>
                        <Button
                            type="button"
                            variant={activeTab === "history" ? "default" : "outline"}
                            className="w-full rounded-xl justify-start"
                            onClick={() => { setActiveTab("history"); setMobileTabSheetOpen(false); }}
                        >
                            Riwayat Pembayaran
                        </Button>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
