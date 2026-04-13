"use client";

import { useEffect, useState, type ComponentType } from "react";
import { getAllCompanies } from "@/server/actions/subscription-admin";
import { registerCompany } from "@/server/actions/register";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { PLAN_UI } from "@/lib/plan-ui";
import { Building2, Calendar, CalendarClock, GitBranch, Loader2, Package, Plus, Search, Users } from "lucide-react";

type Company = Awaited<ReturnType<typeof getAllCompanies>>[number];

export default function TenantsPage() {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [openCreate, setOpenCreate] = useState(false);
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState("");

    useEffect(() => {
        getAllCompanies().then(setCompanies).finally(() => setLoading(false));
    }, []);

    const filtered = search
        ? companies.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase()) || c.slug.toLowerCase().includes(search.toLowerCase()))
        : companies;

    const handleCreateTenant = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setCreateError("");
        setCreating(true);
        const formEl = e.currentTarget;
        const formData = new FormData(formEl);
        const password = (formData.get("password") as string) || "";
        const confirmPassword = (formData.get("confirmPassword") as string) || "";
        if (password !== confirmPassword) {
            setCreateError("Password dan konfirmasi password tidak cocok");
            setCreating(false);
            return;
        }
        const result = await registerCompany(formData);
        if (result.error) {
            setCreateError(result.error);
            setCreating(false);
            return;
        }
        formEl.reset();
        setOpenCreate(false);
        setCreating(false);
        setLoading(true);
        getAllCompanies().then(setCompanies).finally(() => setLoading(false));
    };

    return (
        <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-2.5 sm:gap-3">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                        <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg sm:text-2xl font-bold">Daftar Tenant</h1>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                            {companies.length} perusahaan terdaftar
                        </p>
                    </div>
                </div>
                <Button className="rounded-xl hidden sm:inline-flex" onClick={() => setOpenCreate(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Buat Tenant
                </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                <StatCard icon={Building2} label="Total" value={companies.length} color="from-blue-500 to-indigo-600" />
                <StatCard icon={PLAN_UI.FREE.icon} label={PLAN_UI.FREE.name} value={companies.filter((c) => c.plan === "FREE").length} color="from-slate-400 to-slate-500" />
                <StatCard icon={PLAN_UI.PRO.icon} label={PLAN_UI.PRO.name} value={companies.filter((c) => c.plan === "PRO").length} color="from-amber-500 to-orange-500" />
                <StatCard icon={PLAN_UI.ENTERPRISE.icon} label={PLAN_UI.ENTERPRISE.name} value={companies.filter((c) => c.plan === "ENTERPRISE").length} color="from-purple-500 to-violet-600" />
            </div>

            <div className="relative w-full sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari tenant..." className="pl-9 rounded-xl h-9 sm:h-10 text-sm" />
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : (
                <div className="space-y-2">
                    {filtered.map((c) => {
                        const planMeta = PLAN_UI[c.plan as keyof typeof PLAN_UI] || PLAN_UI.FREE;
                        const PlanIcon = planMeta.icon;
                        const expired = c.planExpiresAt && new Date(c.planExpiresAt) < new Date();
                        return (
                            <div key={c.id} className="rounded-xl border border-border/60 bg-white p-3 sm:p-4">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="font-semibold text-sm">{c.name}</p>
                                            <Badge className={cn("text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0 rounded-full", planMeta.badgeClassName)}>
                                                <PlanIcon className="w-3 h-3 mr-1" />{planMeta.name}
                                            </Badge>
                                            {expired && <Badge className="bg-red-100 text-red-700 text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0 rounded-full">Expired</Badge>}
                                            {!c.isActive && <Badge className="bg-slate-100 text-slate-500 text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0 rounded-full">Nonaktif</Badge>}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5">{c.email || c.slug}</p>
                                    </div>
                                    <div className="grid grid-cols-2 sm:flex items-center gap-1.5 sm:gap-4 text-[10px] sm:text-[11px] text-muted-foreground shrink-0">
                                        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {c._count.users}</span>
                                        <span className="flex items-center gap-1"><GitBranch className="w-3 h-3" /> {c._count.branches}</span>
                                        <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {c._count.products}</span>
                                        <span className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(c.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                                        </span>
                                        {c.plan !== "FREE" && c.planExpiresAt && (
                                            <span className={cn("flex items-center gap-1", expired ? "text-red-500 font-medium" : "")}>
                                                <CalendarClock className="w-3 h-3" />
                                                {expired ? "Expired " : "s/d "}
                                                {new Date(c.planExpiresAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                                            </span>
                                        )}
                                        {c.plan !== "FREE" && !c.planExpiresAt && (
                                            <span className="flex items-center gap-1 text-emerald-600">
                                                <CalendarClock className="w-3 h-3" /> Selamanya
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Tidak ada tenant ditemukan</p>}
                </div>
            )}

            <Dialog open={openCreate} onOpenChange={setOpenCreate}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Buat Tenant Baru</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreateTenant}>
                        <DialogBody className="space-y-4">
                            {createError ? (
                                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                    {createError}
                                </div>
                            ) : null}
                            <div className="space-y-2">
                                <Label htmlFor="companyName">Nama Perusahaan</Label>
                                <Input id="companyName" name="companyName" required placeholder="PT Contoh Sejahtera" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label htmlFor="companyPhone">Telepon</Label>
                                    <Input id="companyPhone" name="companyPhone" placeholder="021-12345678" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="companyAddress">Alamat</Label>
                                    <Input id="companyAddress" name="companyAddress" placeholder="Jakarta" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="name">Nama Admin</Label>
                                <Input id="name" name="name" required placeholder="John Doe" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email Admin</Label>
                                <Input id="email" name="email" type="email" required placeholder="admin@tenant.com" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label htmlFor="password">Password</Label>
                                    <Input id="password" name="password" type="password" required minLength={6} placeholder="Min 6 karakter" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="confirmPassword">Konfirmasi Password</Label>
                                    <Input id="confirmPassword" name="confirmPassword" type="password" required minLength={6} placeholder="Ulangi password" />
                                </div>
                            </div>
                        </DialogBody>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setOpenCreate(false)} disabled={creating}>
                                Batal
                            </Button>
                            <Button type="submit" disabled={creating}>
                                {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                                Buat Tenant
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
            <Button
                className="sm:hidden fixed bottom-20 right-4 z-40 h-11 w-11 rounded-full shadow-lg shadow-primary/25"
                size="icon"
                onClick={() => setOpenCreate(true)}
            >
                <Plus className="w-5 h-5" />
            </Button>
        </div>
    );
}

function StatCard({ icon: Icon, label, value, color }: { icon: ComponentType<{ className?: string }>; label: string; value: number; color: string }) {
    return (
        <div className="flex items-center gap-3 rounded-xl border p-3">
            <div className={cn("w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center", color)}>
                <Icon className="w-4 h-4 text-white" />
            </div>
            <div>
                <p className="text-lg font-bold">{value}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
            </div>
        </div>
    );
}
