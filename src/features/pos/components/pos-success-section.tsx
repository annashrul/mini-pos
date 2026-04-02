"use client";

import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import { Check, CloudOff, Printer } from "lucide-react";
import { usePosScreenContext } from "../hooks";
import type { PosSuccessScreenContextValue } from "../hooks/use-pos-screen-context";

export function PosSuccessSection() {
    const {
        success,
        grandTotal,
        paymentMethod,
        changeAmount,
        pointsEarnedResult,
        onPrint,
        onNewTransaction,
    } = usePosScreenContext<PosSuccessScreenContextValue>();
    return (
        <div className="flex items-center justify-center h-screen bg-[#F1F5F9]">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-6 md:p-10 text-center space-y-6">
                <div className={cn("w-20 h-20 rounded-full flex items-center justify-center mx-auto", success.startsWith("OFFLINE-") ? "bg-orange-50" : "bg-emerald-50")}>
                    {success.startsWith("OFFLINE-") ? <CloudOff className="w-10 h-10 text-orange-500" /> : <Check className="w-10 h-10 text-emerald-500" />}
                </div>
                <div>
                    <h2 className="text-2xl font-bold">{success.startsWith("OFFLINE-") ? "Tersimpan Offline" : "Transaksi Berhasil!"}</h2>
                    <p className="text-muted-foreground mt-1 font-mono text-sm">{success}</p>
                    {success.startsWith("OFFLINE-") && <p className="text-xs text-orange-500 mt-1">Akan disinkronkan saat online</p>}
                </div>
                <div className="text-4xl font-bold text-primary tabular-nums">{formatCurrency(grandTotal)}</div>
                {paymentMethod === "CASH" && changeAmount > 0 && (
                    <div className="bg-amber-50 rounded-xl p-4">
                        <p className="text-sm text-amber-600">Kembalian</p>
                        <p className="text-2xl font-bold text-amber-700 tabular-nums">{formatCurrency(changeAmount)}</p>
                    </div>
                )}
                {pointsEarnedResult > 0 && (
                    <div className="bg-purple-50 rounded-xl p-3 flex items-center justify-center gap-2">
                        <span className="text-sm text-purple-600">Poin didapat:</span>
                        <span className="text-lg font-bold text-purple-700">+{pointsEarnedResult} poin</span>
                    </div>
                )}
                <div className="flex gap-3">
                    <Button variant="outline" className="flex-1 rounded-xl h-12" onClick={onPrint}>
                        <Printer className="w-4 h-4 mr-2" /> Cetak Struk
                    </Button>
                    <Button className="flex-1 rounded-xl h-12 text-base" onClick={onNewTransaction}>Transaksi Baru</Button>
                </div>
            </div>
        </div>
    );
}
