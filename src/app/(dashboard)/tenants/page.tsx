"use client";

import { useEffect, useState } from "react";
import { getAllCompanies } from "@/server/actions/subscription-admin";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Building2, Calendar, CalendarClock, Crown, GitBranch, Loader2, Package, Search, Shield, Users, Zap } from "lucide-react";

type Company = Awaited<ReturnType<typeof getAllCompanies>>[number];

const planColors: Record<string, string> = { FREE: "bg-slate-100 text-slate-700", PRO: "bg-amber-100 text-amber-700", ENTERPRISE: "bg-purple-100 text-purple-700" };
const planIcons: Record<string, typeof Zap> = { FREE: Zap, PRO: Crown, ENTERPRISE: Shield };

export default function TenantsPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getAllCompanies().then(setCompanies).finally(() => setLoading(false));
  }, []);

  const filtered = search
    ? companies.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase()) || c.slug.toLowerCase().includes(search.toLowerCase()))
    : companies;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold">Daftar Tenant</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {companies.length} perusahaan terdaftar
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Building2} label="Total" value={companies.length} color="from-blue-500 to-indigo-600" />
        <StatCard icon={Zap} label="Free" value={companies.filter((c) => c.plan === "FREE").length} color="from-slate-400 to-slate-500" />
        <StatCard icon={Crown} label="Pro" value={companies.filter((c) => c.plan === "PRO").length} color="from-amber-500 to-orange-500" />
        <StatCard icon={Shield} label="Enterprise" value={companies.filter((c) => c.plan === "ENTERPRISE").length} color="from-purple-500 to-violet-600" />
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari tenant..." className="pl-9 rounded-xl" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const PlanIcon = planIcons[c.plan] || Zap;
            const expired = c.planExpiresAt && new Date(c.planExpiresAt) < new Date();
            return (
              <div key={c.id} className="rounded-xl border border-border/60 bg-white p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{c.name}</p>
                      <Badge className={cn("text-[10px] px-2 py-0 rounded-full", planColors[c.plan])}>
                        <PlanIcon className="w-3 h-3 mr-1" />{c.plan}
                      </Badge>
                      {expired && <Badge className="bg-red-100 text-red-700 text-[10px] px-2 py-0 rounded-full">Expired</Badge>}
                      {!c.isActive && <Badge className="bg-slate-100 text-slate-500 text-[10px] px-2 py-0 rounded-full">Nonaktif</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{c.email || c.slug}</p>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-muted-foreground shrink-0">
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
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: typeof Building2; label: string; value: number; color: string }) {
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
