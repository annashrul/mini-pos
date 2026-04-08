"use client";

import { Check, DollarSign, Package } from "lucide-react";

export function BranchPricesStatsBar(props: {
    stats: { totalProducts: number; customPrices: number; defaultPrices: number };
    selectedBranchName: string | null | undefined;
}) {
    const { stats } = props;

    return (
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-50 border border-slate-200/60 rounded-xl px-2.5 sm:px-3.5 py-1.5 sm:py-2">
                <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500" />
                <span className="text-xs sm:text-sm font-medium text-slate-700">{stats.totalProducts} Produk</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 bg-violet-50 border border-violet-200/60 ring-1 ring-violet-500/10 rounded-xl px-2.5 sm:px-3.5 py-1.5 sm:py-2">
                <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-violet-600" />
                <span className="text-xs sm:text-sm font-medium text-violet-700">{stats.customPrices} Harga Khusus</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-50 border border-slate-200/60 rounded-xl px-2.5 sm:px-3.5 py-1.5 sm:py-2">
                <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500" />
                <span className="text-xs sm:text-sm font-medium text-slate-700">{stats.defaultPrices} Default</span>
            </div>
            {/* <Badge variant="outline" className="rounded-full px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-medium bg-white border-violet-200 text-violet-700">
        {selectedBranchName || "Cabang"}
      </Badge> */}
        </div>
    );
}

