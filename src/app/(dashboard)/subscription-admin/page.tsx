"use client";

import { useEffect, useState } from "react";
import { getAllCompanies, updateCompanyPlan, extendCompanyPlan, revokeCompanyPlan, getSubscriptionHistory } from "@/server/actions/subscription-admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Building2, Calendar, Check, Crown, Loader2, Package, Plus, RotateCcw, Search, Shield, Users, Zap } from "lucide-react";
import { toast } from "sonner";
import type { PlanKey } from "@/lib/plan-config";

type Company = Awaited<ReturnType<typeof getAllCompanies>>[number];

const planColors: Record<string, string> = {
    FREE: "bg-slate-100 text-slate-700",
    PRO: "bg-amber-100 text-amber-700",
    ENTERPRISE: "bg-purple-100 text-purple-700",
};

const planIcons: Record<string, typeof Zap> = {
    FREE: Zap,
    PRO: Crown,
    ENTERPRISE: Shield,
};

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

    const handleRevoke = async (company: Company) => {
        if (!confirm(`Yakin ingin downgrade ${company.name} ke FREE?`)) return;
        try {
            await revokeCompanyPlan(company.id);
            toast.success(`${company.name} di-downgrade ke FREE`);
            loadData();
        } catch { toast.error("Gagal downgrade"); }
    };

    const isExpired = (c: Company) => c.planExpiresAt && new Date(c.planExpiresAt) < new Date();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                        <Crown className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg sm:text-2xl font-bold">Manajemen Subscription</h1>
                        <p className="text-xs sm:text-sm text-muted-foreground">Kelola plan dan langganan perusahaan</p>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border p-3 flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-muted-foreground" />
                    <div>
                        <p className="text-lg font-bold">{companies.length}</p>
                        <p className="text-[10px] text-muted-foreground">Total Perusahaan</p>
                    </div>
                </div>
                <div className="rounded-xl border p-3 flex items-center gap-3">
                    <Zap className="w-5 h-5 text-slate-500" />
                    <div>
                        <p className="text-lg font-bold">{companies.filter((c) => c.plan === "FREE").length}</p>
                        <p className="text-[10px] text-muted-foreground">Free</p>
                    </div>
                </div>
                <div className="rounded-xl border p-3 flex items-center gap-3">
                    <Crown className="w-5 h-5 text-amber-500" />
                    <div>
                        <p className="text-lg font-bold">{companies.filter((c) => c.plan === "PRO").length}</p>
                        <p className="text-[10px] text-muted-foreground">Pro</p>
                    </div>
                </div>
                <div className="rounded-xl border p-3 flex items-center gap-3">
                    <Shield className="w-5 h-5 text-purple-500" />
                    <div>
                        <p className="text-lg font-bold">{companies.filter((c) => c.plan === "ENTERPRISE").length}</p>
                        <p className="text-[10px] text-muted-foreground">Enterprise</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 bg-muted rounded-xl p-1 w-fit">
                <button onClick={() => setActiveTab("companies")} className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all", activeTab === "companies" ? "bg-white shadow-sm" : "text-muted-foreground")}>
                    Perusahaan
                </button>
                <button onClick={() => setActiveTab("history")} className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all", activeTab === "history" ? "bg-white shadow-sm" : "text-muted-foreground")}>
                    Riwayat Pembayaran
                    {history.length > 0 && <Badge className="ml-1.5 bg-primary/10 text-primary text-[10px] px-1.5 py-0 rounded-full">{history.length}</Badge>}
                </button>
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={activeTab === "companies" ? "Cari perusahaan..." : "Cari riwayat..."} className="pl-9 rounded-xl" />
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : activeTab === "history" ? (
                /* Payment History */
                <div className="space-y-2">
                    {history.filter((h) => !search || h.companyName.toLowerCase().includes(search.toLowerCase())).map((p) => (
                        <div key={p.id} className="rounded-xl border border-border/60 bg-white p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-semibold text-sm">{p.companyName}</p>
                                    <Badge className={cn("text-[10px] px-2 py-0 rounded-full", planColors[p.plan])}>{p.plan}</Badge>
                                    <Badge className={cn("text-[10px] px-2 py-0 rounded-full", statusColors[p.status])}>{p.status}</Badge>
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground flex-wrap">
                                    <span>{p.durationMonths} bulan ({p.billingType === "YEARLY" ? "Tahunan" : "Bulanan"})</span>
                                    <span>{new Date(p.planStartDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })} — {new Date(p.planEndDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</span>
                                    {p.notes && <span className="italic">{p.notes}</span>}
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="font-bold text-sm tabular-nums">{formatCurrency(p.amount)}</p>
                                <p className="text-[10px] text-muted-foreground">{new Date(p.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                            </div>
                        </div>
                    ))}
                    {history.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Belum ada riwayat pembayaran</p>}
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map((c) => {
                        const PlanIcon = planIcons[c.plan] || Zap;
                        const expired = isExpired(c);
                        return (
                            <div key={c.id} className="rounded-xl border border-border/60 bg-white p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-semibold text-sm truncate">{c.name}</p>
                                        <Badge className={cn("text-[10px] px-2 py-0 rounded-full", planColors[c.plan])}>
                                            <PlanIcon className="w-3 h-3 mr-1" />{c.plan}
                                        </Badge>
                                        {expired && <Badge className="bg-red-100 text-red-700 text-[10px] px-2 py-0 rounded-full">Expired</Badge>}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5">{c.email || c.slug}</p>
                                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
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
                                <div className="flex items-center gap-1.5 shrink-0">
                                    {c.plan === "FREE" ? (
                                        <Button size="sm" className="rounded-lg text-xs h-8 bg-gradient-to-r from-amber-500 to-orange-500" onClick={() => { setSelectedCompany(c); setPlanForm("PRO"); setDurationMonths(1); setDialogMode("upgrade"); }}>
                                            <Crown className="w-3 h-3 mr-1" /> Upgrade
                                        </Button>
                                    ) : (
                                        <>
                                            <Button size="sm" variant="outline" className="rounded-lg text-xs h-8" onClick={() => { setSelectedCompany(c); setDurationMonths(1); setDialogMode("extend"); }}>
                                                <Plus className="w-3 h-3 mr-1" /> Perpanjang
                                            </Button>
                                            <Button size="sm" variant="outline" className="rounded-lg text-xs h-8" onClick={() => { setSelectedCompany(c); setPlanForm(c.plan as PlanKey); setDurationMonths(1); setDialogMode("upgrade"); }}>
                                                Ubah Plan
                                            </Button>
                                            <Button size="sm" variant="ghost" className="rounded-lg text-xs h-8 text-red-500 hover:bg-red-50" onClick={() => handleRevoke(c)}>
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
                <DialogContent className="rounded-2xl max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Crown className="w-5 h-5 text-amber-500" />
                            {selectedCompany?.plan === "FREE" ? "Upgrade Plan" : "Ubah Plan"}
                        </DialogTitle>
                    </DialogHeader>
                    <DialogBody className="space-y-4">
                        <div className="rounded-xl bg-muted/30 p-3 text-sm">
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
                                    <div className="flex gap-2">
                                        <Button type="button" variant={billingType === "MONTHLY" ? "default" : "outline"} size="sm" className="rounded-lg flex-1" onClick={() => setBillingType("MONTHLY")}>Bulanan</Button>
                                        <Button type="button" variant={billingType === "YEARLY" ? "default" : "outline"} size="sm" className="rounded-lg flex-1" onClick={() => setBillingType("YEARLY")}>Tahunan</Button>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-sm">Durasi (bulan)</Label>
                                    <div className="flex gap-2">
                                        {[1, 3, 6, 12].map((m) => (
                                            <Button key={m} type="button" variant={durationMonths === m ? "default" : "outline"} size="sm" className="rounded-lg flex-1" onClick={() => setDurationMonths(m)}>
                                                {m} bln
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-sm">Nominal (kosongkan untuk harga default)</Label>
                                    <Input type="number" value={amountOverride} onChange={(e) => setAmountOverride(e.target.value)} placeholder="Auto" className="rounded-xl" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-sm">Catatan</Label>
                                    <Input value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} placeholder="Referensi pembayaran, dll" className="rounded-xl" />
                                </div>
                            </>
                        )}
                    </DialogBody>
                    <DialogFooter>
                        <Button variant="outline" className="rounded-xl" onClick={() => { setDialogMode(null); setSelectedCompany(null); setAmountOverride(""); setPaymentNotes(""); }}>Batal</Button>
                        <Button className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500" onClick={handleUpgrade} disabled={submitting}>
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
                            Konfirmasi
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Extend Plan Dialog */}
            <Dialog open={dialogMode === "extend"} onOpenChange={(v) => { if (!v) { setDialogMode(null); setSelectedCompany(null); } }}>
                <DialogContent className="rounded-2xl max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Plus className="w-5 h-5 text-primary" />
                            Perpanjang Plan
                        </DialogTitle>
                    </DialogHeader>
                    <DialogBody className="space-y-4">
                        <div className="rounded-xl bg-muted/30 p-3 text-sm">
                            <p className="font-medium">{selectedCompany?.name}</p>
                            <p className="text-xs text-muted-foreground">
                                Plan: {selectedCompany?.plan}
                                {selectedCompany?.planExpiresAt && ` · Exp: ${new Date(selectedCompany.planExpiresAt).toLocaleDateString("id-ID")}`}
                            </p>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm">Tambah Durasi</Label>
                            <div className="flex gap-2">
                                {[1, 3, 6, 12].map((m) => (
                                    <Button key={m} type="button" variant={durationMonths === m ? "default" : "outline"} size="sm" className="rounded-lg flex-1" onClick={() => setDurationMonths(m)}>
                                        {m} bln
                                    </Button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm">Nominal (kosongkan untuk harga default)</Label>
                            <Input type="number" value={amountOverride} onChange={(e) => setAmountOverride(e.target.value)} placeholder="Auto" className="rounded-xl" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm">Catatan</Label>
                            <Input value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} placeholder="Referensi pembayaran, dll" className="rounded-xl" />
                        </div>
                    </DialogBody>
                    <DialogFooter>
                        <Button variant="outline" className="rounded-xl" onClick={() => { setDialogMode(null); setSelectedCompany(null); setAmountOverride(""); setPaymentNotes(""); }}>Batal</Button>
                        <Button className="rounded-xl" onClick={handleExtend} disabled={submitting}>
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
                            Perpanjang
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
